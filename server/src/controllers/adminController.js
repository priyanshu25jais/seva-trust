const { CallbackRequest } = require("../models");
const schemeAdmin = require("../services/schemeAdminService");
const reportService = require("../services/reportService");
const { httpError } = require("../middleware/errors");
const { asyncHandler } = require("../utils/asyncHandler");

const listSchemes = asyncHandler(async (req, res) => {
  res.json({ schemes: await schemeAdmin.list(req.query) });
});
const getScheme = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeAdmin.getOne(req.params.id) });
});
const createScheme = asyncHandler(async (req, res) => {
  res.status(201).json({ scheme: await schemeAdmin.create(req.body, req.user.id) });
});
const updateScheme = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeAdmin.update(req.params.id, req.body, req.user.id) });
});
const setStatus = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeAdmin.setStatus(req.params.id, req.body.status, req.user.id) });
});
const aiSummary = asyncHandler(async (req, res) => {
  res.json(await schemeAdmin.draftSummary(req.params.id, req.body.noticeText, req.user.id));
});
const approveSummary = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeAdmin.approveSummary(req.params.id, req.body.summaryHi, req.user.id) });
});
const discardSummary = asyncHandler(async (req, res) => {
  res.json({ scheme: await schemeAdmin.discardSummary(req.params.id, req.user.id) });
});

const campaignReport = asyncHandler(async (req, res) => {
  res.json(await reportService.campaignReport(req.query));
});

const form10bd = asyncHandler(async (req, res) => {
  const { csv } = await reportService.form10bdCsv(req.query.fy);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="form-10bd-${req.query.fy}.csv"`,
    "Cache-Control": "private, no-store",
  });
  res.send(csv);
});

const listCallbacks = asyncHandler(async (_req, res) => {
  res.json({ callbacks: await CallbackRequest.find().sort({ createdAt: -1 }).limit(100).lean() });
});
const updateCallback = asyncHandler(async (req, res) => {
  const doc = await CallbackRequest.findByIdAndUpdate(
    req.params.id,
    { $set: { status: req.body.status } },
    { new: true }
  );
  if (!doc) throw httpError(404, "Request not found", "not_found");
  res.json({ callback: doc });
});

const runSubscriptions = asyncHandler(async (_req, res) => {
  res.json(await reportService.processDueSubscriptions());
});

module.exports = {
  listSchemes,
  getScheme,
  createScheme,
  updateScheme,
  setStatus,
  aiSummary,
  approveSummary,
  discardSummary,
  campaignReport,
  form10bd,
  listCallbacks,
  updateCallback,
  runSubscriptions,
};
