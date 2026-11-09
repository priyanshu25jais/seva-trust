const express = require("express");
const c = require("../controllers/adminController");
const { validate } = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const v = require("../validation/admin");

// Mounted in app.js behind requireAuth and requireRole("admin").
const router = express.Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true });
});

router.get("/schemes", validate(v.listSchemesSchema), c.listSchemes);
router.post("/schemes", validate(v.createSchemeSchema), c.createScheme);
router.get("/schemes/:id", validate(v.idSchema), c.getScheme);
router.put("/schemes/:id", validate(v.updateSchemeSchema), c.updateScheme);
router.post("/schemes/:id/status", validate(v.statusSchema), c.setStatus);
router.post("/schemes/:id/ai-summary", aiLimiter, validate(v.aiSummarySchema), c.aiSummary);
router.post("/schemes/:id/approve-summary", validate(v.approveSummarySchema), c.approveSummary);
router.delete("/schemes/:id/summary", validate(v.idSchema), c.discardSummary);

router.get("/reports/campaigns", validate(v.reportQuerySchema), c.campaignReport);
router.get("/reports/form10bd.csv", validate(v.form10bdSchema), c.form10bd);

router.get("/callbacks", c.listCallbacks);
router.patch("/callbacks/:id", validate(v.callbackStatusSchema), c.updateCallback);

router.post("/subscriptions/run", c.runSubscriptions);

module.exports = router;
