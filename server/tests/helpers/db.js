const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const models = require("../../src/models");

// MongoDB transactions need a replica set, so tests run a single-node replica set in memory.
let replSet;

async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Build indexes (the unique ones are part of what we are testing) before any test runs.
  await Promise.all(Object.values(models).map((m) => m.init()));
}

async function stopDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

async function clearDb() {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
}

async function makeCampaign(overrides = {}) {
  return models.Campaign.create({
    slug: "widow-support",
    title: { hi: "विधवा सहायता कोष", en: "Widow support fund" },
    goal: 500000,
    active: true,
    ...overrides,
  });
}

let counter = 0;
async function makeDonation(campaign, overrides = {}) {
  counter += 1;
  return models.Donation.create({
    campaign: campaign._id,
    amount: 500,
    type: "one-time",
    status: "pending",
    idempotencyKey: crypto.randomUUID(),
    donorName: `Donor ${counter}`,
    donorEmail: `donor${counter}@example.test`,
    donorPan: "ABCDE1234F",
    ...overrides,
  });
}

module.exports = { startDb, stopDb, clearDb, makeCampaign, makeDonation };
