const { loadEnv } = require("../src/config/env");

describe("environment configuration", () => {
  it("refuses to start in production with the default JWT secret", () => {
    expect(() => loadEnv({ NODE_ENV: "production", MOCK_WEBHOOK_SECRET: "a-real-webhook-secret" })).toThrow(/JWT_SECRET/);
  });

  it("refuses a short JWT secret in production", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", JWT_SECRET: "too-short-1234", MOCK_WEBHOOK_SECRET: "a-real-webhook-secret" })
    ).toThrow(/JWT_SECRET/);
  });

  it("refuses the default webhook secret in production", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", JWT_SECRET: "0123456789abcdef0123456789abcdef" })
    ).toThrow(/MOCK_WEBHOOK_SECRET/);
  });

  it("starts in production with proper secrets and serves the client by default", () => {
    const env = loadEnv({
      NODE_ENV: "production",
      JWT_SECRET: "0123456789abcdef0123456789abcdef",
      MOCK_WEBHOOK_SECRET: "a-real-webhook-secret",
    });
    expect(env.SERVE_CLIENT).toBe(true);
    expect(env.LLM_PROVIDER).toBe("fallback");
  });

  it("allows development defaults and does not serve the client unless asked", () => {
    const env = loadEnv({ NODE_ENV: "development" });
    expect(env.SERVE_CLIENT).toBe(false);
    expect(env.PORT).toBe(4000);
  });

  it("rejects an unknown AI provider", () => {
    expect(() => loadEnv({ NODE_ENV: "development", LLM_PROVIDER: "openai" })).toThrow();
  });
});
