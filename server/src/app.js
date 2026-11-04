const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errors");
const { requireAuth, requireRole } = require("./middleware/auth");
const authController = require("./controllers/authController");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const schemeRoutes = require("./routes/schemes");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/schemes", schemeRoutes);
  app.get("/api/me", requireAuth, authController.me);
  app.use("/api/admin", requireAuth, requireRole("admin"), adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
