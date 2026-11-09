const schemeService = require("../services/schemeService");
const campaignService = require("../services/campaignService");
const { matchSchemes } = require("../services/finderService");
const { parseFinderSentence } = require("../services/aiService");
const { asyncHandler } = require("../utils/asyncHandler");

const meta = asyncHandler(async (_req, res) => {
  res.json(await schemeService.meta());
});

const listSchemes = asyncHandler(async (req, res) => {
  res.json({ schemes: await schemeService.listPublished(req.query) });
});

const getScheme = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeService.getPublished(req.params.code) });
});

// Eligibility finder. Rule based; the response lists the rules used and never promises.
const finderMatch = asyncHandler(async (req, res) => {
  const schemes = await schemeService.listPublishedRaw();
  const { matches, checked, notMatched } = matchSchemes(req.body.answers, schemes);
  res.json({
    disclaimer: "possible_match_only",
    checked,
    notMatched,
    matches: matches.map((m) => ({
      scheme: schemeService.publicScheme(m.scheme),
      rules: m.rules,
      passedCount: m.passedCount,
      unknownCount: m.unknownCount,
    })),
  });
});

// Optional AI helper: turns a typed or spoken sentence into answers. A person confirms them.
const finderParse = asyncHandler(async (req, res) => {
  res.json({ answers: await parseFinderSentence(req.body.sentence) });
});

const listCampaigns = asyncHandler(async (_req, res) => {
  res.json({ campaigns: await campaignService.listActive() });
});

const getCampaign = asyncHandler(async (req, res) => {
  res.json({ campaign: await campaignService.getBySlug(req.params.slug) });
});

const createCallback = asyncHandler(async (req, res) => {
  res.status(201).json({ callback: await campaignService.createCallback(req.body) });
});

module.exports = {
  meta,
  listSchemes,
  getScheme,
  finderMatch,
  finderParse,
  listCampaigns,
  getCampaign,
  createCallback,
};
