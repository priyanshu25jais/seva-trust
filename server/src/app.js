const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errors");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
