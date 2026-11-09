const crypto = require("crypto");
const request = require("supertest");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { startDb, stopDb, clearDb, makeCampaign } = require("./helpers/db");
const { makeUser } = require("./helpers/auth");
const { createApp } = require("../src/app");
const { Receipt, Donation } = require("../src/models");

const app = createApp();
const WEBHOOK = { "x-webhook-secret": "dev-webhook-secret" };
const GOOD_CARD = { number: "4111 1111 1111 1111", expiry: "12/30", cvv: "123" };

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await makeCampaign();
});

const body = (overrides = {}) => ({
  amount: 1500,
  type: "one-time",
  campaignSlug: "widow-support",
  donorName: "Anita Sharma",
  donorEmail: "anita@example.test",
  pan: "ABCDE1234F",
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});

async function donate(overrides) {
  const payload = body(overrides);
  const res = await request(app).post("/api/donations").send(payload);
  return { payload, res };
}

describe("creating a donation", () => {
  it("lets a visitor donate without an account", async () => {
    const { res } = await donate();
    expect(res.status).toBe(201);
    expect(res.body.donation.status).toBe("pending");
  });

  it("never returns the full PAN", async () => {
    const { res } = await donate();
    expect(JSON.stringify(res.body)).not.toContain("ABCDE1234F");
  });

  it.each([
    ["bad PAN", { pan: "ABCDE12345" }],
    ["lower-case PAN is normalised", null],
    ["amount too small", { amount: 5 }],
    ["amount too large", { amount: 500000 }],
    ["fractional amount", { amount: 10.5 }],
    ["bad email", { donorEmail: "nope" }],
    ["bad idempotency key", { idempotencyKey: "123" }],
    ["unknown type", { type: "weekly" }],
  ])("validates input: %s", async (name, override) => {
    if (override === null) {
      const { res } = await donate({ pan: "abcde1234f" });
      expect(res.status).toBe(201);
      return;
    }
    const { res } = await donate(override);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown campaign", async () => {
    const { res } = await donate({ campaignSlug: "does-not-exist" });
    expect(res.status).toBe(404);
  });

  it("is idempotent: the same key twice gives one donation", async () => {
    const key = crypto.randomUUID();
    const first = await donate({ idempotencyKey: key });
    const second = await donate({ idempotencyKey: key });
    expect(first.res.status).toBe(201);
    expect(second.res.status).toBe(200);
    expect(second.res.body.donation.id).toBe(first.res.body.donation.id);
    expect(await Donation.countDocuments()).toBe(1);
  });

  it("rejects reusing a key for a different amount", async () => {
    const key = crypto.randomUUID();
    await donate({ idempotencyKey: key, amount: 500 });
    const { res } = await donate({ idempotencyKey: key, amount: 900 });
    expect(res.status).toBe(409);
  });
});

describe("mock card payment", () => {
  it("issues a receipt on a successful payment", async () => {
    const { payload } = await donate();
    const res = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: GOOD_CARD });
    expect(res.status).toBe(201);
    expect(res.body.receipt.receiptNo).toMatch(/^80G\/\d{4}-\d{2}\/000001$/);
    expect(res.body.receipt.amount).toBe(1500);
    expect(res.body.receipt.donorPan).not.toBe("ABCDE1234F");
    expect(JSON.stringify(res.body)).not.toContain("4111");
  });

  it("paying twice (double click) returns the same receipt", async () => {
    const { payload } = await donate();
    const pay = () =>
      request(app).post("/api/payments/mock/pay").send({ idempotencyKey: payload.idempotencyKey, card: GOOD_CARD });
    const [a, b, c] = await Promise.all([pay(), pay(), pay()]);
    expect(new Set([a, b, c].map((r) => r.body.receipt.receiptNo)).size).toBe(1);
    expect(await Receipt.countDocuments()).toBe(1);
  });

  it("blocks foreign cards with an FCRA notice and issues nothing", async () => {
    const { payload } = await donate();
    const res = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: { ...GOOD_CARD, number: "4000 0000 0000 0003" } });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("foreign_card_blocked");
    expect(res.body.message).toMatch(/FCRA/);
    expect(await Receipt.countDocuments()).toBe(0);
  });

  it("reports a declined card and issues nothing", async () => {
    const { payload } = await donate();
    const res = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: { ...GOOD_CARD, number: "4000 0000 0000 0002" } });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("card_declined");
    expect(await Receipt.countDocuments()).toBe(0);
  });

  it("validates card fields", async () => {
    const { payload } = await donate();
    const res = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: { number: "12", expiry: "13/99", cvv: "1" } });
    expect(res.status).toBe(400);
  });
});

describe("gateway webhook", () => {
  it("requires the shared secret", async () => {
    const { payload } = await donate();
    const res = await request(app).post("/api/payments/mock/confirm").send({ idempotencyKey: payload.idempotencyKey });
    expect(res.status).toBe(401);
    expect(await Receipt.countDocuments()).toBe(0);
  });

  it("is idempotent when the gateway retries 10 times in parallel", async () => {
    const { payload } = await donate();
    const calls = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post("/api/payments/mock/confirm").set(WEBHOOK).send({ idempotencyKey: payload.idempotencyKey })
      )
    );
    expect(calls.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(calls.map((r) => r.body.receipt.receiptNo)).size).toBe(1);
    expect(await Receipt.countDocuments()).toBe(1);
  });
});

describe("receipt PDF access and content", () => {
  async function paid() {
    const { payload } = await donate();
    const pay = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: GOOD_CARD });
    return { key: payload.idempotencyKey, receipt: pay.body.receipt };
  }

  it("lets a guest download with the donation key, and the PDF carries the required fields", async () => {
    const { key, receipt } = await paid();
    const res = await request(app)
      .get(`/api/receipts/${receipt.id}/pdf?key=${key}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.slice(0, 4).toString()).toBe("%PDF");

    const text = (await pdfParse(res.body)).text;
    expect(text).toContain(receipt.receiptNo);
    expect(text).toContain("Anita Sharma");
    expect(text).toContain("ABCDE1234F"); // donor PAN appears on the certificate
    expect(text).toContain("AAAAA0000A"); // trust PAN
    expect(text).toContain("PLACEHOLDER80G"); // 80G registration number
    expect(text).toContain("1,500");
    expect(text).toContain("One Thousand Five Hundred");
  });

  it("hides the receipt from anyone without the key, an owning account, or admin", async () => {
    const { receipt } = await paid();
    const anon = await request(app).get(`/api/receipts/${receipt.id}/pdf`);
    expect(anon.status).toBe(404);
    const wrongKey = await request(app).get(`/api/receipts/${receipt.id}/pdf?key=${crypto.randomUUID()}`);
    expect(wrongKey.status).toBe(404);
    const stranger = await makeUser(app, { email: "stranger@example.test" });
    const res = await request(app).get(`/api/receipts/${receipt.id}/pdf`).set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(404);
  });

  it("lets the owning donor and an admin download", async () => {
    const owner = await makeUser(app, { email: "owner@example.test" });
    const admin = await makeUser(app, { email: "boss@example.test", role: "admin" });
    const payload = body();
    await request(app).post("/api/donations").set("Authorization", `Bearer ${owner.token}`).send(payload);
    const pay = await request(app)
      .post("/api/payments/mock/pay")
      .send({ idempotencyKey: payload.idempotencyKey, card: GOOD_CARD });
    const id = pay.body.receipt.id;

    const asOwner = await request(app).get(`/api/receipts/${id}/pdf`).set("Authorization", `Bearer ${owner.token}`);
    const asAdmin = await request(app).get(`/api/receipts/${id}/pdf`).set("Authorization", `Bearer ${admin.token}`);
    expect(asOwner.status).toBe(200);
    expect(asAdmin.status).toBe(200);

    const history = await request(app).get("/api/me/donations").set("Authorization", `Bearer ${owner.token}`);
    expect(history.body.donations).toHaveLength(1);
    expect(history.body.donations[0].receipt.receiptNo).toBe(pay.body.receipt.receiptNo);
  });

  it("returns 404 for a malformed receipt id and needs a login for history", async () => {
    expect((await request(app).get("/api/receipts/not-an-id/pdf")).status).toBe(404);
    expect((await request(app).get("/api/me/donations")).status).toBe(401);
  });
});

describe("donation lookup by key (success page refresh)", () => {
  it("returns the donation and its receipt", async () => {
    const { payload } = await donate();
    await request(app).post("/api/payments/mock/pay").send({ idempotencyKey: payload.idempotencyKey, card: GOOD_CARD });
    const res = await request(app).get(`/api/donations/${payload.idempotencyKey}`);
    expect(res.status).toBe(200);
    expect(res.body.donation.status).toBe("paid");
    expect(res.body.donation.receipt.receiptNo).toMatch(/^80G\//);
    expect((await request(app).get("/api/donations/not-a-uuid")).status).toBe(400);
  });
});
