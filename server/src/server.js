const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { connectDb } = require("./config/db");
const { env } = require("./config/env");
const { app } = require("./app");

async function start() {
  await connectDb();
  app.listen(env.PORT, () => {
    console.log(`Seva Trust API listening on port ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
