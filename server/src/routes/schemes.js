const express = require("express");
const { listSchemes, getScheme, checkEligibility } = require("../controllers/schemeController");
const router = express.Router();
router.get("/", listSchemes);
router.get("/:code", getScheme);
router.post("/eligibility/check", checkEligibility);
module.exports = router;
