const express = require("express");
const c = require("../controllers/publicController");
const { validate } = require("../middleware/validate");
const { callbackLimiter, aiLimiter } = require("../middleware/rateLimit");
const v = require("../validation/public");
const { z } = require("zod");

const router = express.Router();

const parseSchema = z.object({
  body: z.object({ sentence: z.string().trim().min(3).max(400) }),
});
const slugSchema = z.object({ params: z.object({ slug: z.string().trim().min(1).max(80) }) });

router.get("/meta", c.meta);
router.get("/schemes", validate(v.schemesQuerySchema), c.listSchemes);
router.get("/schemes/:code", validate(v.schemeCodeSchema), c.getScheme);
router.post("/finder/match", validate(v.finderSchema), c.finderMatch);
router.post("/finder/parse", aiLimiter, validate(parseSchema), c.finderParse);
router.get("/campaigns", c.listCampaigns);
router.get("/campaigns/:slug", validate(slugSchema), c.getCampaign);
router.post("/callbacks", callbackLimiter, validate(v.callbackSchema), c.createCallback);

module.exports = router;
