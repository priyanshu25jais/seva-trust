const express = require("express");
const c = require("../controllers/donationController");
const { validate } = require("../middleware/validate");
const { authOptional, requireAuth } = require("../middleware/auth");
const { donateLimiter } = require("../middleware/rateLimit");
const v = require("../validation/donations");

const router = express.Router();

router.post("/donations", donateLimiter, authOptional, validate(v.createDonationSchema), c.create);
router.get("/donations/:key", validate(v.donationKeySchema), c.getByKey);

router.post("/payments/mock/pay", donateLimiter, validate(v.payMockSchema), c.payMock);
// Webhook is called by the gateway with a shared secret, so it is not rate limited by IP.
router.post("/payments/mock/confirm", validate(v.confirmWebhookSchema), c.webhookConfirm);

router.get("/receipts/:id/pdf", authOptional, c.receiptPdf);
router.get("/me/donations", requireAuth, c.myDonations);

module.exports = router;
