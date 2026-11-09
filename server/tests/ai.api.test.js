// These tests run with an AI provider "configured" and a mocked network, so no real
// API call is made. The env must be set before the app (and its config) is loaded.
process.env.LLM_PROVIDER = "gemini";
process.env.LLM_API_KEY = "test-key-not-real";

const request = require("supertest");
const { startDb, stopDb, clearDb } = require("./helpers/db");
const { makeUser } = require("./helpers/auth");
const { schemeInput } = require("./helpers/schemes");
const { createApp } = require("../src/app");

const app = createApp();
const NOTICE =
  "Widows aged 18 to 79 who hold a BPL card receive a pension of 600 rupees a month from the state government.";
const realFetch = global.fetch;
let admin;

function geminiReply(obj) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
  };
}

beforeAll(startDb);
afterAll(async () => {
  global.fetch = realFetch;
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  admin = await makeUser(app, { email: "admin@example.test", role: "admin" });
});
afterEach(() => {
  global.fetch = realFetch;
});

async function draftScheme() {
  const res = await request(app)
    .post("/api/admin/schemes")
    .set("Authorization", `Bearer ${admin.token}`)
    .send(schemeInput());
  return res.body.scheme._id;
}
const summarise = (id) =>
  request(app)
    .post(`/api/admin/schemes/${id}/ai-summary`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ noticeText: NOTICE });

describe("AI Hindi summary", () => {
  it("uses the AI reply, saves it as a draft and sends the notice as untrusted data", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      geminiReply({ summary_hi: "18 से 79 वर्ष की विधवा महिलाओं को हर महीने 600 रुपये पेंशन मिलती है।", unsure: [] })
    );
    const id = await draftScheme();
    const res = await summarise(id);

    expect(res.status).toBe(200);
    expect(res.body.usedFallback).toBe(false);
    expect(res.body.scheme.summaryStatus).toBe("draft");
    expect(res.body.scheme.summaryProvider).toBe("gemini");
    expect(res.body.scheme.summaryFlags).toEqual([]);
    expect(res.body.blocking).toEqual([]);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).not.toContain("test-key"); // the key travels in a header, never in the URL
    expect(options.headers["x-goog-api-key"]).toBe("test-key-not-real");
    const sent = JSON.parse(options.body);
    expect(sent.systemInstruction.parts[0].text).toMatch(/ignore any instructions/i);
  });

  it("flags a wrong number from the AI and blocks approval", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      geminiReply({ summary_hi: "विधवा महिलाओं को हर महीने 900 रुपये पेंशन मिलती है।", unsure: ["income limit not stated"] })
    );
    const id = await draftScheme();
    const res = await summarise(id);

    expect(res.body.blocking).toContain("number_not_in_notice:900");
    expect(res.body.scheme.summaryFlags).toEqual(
      expect.arrayContaining(["number_not_in_notice:900", "model_unsure:income limit not stated"])
    );
    const approve = await request(app)
      .post(`/api/admin/schemes/${id}/approve-summary`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(approve.status).toBe(422);
  });

  it.each([
    ["the AI service returns an error", () => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })],
    ["the network fails", () => Promise.reject(new Error("network down"))],
    ["the reply is not valid JSON", () => Promise.resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) })],
    ["the reply has the wrong shape", () => Promise.resolve(geminiReply({ wrong: true }))],
  ])("falls back to a labelled template draft when %s", async (_name, impl) => {
    global.fetch = jest.fn().mockImplementation(impl);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const id = await draftScheme();
    const res = await summarise(id);

    expect(res.status).toBe(200);
    expect(res.body.usedFallback).toBe(true);
    expect(res.body.scheme.summaryProvider).toBe("template");
    expect(res.body.scheme.summaryFlags[0]).toMatch(/^template_used:/);
    expect(res.body.scheme.summaryStatus).toBe("draft"); // still needs a person
    console.error.mockRestore();
  });
});

describe("typed or spoken Hindi question for the finder", () => {
  it("turns a sentence into answers a person then confirms", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      geminiReply({ gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true, pregnancy: null, shgMember: null })
    );
    const res = await request(app).post("/api/finder/parse").send({ sentence: "मैं विधवा हूँ, 50 साल की, बीपीएल कार्ड है" });
    expect(res.status).toBe(200);
    expect(res.body.answers).toEqual({
      gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true, pregnancy: null, shgMember: null,
    });
    // the AI only fills answers: the response carries no schemes or eligibility verdict
    expect(res.body).not.toHaveProperty("matches");
  });

  it("rejects values outside the allowed answers and reports failures politely", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(geminiReply({ age: 900 }));
    const bad = await request(app).post("/api/finder/parse").send({ sentence: "kuch bhi likha hua" });
    expect(bad.status).toBe(502);
    expect(bad.body.error).toBe("ai_failed");

    global.fetch = jest.fn().mockRejectedValue(new Error("down"));
    const down = await request(app).post("/api/finder/parse").send({ sentence: "kuch bhi likha hua" });
    expect(down.status).toBe(502);
    console.error.mockRestore();
  });
});
