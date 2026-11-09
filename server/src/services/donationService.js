const { Donation, Receipt, Campaign } = require("../models");
const { maskPan } = require("../utils/pan");
const { httpError } = require("../middleware/errors");
const { receiptView } = require("./receiptService");

function donationView(donation, receipt, campaign) {
  return {
    id: donation._id.toString(),
    amount: donation.amount,
    type: donation.type,
    status: donation.status,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    donorPan: maskPan(donation.donorPan),
    createdAt: donation.createdAt,
    paidAt: donation.paidAt || null,
    campaign: campaign
      ? { slug: campaign.slug, title: campaign.title }
      : undefined,
    receipt: receipt ? receiptView(receipt) : null,
  };
}

/**
 * Create a pending donation. The client-generated idempotency key makes this safe to
 * repeat: a double click or a retry returns the same donation instead of a second one.
 */
async function createDonation(input, user) {
  const campaign = await Campaign.findOne({ slug: input.campaignSlug, active: true });
  if (!campaign) {
    throw httpError(404, "Campaign not found", "not_found");
  }

  const existing = await Donation.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (
      existing.amount !== input.amount ||
      existing.campaign.toString() !== campaign._id.toString()
    ) {
      throw httpError(409, "This request id was already used for a different donation", "idempotency_conflict");
    }
    return { donation: existing, campaign, created: false };
  }

  try {
    const donation = await Donation.create({
      donor: user ? user.id : undefined,
      campaign: campaign._id,
      amount: input.amount,
      type: input.type,
      status: "pending",
      idempotencyKey: input.idempotencyKey,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      donorPan: input.pan,
    });
    return { donation, campaign, created: true };
  } catch (err) {
    if (err.code === 11000) {
      const winner = await Donation.findOne({ idempotencyKey: input.idempotencyKey });
      if (winner) return { donation: winner, campaign, created: false };
    }
    throw err;
  }
}

// The idempotency key is an unguessable id that acts as the bearer secret for a guest donation.
async function getDonationByKey(key) {
  const donation = await Donation.findOne({ idempotencyKey: key });
  if (!donation) throw httpError(404, "Donation not found", "not_found");
  const [receipt, campaign] = await Promise.all([
    Receipt.findOne({ donation: donation._id }),
    Campaign.findById(donation.campaign).lean(),
  ]);
  return donationView(donation, receipt, campaign);
}

async function listDonationsForDonor(userId) {
  const donations = await Donation.find({ donor: userId, status: "paid" })
    .sort({ paidAt: -1 })
    .limit(200);
  const ids = donations.map((d) => d._id);
  const [receipts, campaigns] = await Promise.all([
    Receipt.find({ donation: { $in: ids } }),
    Campaign.find({ _id: { $in: donations.map((d) => d.campaign) } }).lean(),
  ]);
  const receiptByDonation = new Map(receipts.map((r) => [r.donation.toString(), r]));
  const campaignById = new Map(campaigns.map((c) => [c._id.toString(), c]));
  return donations.map((d) =>
    donationView(d, receiptByDonation.get(d._id.toString()), campaignById.get(d.campaign.toString()))
  );
}

module.exports = { createDonation, getDonationByKey, listDonationsForDonor, donationView };
