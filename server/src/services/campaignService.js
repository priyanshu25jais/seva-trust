const { Campaign, Donation, CallbackRequest } = require("../models");
const { httpError } = require("../middleware/errors");

async function totalsByCampaign() {
  const rows = await Donation.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: "$campaign", raised: { $sum: "$amount" }, donations: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r]));
}

function view(c, totals) {
  const t = totals.get(c._id.toString());
  return {
    slug: c.slug,
    title: c.title,
    goal: c.goal,
    raised: t ? t.raised : 0,
    donations: t ? t.donations : 0,
  };
}

async function listActive() {
  const [campaigns, totals] = await Promise.all([
    Campaign.find({ active: true }).sort({ createdAt: 1 }).lean(),
    totalsByCampaign(),
  ]);
  return campaigns.map((c) => view(c, totals));
}

async function getBySlug(slug) {
  const campaign = await Campaign.findOne({ slug: String(slug).toLowerCase(), active: true }).lean();
  if (!campaign) throw httpError(404, "Campaign not found", "not_found");
  return view(campaign, await totalsByCampaign());
}

async function createCallback(input) {
  const doc = await CallbackRequest.create(input);
  return { id: doc._id.toString(), status: doc.status };
}

module.exports = { listActive, getBySlug, createCallback };
