const Scheme = require("../models/Scheme");
const { httpError } = require("../middleware/errors");

function localized(value, language) {
  if (!value) return "";
  return value[language] || value.en || value.hi || "";
}

function schemeCard(scheme, language = "hi") {
  return {
    id: scheme._id,
    code: scheme.code,
    title: localized(scheme.title, language),
    need: scheme.need,
    districts: scheme.districts,
    benefit: localized(scheme.benefit, language),
    whoCanApply: localized(scheme.whoCanApply, language),
    summary: language === "hi" && scheme.summaryStatus === "approved"
      ? scheme.summaryHi
      : "",
    sourceUrl: scheme.sourceUrl,
    lastChecked: scheme.lastChecked,
  };
}

async function listSchemes(req, res, next) {
  try {
    const filter = { status: "published" };
    if (req.query.need) filter.need = req.query.need;
    if (req.query.district) filter.districts = req.query.district;
    const schemes = await Scheme.find(filter).sort({ need: 1, code: 1 }).lean();
    res.json({ schemes: schemes.map((item) => schemeCard(item, req.query.lang || "hi")) });
  } catch (error) { next(error); }
}

async function getScheme(req, res, next) {
  try {
    const scheme = await Scheme.findOne({ code: req.params.code.toUpperCase(), status: "published" }).lean();
    if (!scheme) throw httpError(404, "Scheme not found", "not_found");
    const lang = req.query.lang || "hi";
    res.json({
      scheme: {
        ...schemeCard(scheme, lang),
        documents: (scheme.documents || []).map((item) => localized(item, lang)),
        howToApply: localized(scheme.howToApply, lang),
        helpCentre: scheme.helpCentre,
        eligibility: scheme.eligibility,
      },
    });
  } catch (error) { next(error); }
}

// Deterministic screening only. A possible match is not an official eligibility decision.
function evaluate(eligibility = {}, answers = {}) {
  const reasons = [];
  const missing = [];
  if (eligibility.gender && answers.gender !== eligibility.gender) reasons.push("gender");
  if (eligibility.minAge && Number(answers.age) < eligibility.minAge) reasons.push("age");
  if (eligibility.maxAge && Number(answers.age) > eligibility.maxAge) reasons.push("age");
  if (eligibility.maritalStatus && answers.maritalStatus !== eligibility.maritalStatus) reasons.push("maritalStatus");
  if (eligibility.pregnancy && answers.pregnancy !== true) reasons.push("pregnancy");
  if (eligibility.firstChild && answers.firstChild !== true) reasons.push("firstChild");
  if (eligibility.rural && answers.rural !== true) reasons.push("rural");
  if (eligibility.occupation && answers.occupation !== eligibility.occupation) reasons.push("occupation");
  for (const requirement of eligibility.requires || []) {
    if (!Array.isArray(answers.documents) || !answers.documents.includes(requirement)) missing.push(requirement);
  }
  return { matched: reasons.length === 0, reasons, missingDocuments: missing };
}

async function checkEligibility(req, res, next) {
  try {
    const { age, district, answers = {} } = req.body;
    if (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120) {
      throw httpError(400, "Enter a valid age", "validation_error");
    }
    const schemes = await Scheme.find({ status: "published", districts: district }).lean();
    const results = schemes.map((scheme) => ({
      ...schemeCard(scheme, req.body.lang || "hi"),
      ...evaluate(scheme.eligibility, { ...answers, age: Number(age) }),
    })).filter((item) => item.matched);
    res.json({
      disclaimer: "This is an initial screening only. Final eligibility is decided by the responsible government department.",
      results,
    });
  } catch (error) { next(error); }
}

module.exports = { listSchemes, getScheme, checkEligibility, evaluate };
