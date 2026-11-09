const crypto = require("crypto");
const request = require("supertest");
const { startDb, stopDb, clearDb, makeCampaign, makeDonation } = require("./helpers/db");
const { makeUser } = require("./helpers/auth");
const { schemeInput, insertScheme } = require("./helpers/schemes");
const { createApp } = require("../src/app");
const { Scheme, Subscription, Receipt, Donation } = require("../src/models");
const { confirmDonation } = require("../src/services/receiptService");
const { processDueSubscriptions } = require("../src/services/reportService");

const app = createApp();
let admin;
let donor;
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  admin = await makeUser(app, { email: "admin@example.test", role: "admin" });
  donor = await makeUser(app, { email: "donor@example.test" });
});

async function createDraft(overrides) {
  const res = await request(app).post("/api/admin/schemes").set(auth(admin)).send(schemeInput(overrides));
  return res;
}

describe("admin access control", () => {
  it.each([
    ["get", "/api/admin/schemes"],
    ["post", "/api/admin/schemes"],
    ["get", "/api/admin/reports/campaigns"],
    ["get", "/api/admin/reports/form10bd.csv?fy=2026-27"],
    ["get", "/api/admin/callbacks"],
    ["post", "/api/admin/subscriptions/run"],
  ])("%s %s needs login and the admin role", async (method, url) => {
    expect((await request(app)[method](url)).status).toBe(401);
    expect((await request(app)[method](url).set(auth(donor))).status).toBe(403);
  });
});

describe("scheme CMS", () => {
  it("creates a scheme as a draft with an audit entry, invisible to the public", async () => {
    const res = await createDraft();
    expect(res.status).toBe(201);
    expect(res.body.scheme.status).toBe("draft");
    expect(res.body.scheme.audit[0].by).toBe("admin@example.test");
    expect((await request(app).get("/api/schemes/SCH-014")).status).toBe(404);
  });

  it("rejects invalid input: bad code, javascript: link, unknown eligibility key, duplicate code", async () => {
    expect((await createDraft({ code: "ABC" })).status).toBe(400);
    expect((await createDraft({ sourceUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await createDraft({ eligibility: { gender: "female", isAdmin: true } })).status).toBe(400);
    expect((await createDraft({ need: "Weapons" })).status).toBe(400);
    expect((await createDraft()).status).toBe(201);
    expect((await createDraft()).status).toBe(409);
  });

  it("follows draft -> review -> published and shows the scheme publicly only when published", async () => {
    const { body } = await createDraft();
    const id = body.scheme._id;
    const move = (status) => request(app).post(`/api/admin/schemes/${id}/status`).set(auth(admin)).send({ status });

    expect((await move("published")).status).toBe(409); // cannot skip review
    expect((await move("review")).status).toBe(200);
    expect((await request(app).get("/api/schemes/SCH-014")).status).toBe(404);
    expect((await move("published")).status).toBe(200);
    expect((await request(app).get("/api/schemes/SCH-014")).status).toBe(200);
    expect((await move("review")).status).toBe(409); // published can only be unpublished to draft
    expect((await move("draft")).status).toBe(200);
    expect((await request(app).get("/api/schemes/SCH-014")).status).toBe(404);
  });

  it("sends an edited published scheme back to review", async () => {
    const created = await insertScheme();
    const input = schemeInput();
    delete input.code;
    const res = await request(app)
      .put(`/api/admin/schemes/${created._id}`)
      .set(auth(admin))
      .send({ ...input, benefit: { hi: "नया लाभ", en: "New benefit" } });
    expect(res.status).toBe(200);
    expect(res.body.scheme.status).toBe("review");
    expect(res.body.scheme.benefit.en).toBe("New benefit");
    expect((await request(app).get("/api/schemes/SCH-014")).status).toBe(404);
  });

  it("filters the admin list by status and handles unknown ids", async () => {
    await createDraft();
    await insertScheme({ code: "SCH-022", title: { hi: "दूसरी", en: "Second" } });
    const drafts = await request(app).get("/api/admin/schemes?status=draft").set(auth(admin));
    expect(drafts.body.schemes.map((s) => s.code)).toEqual(["SCH-014"]);
    expect((await request(app).get("/api/admin/schemes/64b000000000000000000000").set(auth(admin))).status).toBe(404);
    expect((await request(app).get("/api/admin/schemes/not-an-id").set(auth(admin))).status).toBe(400);
  });
});

describe("Hindi summary drafting and approval (no AI key: template fallback)", () => {
  const NOTICE =
    "Widows aged 18 to 79 who hold a BPL card receive a pension of 600 rupees a month from the state government.";

  async function setup() {
    const { body } = await createDraft();
    const id = body.scheme._id;
    const draft = await request(app).post(`/api/admin/schemes/${id}/ai-summary`).set(auth(admin)).send({ noticeText: NOTICE });
    return { id, draft };
  }

  it("falls back to a labelled template when no AI provider is configured", async () => {
    const { draft } = await setup();
    expect(draft.status).toBe(200);
    expect(draft.body.usedFallback).toBe(true);
    expect(draft.body.scheme.summaryStatus).toBe("draft");
    expect(draft.body.scheme.summaryFlags[0]).toMatch(/^template_used:/);
    expect(draft.body.scheme).not.toHaveProperty("summaryNotice");
  });

  it("blocks approval of a summary whose number is not in the notice", async () => {
    const { id } = await setup();
    const res = await request(app)
      .post(`/api/admin/schemes/${id}/approve-summary`)
      .set(auth(admin))
      .send({ summaryHi: "विधवा महिलाओं को हर महीने ₹900 पेंशन मिलती है।" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("summary_blocked");
    expect((await Scheme.findById(id)).summaryStatus).toBe("draft");
  });

  it("approves an edited, faithful summary and publishes it on the scheme page", async () => {
    const { id } = await setup();
    const move = (status) => request(app).post(`/api/admin/schemes/${id}/status`).set(auth(admin)).send({ status });
    await move("review");
    await move("published");

    expect((await request(app).get("/api/schemes/SCH-014")).body.scheme.summaryHi).toBe("");
    const text = "18 से 79 वर्ष की विधवा महिलाओं को बीपीएल कार्ड होने पर हर महीने 600 रुपये पेंशन मिलती है।";
    const ok = await request(app)
      .post(`/api/admin/schemes/${id}/approve-summary`)
      .set(auth(admin))
      .send({ summaryHi: text });
    expect(ok.status).toBe(200);
    expect(ok.body.scheme.summaryStatus).toBe("approved");
    expect((await request(app).get("/api/schemes/SCH-014")).body.scheme.summaryHi).toBe(text);
  });

  it("can discard a summary, and needs the notice before approval", async () => {
    const { id } = await setup();
    const del = await request(app).delete(`/api/admin/schemes/${id}/summary`).set(auth(admin));
    expect(del.body.scheme.summaryStatus).toBe("none");

    const other = await createDraft({ code: "SCH-015" });
    const res = await request(app)
      .post(`/api/admin/schemes/${other.body.scheme._id}/approve-summary`)
      .set(auth(admin))
      .send({ summaryHi: "विधवा महिलाओं को पेंशन।" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("notice_required");
  });

  it("validates the notice length", async () => {
    const { body } = await createDraft();
    const res = await request(app)
      .post(`/api/admin/schemes/${body.scheme._id}/ai-summary`)
      .set(auth(admin))
      .send({ noticeText: "short" });
    expect(res.status).toBe(400);
  });
});

describe("reports", () => {
  it("totals paid donations by campaign and exports Form 10BD with injection-safe cells", async () => {
    const c1 = await makeCampaign();
    const c2 = await makeCampaign({ slug: "health", title: { hi: "स्वास्थ्य", en: "Health" } });
    const d1 = await makeDonation(c1, { amount: 1000, donorName: "=HYPERLINK(\"http://evil\")" });
    const d2 = await makeDonation(c1, { amount: 3000 });
    await makeDonation(c2, { amount: 500 }); // pending: must not be counted
    await confirmDonation(d1.idempotencyKey, { now: new Date("2026-11-05T10:00:00+05:30") });
    await confirmDonation(d2.idempotencyKey, { now: new Date("2026-11-06T10:00:00+05:30") });

    const report = await request(app).get("/api/admin/reports/campaigns").set(auth(admin));
    const widow = report.body.campaigns.find((c) => c.slug === "widow-support");
    expect(widow).toMatchObject({ donations: 2, total: 4000, average: 2000 });
    expect(report.body.campaigns.find((c) => c.slug === "health").total).toBe(0);
    expect(report.body.totals).toEqual({ donations: 2, total: 4000 });

    const csv = await request(app).get("/api/admin/reports/form10bd.csv?fy=2026-27").set(auth(admin));
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    const lines = csv.text.trim().split("\r\n");
    expect(lines[0]).toBe("receipt_no,receipt_date,donor_name,donor_pan,amount_inr,campaign,financial_year");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"80G/2026-27/000001"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`);

    expect((await request(app).get("/api/admin/reports/form10bd.csv?fy=bad").set(auth(admin))).status).toBe(400);
  });
});

describe("monthly giving (mock)", () => {
  it("charges a due subscription once per month, even if the job runs twice", async () => {
    const campaign = await makeCampaign();
    const first = await makeDonation(campaign, { type: "monthly", amount: 800 });
    await confirmDonation(first.idempotencyKey, { now: new Date("2026-09-05T10:00:00Z") });
    expect(await Subscription.countDocuments()).toBe(1);

    const now = new Date("2026-10-06T00:00:00Z");
    const a = await processDueSubscriptions(now);
    const b = await processDueSubscriptions(now);
    expect(a.processed).toBe(1);
    expect(b.processed).toBe(0);
    expect(await Receipt.countDocuments()).toBe(2);
    // the renewal does not create another subscription
    expect(await Subscription.countDocuments()).toBe(1);
    const sub = await Subscription.findOne();
    expect(sub.nextChargeDate.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(await Donation.countDocuments({ type: "monthly", status: "paid" })).toBe(2);
  });
});

describe("callbacks admin", () => {
  it("lists and updates call-back requests", async () => {
    await request(app).post("/api/callbacks").send({ name: "Sunita", phone: "9876543210", consent: true });
    const list = await request(app).get("/api/admin/callbacks").set(auth(admin));
    expect(list.body.callbacks).toHaveLength(1);
    const id = list.body.callbacks[0]._id;
    const upd = await request(app).patch(`/api/admin/callbacks/${id}`).set(auth(admin)).send({ status: "called" });
    expect(upd.body.callback.status).toBe("called");
    expect((await request(app).patch(`/api/admin/callbacks/${id}`).set(auth(admin)).send({ status: "x" })).status).toBe(400);
  });
});
