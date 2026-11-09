const { z } = require("zod");
const { PAN_REGEX } = require("../utils/pan");

const uuid = z.string().uuid();

const createDonationSchema = z.object({
  body: z.object({
    amount: z.number().int().min(10).max(200000),
    type: z.enum(["one-time", "monthly"]),
    campaignSlug: z.string().min(1).max(80),
    donorName: z.string().trim().min(2).max(80),
    donorEmail: z.string().trim().toLowerCase().email().max(120),
    // Uppercased first so "abcde1234f" is accepted, then checked against the PAN format.
    pan: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => PAN_REGEX.test(v), "PAN must look like ABCDE1234F"),
    idempotencyKey: uuid,
  }),
});

const payMockSchema = z.object({
  body: z.object({
    idempotencyKey: uuid,
    card: z.object({
      number: z.string().regex(/^[\d\s-]{12,23}$/, "Enter a valid card number"),
      expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
      cvv: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit code"),
    }),
  }),
});

const confirmWebhookSchema = z.object({
  body: z.object({ idempotencyKey: uuid }),
});

const donationKeySchema = z.object({
  params: z.object({ key: uuid }),
});

module.exports = { createDonationSchema, payMockSchema, confirmWebhookSchema, donationKeySchema };
