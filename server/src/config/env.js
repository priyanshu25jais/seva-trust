const { z } = require("zod");

const DEV_JWT_SECRET = "test-only-jwt-secret-do-not-use";
const DEV_WEBHOOK_SECRET = "dev-webhook-secret";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

function loadEnv(source = process.env) {
  const parsed = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      PORT: z.coerce.number().int().positive().default(4000),
      MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/seva-trust"),
      JWT_SECRET: z.string().min(8).default(DEV_JWT_SECRET),
      JWT_EXPIRES_IN: z.string().default("7d"),
      TRUST_PAN: z.string().min(1).default("AAAAA0000A"),
      TRUST_80G_NUMBER: z.string().min(1).default("PLACEHOLDER80G"),
      TRUST_NAME: z.string().min(1).default("Seva Trust"),
      TRUST_NAME_HI: z.string().min(1).default("सेवा ट्रस्ट"),
      CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
      // Shared secret for the mock payment-gateway webhook (POST /api/payments/mock/confirm).
      MOCK_WEBHOOK_SECRET: z.string().min(8).default(DEV_WEBHOOK_SECRET),
      // AI provider for Hindi scheme summaries: gemini | groq | fallback (template, no AI).
      LLM_PROVIDER: z.enum(["gemini", "groq", "fallback"]).default("fallback"),
      LLM_API_KEY: z.string().optional(),
      LLM_MODEL: z.string().optional(),
      // Rate limits per IP per 15 minutes. Campaign days share one IP, so keep donate generous.
      RATE_LIMIT_DONATE_MAX: z.coerce.number().int().positive().default(300),
      RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(30),
      // Serve the built React client from this server (single-service deployment).
      SERVE_CLIENT: bool.optional(),
    })
    .parse(source);

  if (parsed.NODE_ENV === "production") {
    if (parsed.JWT_SECRET === DEV_JWT_SECRET || parsed.JWT_SECRET.length < 24) {
      throw new Error("JWT_SECRET must be set to a long random value in production");
    }
    if (parsed.MOCK_WEBHOOK_SECRET === DEV_WEBHOOK_SECRET) {
      throw new Error("MOCK_WEBHOOK_SECRET must be set in production");
    }
  }

  return { ...parsed, SERVE_CLIENT: parsed.SERVE_CLIENT ?? parsed.NODE_ENV === "production" };
}

const env = loadEnv();

module.exports = { env, loadEnv };
