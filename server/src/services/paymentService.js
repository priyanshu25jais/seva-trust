const { Donation, Receipt } = require("../models");
const { httpError } = require("../middleware/errors");
const { confirmDonation, receiptView } = require("./receiptService");

// Mock payment gateway. Test cards (assumption: the brief only says "test mode"):
//   4111 1111 1111 1111  succeeds (Indian card)
//   4000 0000 0000 0002  is declined
//   4000 0000 0000 0003  is a foreign card and is blocked (FCRA)
// Card numbers are checked and then discarded. They are never stored or logged.
const TEST_CARDS = {
  "4111111111111111": "ok",
  "4000000000000002": "declined",
  "4000000000000003": "foreign",
};

function evaluateCard(number) {
  const digits = String(number).replace(/\s|-/g, "");
  return TEST_CARDS[digits] || "unknown";
}

async function payWithMockCard(idempotencyKey, card) {
  const donation = await Donation.findOne({ idempotencyKey });
  if (!donation) throw httpError(404, "Donation not found", "not_found");

  // Paying again for something already paid just shows the same receipt.
  const existing = await Receipt.findOne({ donation: donation._id });
  if (existing) return { receipt: receiptView(existing), created: false };

  const outcome = evaluateCard(card.number);
  if (outcome === "foreign") {
    throw httpError(
      422,
      "Foreign cards cannot be used. Foreign contributions need an FCRA account.",
      "foreign_card_blocked"
    );
  }
  if (outcome === "declined") {
    throw httpError(402, "The card was declined. Try another card.", "card_declined");
  }
  if (outcome !== "ok") {
    throw httpError(402, "Use a test card, for example 4111 1111 1111 1111.", "card_declined");
  }

  const { receipt, created } = await confirmDonation(idempotencyKey);
  return { receipt: receiptView(receipt), created };
}

// Called by the gateway (our mock) after it has taken the payment.
async function confirmFromWebhook(idempotencyKey) {
  const { receipt, created } = await confirmDonation(idempotencyKey);
  return { receipt: receiptView(receipt), created };
}

module.exports = { payWithMockCard, confirmFromWebhook, evaluateCard };
