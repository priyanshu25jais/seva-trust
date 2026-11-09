const request = require("supertest");
const { startDb, stopDb, clearDb } = require("./helpers/db");
const { insertScheme } = require("./helpers/schemes");
const { createApp } = require("../src/app");
const { Scheme, CallbackRequest } = require("../src/models");

const app = createApp();

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await insertScheme();
  await insertScheme({
    code: "SCH-022",
    title: { hi: "स्व-सहायता समूह ऋण", en: "Self-help group loan support" },
    need: "Livelihood",
    districts: ["Jabalpur"],
    eligibility: { gender: "female", requires: ["registered_shg_membership"], minAge: 18 },
    benefit: { hi: "3 लाख तक का ऋण।", en: "Loan up to 3 lakh." },
  });
  await insertScheme({ code: "SCH-099", title: { hi: "ड्राफ्ट", en: "Hidden draft" } });
  await Scheme.updateOne({ code: "SCH-099" }, { $set: { status: "draft" } });
});

describe("public schemes", () => {
  it("lists only published schemes", async () => {
    const res = await request(app).get("/api/schemes");
    expect(res.status).toBe(200);
    expect(res.body.schemes.map((s) => s.code).sort()).toEqual(["SCH-014", "SCH-022"]);
  });

  it("filters by need and district (a scheme with no districts covers all)", async () => {
    const need = await request(app).get("/api/schemes?need=Livelihood");
    expect(need.body.schemes.map((s) => s.code)).toEqual(["SCH-022"]);
    const district = await request(app).get("/api/schemes?district=Jabalpur");
    expect(district.body.schemes.map((s) => s.code)).toEqual(["SCH-022"]);
    const none = await request(app).get("/api/schemes?district=Nowhere");
    expect(none.body.schemes).toEqual([]);
  });

  it("searches by text and rejects an invalid need", async () => {
    const q = await request(app).get("/api/schemes?q=widow");
    expect(q.body.schemes.map((s) => s.code)).toEqual(["SCH-014"]);
    expect((await request(app).get("/api/schemes?need=Weapons")).status).toBe(400);
    // regex characters in search text are escaped, not interpreted
    expect((await request(app).get("/api/schemes?q=(.*")).status).toBe(200);
  });

  it("shows a scheme with source link and last-checked date, but not internal fields", async () => {
    const res = await request(app).get("/api/schemes/SCH-014");
    expect(res.status).toBe(200);
    const s = res.body.scheme;
    expect(s.sourceUrl).toBe("https://example.gov.in/sch-014");
    expect(new Date(s.lastChecked).toISOString().slice(0, 10)).toBe("2026-09-12");
    expect(s).not.toHaveProperty("audit");
    expect(s).not.toHaveProperty("summaryNotice");
    expect(s).not.toHaveProperty("status");
  });

  it("returns 404 for a draft scheme and for an unknown code", async () => {
    expect((await request(app).get("/api/schemes/SCH-099")).status).toBe(404);
    expect((await request(app).get("/api/schemes/SCH-404")).status).toBe(404);
  });

  it("never exposes an unapproved AI summary, but shows an approved one", async () => {
    await Scheme.updateOne({ code: "SCH-014" }, { $set: { summaryHi: "ड्राफ्ट सारांश", summaryStatus: "draft" } });
    expect((await request(app).get("/api/schemes/SCH-014")).body.scheme.summaryHi).toBe("");
    await Scheme.updateOne({ code: "SCH-014" }, { $set: { summaryStatus: "approved" } });
    expect((await request(app).get("/api/schemes/SCH-014")).body.scheme.summaryHi).toBe("ड्राफ्ट सारांश");
  });

  it("lists the districts that have published schemes", async () => {
    const res = await request(app).get("/api/meta");
    expect(res.body.districts).toEqual(["Bhopal", "Indore", "Jabalpur"]);
    expect(res.body.needs).toEqual(["Pension", "Livelihood", "Health"]);
  });
});

describe("finder API", () => {
  const answers = { gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true };

  it("returns possible matches with the rules used and a not-a-promise marker", async () => {
    const res = await request(app).post("/api/finder/match").send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toBe("possible_match_only");
    expect(res.body.matches[0].scheme.code).toBe("SCH-014");
    expect(res.body.matches[0].rules.length).toBeGreaterThan(0);
    // unpublished schemes are never matched
    expect(res.body.checked).toBe(2);
  });

  it("accepts missing answers as unknown and rejects impossible values", async () => {
    expect((await request(app).post("/api/finder/match").send({ answers: {} })).status).toBe(200);
    expect((await request(app).post("/api/finder/match").send({ answers: { age: 500 } })).status).toBe(400);
    expect((await request(app).post("/api/finder/match").send({ answers: { maritalStatus: "x" } })).status).toBe(400);
    expect((await request(app).post("/api/finder/match").send({})).status).toBe(400);
  });

  it("says the typed/spoken helper is unavailable when no AI provider is configured", async () => {
    const res = await request(app).post("/api/finder/parse").send({ sentence: "मेरी उम्र 50 साल है" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("ai_unavailable");
  });
});

describe("helpline call-back requests", () => {
  const valid = { name: "Sunita Devi", phone: "9876543210", schemeCode: "SCH-014", consent: true };

  it("stores a request with consent", async () => {
    const res = await request(app).post("/api/callbacks").send(valid);
    expect(res.status).toBe(201);
    expect(await CallbackRequest.countDocuments()).toBe(1);
  });

  it("refuses without consent (DPDP) and with a bad phone number", async () => {
    expect((await request(app).post("/api/callbacks").send({ ...valid, consent: false })).status).toBe(400);
    expect((await request(app).post("/api/callbacks").send({ ...valid, consent: undefined })).status).toBe(400);
    expect((await request(app).post("/api/callbacks").send({ ...valid, phone: "12345" })).status).toBe(400);
    expect(await CallbackRequest.countDocuments()).toBe(0);
  });
});

describe("campaigns", () => {
  it("returns 404 for an unknown campaign and an empty list when there are none", async () => {
    expect((await request(app).get("/api/campaigns/none")).status).toBe(404);
    expect((await request(app).get("/api/campaigns")).body.campaigns).toEqual([]);
  });
});
