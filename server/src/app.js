const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errors");
const { requireAuth, requireRole } = require("./middleware/auth");
const { authLimiter } = require("./middleware/rateLimit");
const authController = require("./controllers/authController");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const donationRoutes = require("./routes/donations");

const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");

function createApp() {
  const app = express();

  // Behind Render/Railway the client IP comes from the proxy header (needed for rate limits).
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.get("/api/me", requireAuth, authController.me);
  app.use("/api/admin", requireAuth, requireRole("admin"), adminRoutes);
  app.use("/api", publicRoutes);
  app.use("/api", donationRoutes);

  // Unknown API routes get a JSON 404, never the web page.
  app.use("/api", notFound);

  // Single-service deployment: the same server serves the built React app.
  if (env.SERVE_CLIENT && fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
    app.use(express.static(CLIENT_DIST, { maxAge: "1h" }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
