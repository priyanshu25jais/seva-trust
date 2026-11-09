const crypto = require("crypto");
const mongoose = require("mongoose");
const { Receipt, Donation } = require("../models");
const { env } = require("../config/env");
const { httpError } = require("../middleware/errors");
const donationService = require("../services/donationService");
const paymentService = require("../services/paymentService");
const { getReceiptPdf } = require("../services/pdfService");
const { asyncHandler } = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const { donation, campaign, created } = await donationService.createDonation(req.body, req.user);
  res
    .status(created ? 201 : 200)
    .json({ donation: donationService.donationView(donation, null, campaign) });
});

const getByKey = asyncHandler(async (req, res) => {
  res.json({ donation: await donationService.getDonationByKey(req.params.key) });
});

const payMock = asyncHandler(async (req, res) => {
  const { receipt, created } = await paymentService.payWithMockCard(
    req.body.idempotencyKey,
    req.body.card
  );
  res.status(created ? 201 : 200).json({ receipt });
});

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Mock gateway webhook. Requires the shared secret so nobody can mark a donation paid.
const webhookConfirm = asyncHandler(async (req, res) => {
  if (!safeEqual(req.get("x-webhook-secret") || "", env.MOCK_WEBHOOK_SECRET)) {
    throw httpError(401, "Invalid webhook secret", "unauthorized");
  }
  const { receipt, created } = await paymentService.confirmFromWebhook(req.body.idempotencyKey);
  res.status(created ? 201 : 200).json({ receipt });
});

const myDonations = asyncHandler(async (req, res) => {
  res.json({ donations: await donationService.listDonationsForDonor(req.user.id) });
});

/**
 * Download the 80G certificate. Allowed for: the donor who owns the donation, an admin,
 * or a guest who holds the donation's idempotency key (?key=...).
 */
const receiptPdf = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw httpError(404, "Receipt not found", "not_found");
  }
  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) throw httpError(404, "Receipt not found", "not_found");
  const donation = await Donation.findById(receipt.donation);

  const user = req.user;
  const isAdmin = user && user.role === "admin";
  const isOwner = user && donation && donation.donor && donation.donor.toString() === user.id;
  const hasKey = donation && req.query.key && safeEqual(req.query.key, donation.idempotencyKey);
  if (!isAdmin && !isOwner && !hasKey) {
    // 404 rather than 403 so receipt ids cannot be probed.
    throw httpError(404, "Receipt not found", "not_found");
  }

  const pdf = await getReceiptPdf(receipt);
  const filename = `80G-${receipt.receiptNo.replace(/\//g, "-")}.pdf`;
  res.set({
    "Content-Type": "application/pdf",
    "Content-Length": pdf.length,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(pdf);
});

module.exports = { create, getByKey, payMock, webhookConfirm, myDonations, receiptPdf };
