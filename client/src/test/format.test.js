import { PAN_REGEX, formatDate, formatRupees, newKey, pick } from "../lib/format.js";

describe("format helpers", () => {
  it("groups rupees the Indian way", () => {
    expect(formatRupees(5000)).toBe("₹5,000");
    expect(formatRupees(150000)).toBe("₹1,50,000");
    expect(formatRupees(undefined)).toBe("₹0");
  });

  it("formats dates in India time", () => {
    // 20:00 UTC on 4 Nov is already 5 Nov in India
    expect(formatDate("2026-11-04T20:00:00Z", "en")).toMatch(/5 Nov 2026/);
    expect(formatDate("not a date", "en")).toBe("");
    expect(formatDate(null, "hi")).toBe("");
  });

  it("picks the current language and falls back", () => {
    expect(pick({ hi: "नमस्ते", en: "Hello" }, "en")).toBe("Hello");
    expect(pick({ hi: "नमस्ते" }, "en")).toBe("नमस्ते");
    expect(pick("plain", "hi")).toBe("plain");
    expect(pick(undefined, "hi")).toBe("");
  });

  it("checks PAN format", () => {
    expect(PAN_REGEX.test("ABCDE1234F")).toBe(true);
    expect(PAN_REGEX.test("ABCDE12345")).toBe(false);
    expect(PAN_REGEX.test("abcde1234f")).toBe(false);
  });

  it("makes unique idempotency keys that look like UUIDs", () => {
    const a = newKey();
    const b = newKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
