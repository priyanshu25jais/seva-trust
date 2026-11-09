const { z } = require("zod");

const schemesQuerySchema = z.object({
  query: z.object({
    need: z.enum(["Pension", "Livelihood", "Health"]).optional(),
    district: z.string().trim().max(40).optional(),
    q: z.string().trim().max(60).optional(),
  }),
});

const schemeCodeSchema = z.object({
  params: z.object({ code: z.string().trim().min(3).max(20) }),
});

const nullable = (schema) => schema.nullish().transform((v) => (v === undefined ? null : v));

const answersShape = z.object({
  gender: nullable(z.enum(["female", "other"])),
  age: nullable(z.number().int().min(0).max(120)),
  maritalStatus: nullable(z.enum(["single", "married", "widow", "separated"])),
  hasBplCard: nullable(z.boolean()),
  pregnancy: nullable(z.enum(["no", "first", "later"])),
  shgMember: nullable(z.boolean()),
});

const finderSchema = z.object({
  body: z.object({ answers: answersShape }),
});

const callbackSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10 digit mobile number"),
    schemeCode: z.string().trim().max(20).optional(),
    note: z.string().trim().max(300).optional(),
    // DPDP Act 2023: store a phone number only with the person's consent.
    consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
  }),
});

module.exports = { schemesQuerySchema, schemeCodeSchema, finderSchema, callbackSchema, answersShape };
