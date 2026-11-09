const mongoose = require("mongoose");
const { Donation, Receipt, Counter, Campaign, Subscription } = require("../models");
const { financialYear, formatReceiptNo } = require("../utils/financialYear");
const { maskPan } = require("../utils/pan");
const { httpError } = require("../middleware/errors");

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// Make sure the counter document for this financial year exists BEFORE we open the
// transaction. Two transactions that both try to create it at the same moment would
// hit a duplicate-key error (not a retryable conflict). Creating it up front means
// the transaction only ever does a plain $inc.
async function ensureCounter(key) {
  try {
    await Counter.updateOne({ key }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err; // another request created it first: fine
  }
}

// Performance, not correctness: every receipt in a financial year increments ONE counter
// document, so simultaneous transactions in one process would collide and retry over and
// over. Within a process we therefore line them up. Correctness never depends on this
// queue: across several server instances MongoDB's write-conflict detection plus
// withTransaction's automatic retry still guarantee unique, gap-free numbers (tested by
// running with the queue switched off).
const queues = new Map();
function enqueue(key, task) {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(key, next);
  next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}

/**
 * Confirm a paid donation and issue its receipt. Safe to call any number of times,
 * in parallel, for the same idempotency key (payment gateways retry webhooks).
 *
 * Guarantees:
 *  - one receipt per donation (existing-receipt check + unique index on donation)
 *  - receipt numbers are consecutive per financial year with no gaps: the counter
 *    increment and the receipt insert commit together or not at all
 *  - no duplicate numbers (atomic $inc + unique index on receiptNo)
 *
 * opts.now        - override the clock (tests; financial-year boundary)
 * opts.localQueue - set false to skip the in-process queue (tests: simulates many instances)
 * opts.hooks - test-only failure injection, e.g. afterCounterIncrement
 */
async function confirmDonation(idempotencyKey, opts = {}) {
  const donation = await Donation.findOne({ idempotencyKey });
  if (!donation) {
    throw httpError(404, "Donation not found", "not_found");
  }

  // Fast path: a retry for something already receipted. No counter touched.
  const existing = await Receipt.findOne({ donation: donation._id });
  if (existing) {
    return { receipt: existing, created: false };
  }
  if (donation.status === "failed") {
    throw httpError(409, "This donation failed and cannot be confirmed", "donation_failed");
  }

  const campaign = await Campaign.findById(donation.campaign).lean();
  const paidAt = opts.now ? new Date(opts.now) : new Date();
  const fy = financialYear(paidAt);
  const counterKey = `receipt:${fy}`;
  await ensureCounter(counterKey);

  let receipt = null;
  let created = false;

  const transaction = async () => {
    const session = await mongoose.startSession();
    try {
      // withTransaction retries the callback automatically on transient errors such as
      // a write conflict on the counter document when many donations confirm at once.
      await session.withTransaction(async () => {
        created = false;

        // Re-check inside the transaction: another request may have committed a receipt
        // for this donation after our fast-path read.
        const again = await Receipt.findOne({ donation: donation._id }).session(session);
        if (again) {
          receipt = again;
          return;
        }

        // Per-donation writes first: they never conflict with other donations.
        await Donation.updateOne(
          { _id: donation._id },
          { $set: { status: "paid", paidAt } },
          { session }
        );
        if (donation.type === "monthly" && !donation.subscription) {
          await Subscription.create(
            [
              {
                donor: donation.donor,
                campaign: donation.campaign,
                sourceDonation: donation._id,
                donorName: donation.donorName,
                donorEmail: donation.donorEmail,
                donorPan: donation.donorPan,
                amount: donation.amount,
                nextChargeDate: addMonths(paidAt, 1),
                active: true,
              },
            ],
            { session }
          );
        }

        // The shared counter goes LAST so its write lock is held for the shortest time.
        const counter = await Counter.findOneAndUpdate(
          { key: counterKey },
          { $inc: { seq: 1 } },
          { new: true, session }
        );
        if (opts.hooks && opts.hooks.afterCounterIncrement) {
          await opts.hooks.afterCounterIncrement(counter);
        }

        const [doc] = await Receipt.create(
          [
            {
              receiptNo: formatReceiptNo(fy, counter.seq),
              financialYear: fy,
              seq: counter.seq,
              donation: donation._id,
              snapshot: {
                donorName: donation.donorName,
                donorPan: donation.donorPan,
                amount: donation.amount,
                date: paidAt,
                campaignTitle: campaign ? campaign.title.en : "General fund",
                campaignTitleHi: campaign ? campaign.title.hi : undefined,
              },
            },
          ],
          { session }
        );
        receipt = doc;
        created = true;
      });
    } finally {
      await session.endSession();
    }
  };

  try {
    await (opts.localQueue === false ? transaction() : enqueue(counterKey, transaction));
  } catch (err) {
    // Lost a race against a parallel confirm of the same donation: return the winner.
    if (err.code === 11000) {
      const winner = await Receipt.findOne({ donation: donation._id });
      if (winner) {
        return { receipt: winner, created: false };
      }
    }
    throw err;
  }

  return { receipt, created };
}

// What the API returns about a receipt. PAN is always masked outside the PDF.
function receiptView(receipt) {
  const snap = receipt.snapshot;
  return {
    id: receipt._id.toString(),
    receiptNo: receipt.receiptNo,
    financialYear: receipt.financialYear,
    date: snap.date,
    amount: snap.amount,
    donorName: snap.donorName,
    donorPan: maskPan(snap.donorPan),
    campaignTitle: { en: snap.campaignTitle, hi: snap.campaignTitleHi || snap.campaignTitle },
  };
}

module.exports = { confirmDonation, receiptView, ensureCounter, addMonths };
