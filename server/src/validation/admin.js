const { z } = require("zod");

const bilingual = z.object({
  hi: z.string().trim().min(1).max(600),
  en: z.string().trim().min(1).max(600),
});

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  // Scheme pages render this as a link, so only http(s) is allowed (no javascript: URLs).
  .refine((u) => /^https?:\/\//i.test(u), "Use an http or https link");

const eligibility = z
  .object({
    gender: z.enum(["female"]).optional(),
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
    maritalStatus: z.enum(["single", "married", "widow", "separated"]).optional(),
    pregnancy: z.boolean().optional(),
    firstChild: z.boolean().optional(),
    requires: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
    minDisabilityPercent: z.number().int().min(1).max(100).optional(),
    occupation: z.string().trim().max(60).optional(),
    rural: z.boolean().optional(),
  })
  .strict();

const schemeBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^SCH-\d{3,4}$/, "Use a code like SCH-045"),
  title: bilingual,
  need: z.enum(["Pension", "Livelihood", "Health"]),
  districts: z.array(z.string().trim().min(1).max(40)).max(20),
  eligibility,
  benefit: bilingual,
  whoCanApply: bilingual,
  documents: z.array(bilingual).max(15),
  howToApply: bilingual,
  helpCentre: z.object({
    name: z.string().trim().min(1).max(120),
    district: z.string().trim().min(1).max(40),
    address: z.string().trim().min(1).max(200),
  }),
  sourceUrl: httpUrl,
  lastChecked: z.coerce.date(),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const createSchemeSchema = z.object({ body: schemeBody });
const updateSchemeSchema = z.object({
  params: z.object({ id: objectId }),
  body: schemeBody.omit({ code: true }),
});
const idSchema = z.object({ params: z.object({ id: objectId }) });
const statusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum(["draft", "review", "published"]) }),
});
const aiSummarySchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ noticeText: z.string().trim().min(20).max(8000) }),
});
const approveSummarySchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ summaryHi: z.string().trim().min(1).max(1200).optional() }),
});
const listSchemesSchema = z.object({
  query: z.object({
    status: z.enum(["draft", "review", "published"]).optional(),
    q: z.string().trim().max(60).optional(),
  }),
});
const reportQuerySchema = z.object({
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});
const form10bdSchema = z.object({
  query: z.object({ fy: z.string().regex(/^\d{4}-\d{2}$/, "Use a year like 2026-27") }),
});
const callbackStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum(["new", "called"]) }),
});

module.exports = {
  createSchemeSchema,
  updateSchemeSchema,
  idSchema,
  statusSchema,
  aiSummarySchema,
  approveSummarySchema,
  listSchemesSchema,
  reportQuerySchema,
  form10bdSchema,
  callbackStatusSchema,
};
