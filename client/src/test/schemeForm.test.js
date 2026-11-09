import { EMPTY_FORM, formToPayload, formToPublic, schemeToForm, validateForm } from "../pages/admin/schemeForm.js";

const scheme = {
  code: "SCH-014",
  need: "Pension",
  districts: ["Bhopal", "Indore"],
  title: { hi: "राज्य विधवा पेंशन", en: "State widow pension" },
  benefit: { hi: "600 रुपये", en: "600 rupees" },
  whoCanApply: { hi: "विधवा", en: "Widows" },
  howToApply: { hi: "आवेदन दें", en: "Apply" },
  documents: [{ hi: "आधार", en: "Aadhaar" }],
  helpCentre: { name: "Office", district: "Bhopal", address: "Address" },
  sourceUrl: "https://example.gov.in/sch-014",
  lastChecked: "2026-09-12T00:00:00.000Z",
  eligibility: { gender: "female", minAge: 18, maxAge: 79, maritalStatus: "widow", requires: ["bpl_card"] },
  summaryStatus: "approved",
  summaryHi: "सारांश",
};
const t = (k) => k;

describe("admin scheme form", () => {
  it("round-trips a scheme through the form without losing eligibility rules", () => {
    const payload = formToPayload(schemeToForm(scheme), { withCode: true });
    expect(payload.eligibility).toEqual(scheme.eligibility);
    expect(payload.districts).toEqual(["Bhopal", "Indore"]);
    expect(payload.lastChecked).toBe("2026-09-12");
    expect(payload.code).toBe("SCH-014");
  });

  it("leaves empty rules out, so they do not apply", () => {
    const form = { ...schemeToForm(scheme), elig: { ...EMPTY_FORM.elig, womenOnly: false } };
    expect(formToPayload(form, { withCode: false }).eligibility).toEqual({});
  });

  it("does not send the code when editing, and drops half-filled document rows", () => {
    const form = { ...schemeToForm(scheme), docs: [{ hi: "आधार", en: "" }, { hi: "बैंक", en: "Bank" }] };
    const payload = formToPayload(form, { withCode: false });
    expect(payload).not.toHaveProperty("code");
    expect(payload.documents).toEqual([{ hi: "बैंक", en: "Bank" }]);
  });

  it("shows an approved summary in the preview but never a draft", () => {
    const form = schemeToForm(scheme);
    expect(formToPublic(form, { summaryStatus: "approved", summaryHi: "सारांश" }).summaryHi).toBe("सारांश");
    expect(formToPublic(form, { summaryStatus: "draft", summaryHi: "ड्राफ्ट" }).summaryHi).toBe("");
  });

  it("validates required fields, code format, link and age order", () => {
    const empty = validateForm(EMPTY_FORM, { isNew: true }, t);
    expect(empty.code).toBeDefined();
    expect(empty.titleHi).toBeDefined();
    expect(empty.sourceUrl).toBeDefined();
    const bad = schemeToForm(scheme);
    bad.sourceUrl = "javascript:alert(1)";
    bad.elig.minAge = "60";
    bad.elig.maxAge = "40";
    const errors = validateForm(bad, { isNew: false }, t);
    expect(errors.sourceUrl).toBeDefined();
    expect(errors.maxAge).toBeDefined();
    expect(validateForm(schemeToForm(scheme), { isNew: false }, t)).toEqual({});
  });
});
