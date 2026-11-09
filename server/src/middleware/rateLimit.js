const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const isTest = env.NODE_ENV === "test";

function limiter(max, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    limit: isTest ? 100000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited", message: "Too many requests. Please try again later." },
  });
}

module.exports = {
  authLimiter: limiter(env.RATE_LIMIT_AUTH_MAX),
  donateLimiter: limiter(env.RATE_LIMIT_DONATE_MAX),
  callbackLimiter: limiter(10, 60 * 60 * 1000),
  aiLimiter: limiter(40),
};
