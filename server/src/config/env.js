const { z } = require("zod");

function loadEnv() {
  const parsed = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      PORT: z.coerce.number().int().positive().default(4000),
      MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/seva-trust"),
      JWT_SECRET: z.string().min(32).default("development-only-secret-change-before-deploy-123456"),
      JWT_EXPIRES_IN: z.string().default("7d"),
      TRUST_PAN: z.string().min(1).default("AAAAA0000A"),
      TRUST_80G_NUMBER: z.string().min(1).default("PLACEHOLDER80G"),
      TRUST_NAME: z.string().min(1).default("Seva Trust"),
      CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
    })
    .parse(process.env);

  return parsed;
}

const env = loadEnv();

module.exports = { env, loadEnv };
