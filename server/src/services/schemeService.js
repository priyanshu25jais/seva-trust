const { Scheme } = require("../models");
const { httpError } = require("../middleware/errors");

const NEEDS = ["Pension", "Livelihood", "Health"];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Public view of a scheme. Never includes the audit trail, the pasted notice text or an
// unapproved AI draft: only an editor-approved Hindi summary is shown.
function publicScheme(s) {
  return {
    code: s.code,
    title: s.title,
    need: s.need,
    districts: s.districts,
    benefit: s.benefit,
    whoCanApply: s.whoCanApply,
    documents: s.documents,
    howToApply: s.howToApply,
    helpCentre: s.helpCentre,
    sourceUrl: s.sourceUrl,
    lastChecked: s.lastChecked,
    summaryHi: s.summaryStatus === "approved" ? s.summaryHi : "",
  };
}

async function listPublished({ need, district, q } = {}) {
  const filter = { status: "published" };
  if (need) filter.need = need;
  if (district) {
    filter.$or = [{ districts: district }, { districts: { $size: 0 } }];
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$and = [{ $or: [{ "title.hi": rx }, { "title.en": rx }, { code: rx }, { "benefit.hi": rx }, { "benefit.en": rx }] }];
  }
  const schemes = await Scheme.find(filter).sort({ code: 1 }).lean();
  return schemes.map(publicScheme);
}

async function getPublished(code) {
  const scheme = await Scheme.findOne({ code: String(code).toUpperCase(), status: "published" }).lean();
  if (!scheme) throw httpError(404, "Scheme not found", "not_found");
  return publicScheme(scheme);
}

async function listPublishedRaw() {
  return Scheme.find({ status: "published" }).sort({ code: 1 }).lean();
}

async function meta() {
  const districts = await Scheme.distinct("districts", { status: "published" });
  return { needs: NEEDS, districts: districts.sort() };
}

module.exports = { listPublished, getPublished, listPublishedRaw, meta, publicScheme, NEEDS, escapeRegex };
