const { Donation, Receipt, Campaign, Subscription } = require("../models");
const { financialYearRange, formatDateIst } = require("../utils/financialYear");
const { addMonths, confirmDonation } = require("./receiptService");

async function campaignReport({ from, to } = {}) {
  const match = { status: "paid" };
  if (from || to) {
    match.paidAt = {};
    if (from) match.paidAt.$gte = from;
    if (to) match.paidAt.$lte = to;
  }
  const rows = await Donation.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$campaign",
        donations: { $sum: 1 },
        total: { $sum: "$amount" },
        donors: { $addToSet: "$donorEmail" },
      },
    },
  ]);
  const campaigns = await Campaign.find().lean();
  const byId = new Map(rows.map((r) => [r._id.toString(), r]));
  const report = campaigns.map((c) => {
    const r = byId.get(c._id.toString());
    return {
      slug: c.slug,
      title: c.title,
      goal: c.goal,
      donations: r ? r.donations : 0,
      total: r ? r.total : 0,
      average: r ? Math.round(r.total / r.donations) : 0,
      uniqueDonors: r ? r.donors.length : 0,
    };
  });
  return {
    campaigns: report,
    totals: {
      donations: report.reduce((a, r) => a + r.donations, 0),
      total: report.reduce((a, r) => a + r.total, 0),
    },
  };
}

// A spreadsheet treats cells that start with = + - @ as formulas. Donor names are typed by
// the public, so prefix such cells with an apostrophe (CSV injection).
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Form 10BD export. Column layout is an ASSUMPTION: the brief asks for a 10BD export but
// does not give the exact format.
async function form10bdCsv(fy) {
  const { start, end } = financialYearRange(fy);
  const receipts = await Receipt.find({ financialYear: fy }).sort({ seq: 1 }).lean();
  const header = [
    "receipt_no",
    "receipt_date",
    "donor_name",
    "donor_pan",
    "amount_inr",
    "campaign",
    "financial_year",
  ];
  const lines = [header.join(",")];
  for (const r of receipts) {
    lines.push(
      [
        r.receiptNo,
        formatDateIst(r.snapshot.date),
        r.snapshot.donorName,
        r.snapshot.donorPan || "",
        r.snapshot.amount,
        r.snapshot.campaignTitle,
        r.financialYear,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return { csv: lines.join("\r\n") + "\r\n", count: receipts.length, start, end };
}

/**
 * Mock monthly giving: turn each due Subscription into a donation and a receipt.
 * Safe to run repeatedly: the renewal's idempotency key is derived from the
 * subscription and the month, so a month can only ever be charged once.
 */
async function processDueSubscriptions(now = new Date()) {
  const due = await Subscription.find({ active: true, nextChargeDate: { $lte: now } });
  const processed = [];
  for (const sub of due) {
    const month = sub.nextChargeDate.toISOString().slice(0, 7);
    const key = `sub-${sub._id}-${month}`;
    let donation = await Donation.findOne({ idempotencyKey: key });
    if (!donation) {
      donation = await Donation.create({
        donor: sub.donor,
        campaign: sub.campaign,
        amount: sub.amount,
        type: "monthly",
        status: "pending",
        idempotencyKey: key,
        donorName: sub.donorName,
        donorEmail: sub.donorEmail,
        donorPan: sub.donorPan,
        subscription: sub._id,
      });
    }
    const { receipt } = await confirmDonation(key, { now });
    await Subscription.updateOne(
      { _id: sub._id, nextChargeDate: sub.nextChargeDate },
      { $set: { nextChargeDate: addMonths(sub.nextChargeDate, 1) } }
    );
    processed.push({ subscription: sub._id.toString(), receiptNo: receipt.receiptNo });
  }
  return { processed: processed.length, items: processed };
}

module.exports = { campaignReport, form10bdCsv, processDueSubscriptions, csvCell };
