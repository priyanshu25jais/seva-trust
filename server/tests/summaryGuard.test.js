const { checkSummary, extractNumbers, wordCount } = require("../src/utils/summaryGuard");

const NOTICE =
  "Widows aged 18 to 79 who hold a BPL card receive a pension of Rs 600 a month. Maternity benefit 5,000 in instalments. Loan up to 3 lakh.";

describe("summary guardrails", () => {
  it("accepts a faithful Hindi summary", () => {
    const r = checkSummary({
      summary: "18 से 79 वर्ष की विधवा महिलाओं को बीपीएल कार्ड होने पर हर महीने ₹600 पेंशन मिलती है।",
      notice: NOTICE,
    });
    expect(r.blocking).toEqual([]);
    expect(r.flags).toEqual([]);
  });

  it("blocks a summary with a number that is not in the notice", () => {
    const r = checkSummary({ summary: "विधवा महिलाओं को हर महीने ₹700 पेंशन मिलती है।", notice: NOTICE });
    expect(r.blocking).toContain("number_not_in_notice:700");
  });

  it("treats Devanagari digits and comma formatting as the same number", () => {
    expect(extractNumbers("५,००० और ६००")).toEqual(["5000", "600"]);
    const r = checkSummary({ summary: "किस्तों में ₹५,००० मिलते हैं।", notice: NOTICE });
    expect(r.blocking).toEqual([]);
  });

  it("blocks English-only output", () => {
    const r = checkSummary({ summary: "Widows get 600 a month.", notice: NOTICE });
    expect(r.blocking).toContain("not_mostly_hindi");
  });

  it("blocks an over-long summary", () => {
    const long = Array.from({ length: 90 }, () => "योजना").join(" ");
    expect(wordCount(long)).toBe(90);
    const r = checkSummary({ summary: long, notice: NOTICE });
    expect(r.blocking.some((b) => b.startsWith("too_long"))).toBe(true);
  });

  it("blocks an empty summary", () => {
    expect(checkSummary({ summary: "  ", notice: NOTICE }).blocking).toContain("empty_summary");
  });

  it("flags what the model said it was unsure about, without blocking", () => {
    const r = checkSummary({
      summary: "विधवा महिलाओं को पेंशन मिलती है।",
      notice: NOTICE,
      unsure: ["income limit is not stated"],
    });
    expect(r.blocking).toEqual([]);
    expect(r.flags).toEqual(["model_unsure:income limit is not stated"]);
  });
});
