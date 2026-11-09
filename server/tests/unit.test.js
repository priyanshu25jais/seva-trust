const { financialYear, financialYearRange, formatReceiptNo, formatDateIst } = require("../src/utils/financialYear");
const { amountInWords } = require("../src/utils/amountInWords");
const { PAN_REGEX, maskPan } = require("../src/utils/pan");
const { csvCell } = require("../src/services/reportService");

describe("financialYear (India time)", () => {
  it("starts the year on 1 April and ends it on 31 March", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("2026-27");
    expect(financialYear(new Date("2027-03-31T23:59:59+05:30"))).toBe("2026-27");
    expect(financialYear(new Date("2027-04-01T00:00:00+05:30"))).toBe("2027-28");
    expect(financialYear(new Date("2026-03-31T12:00:00+05:30"))).toBe("2025-26");
  });

  it("uses India time, not UTC, around midnight on 1 April", () => {
    // 00:30 IST on 1 April = 19:00 UTC on 31 March
    expect(financialYear(new Date("2027-03-31T19:00:00Z"))).toBe("2027-28");
    // 23:59 IST on 31 March = 18:29 UTC the same day
    expect(financialYear(new Date("2027-03-31T18:29:00Z"))).toBe("2026-27");
  });

  it("handles the century rollover in the label", () => {
    expect(financialYear(new Date("2099-06-01T00:00:00Z"))).toBe("2099-00");
  });

  it("gives the exact range of a financial year in UTC instants", () => {
    const { start, end } = financialYearRange("2026-27");
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2027-03-31T18:30:00.000Z");
  });

  it("formats receipt numbers and dates", () => {
    expect(formatReceiptNo("2026-27", 123)).toBe("80G/2026-27/000123");
    expect(formatDateIst(new Date("2026-11-04T20:00:00Z"))).toBe("05 Nov 2026");
  });

  it("rejects invalid input", () => {
    expect(() => financialYear("not a date")).toThrow();
    expect(() => financialYearRange("2026")).toThrow();
  });
});

describe("amountInWords", () => {
  it.each([
    [10, "Rupees Ten Only"],
    [500, "Rupees Five Hundred Only"],
    [5000, "Rupees Five Thousand Only"],
    [125000, "Rupees One Lakh Twenty Five Thousand Only"],
    [200000, "Rupees Two Lakh Only"],
    [12345678, "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only"],
  ])("%i", (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });

  it("rejects fractions and negatives", () => {
    expect(() => amountInWords(10.5)).toThrow();
    expect(() => amountInWords(-1)).toThrow();
  });
});

describe("PAN helpers", () => {
  it("accepts valid and rejects invalid PAN formats", () => {
    expect(PAN_REGEX.test("ABCDE1234F")).toBe(true);
    expect(PAN_REGEX.test("abcde1234f")).toBe(false);
    expect(PAN_REGEX.test("ABCDE12345")).toBe(false);
    expect(PAN_REGEX.test("ABCD1234F")).toBe(false);
  });
  it("masks the middle of a PAN", () => {
    expect(maskPan("ABCDE1234F")).not.toContain("1234");
  });
});

describe("csvCell (CSV injection guard)", () => {
  it("prefixes formula characters and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+91 98")).toBe(`"'+91 98"`);
    expect(csvCell("Ravi \"R\" Kumar")).toBe(`"Ravi ""R"" Kumar"`);
    expect(csvCell(null)).toBe('""');
  });
});
