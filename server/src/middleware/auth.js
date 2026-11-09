const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { httpError } = require("./errors");

function readToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function authOptional(req, _res, next) {
  const token = readToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
  } catch {
    // An expired or invalid token must not block a visitor from donating or from
    // downloading a receipt with their donation key: treat the request as anonymous.
    req.user = null;
  }
  return next();
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) {
    return next(httpError(401, "Login required", "unauthorized"));
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch {
    return next(httpError(401, "Invalid token", "unauthorized"));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(httpError(401, "Login required", "unauthorized"));
    }
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, "Not allowed", "forbidden"));
    }
    return next();
  };
}

module.exports = { authOptional, requireAuth, requireRole };
