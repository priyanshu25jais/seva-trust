const { matchSchemes } = require("../src/services/finderService");

// The three sample schemes from the brief, in the structured form the seed uses.
const SCH_014 = { code: "SCH-014", eligibility: { gender: "female", minAge: 18, maxAge: 79, maritalStatus: "widow", requires: ["bpl_card"] } };
const SCH_022 = { code: "SCH-022", eligibility: { gender: "female", minAge: 18, requires: ["registered_shg_membership"] } };
const SCH_031 = { code: "SCH-031", eligibility: { gender: "female", pregnancy: true, firstChild: true, requires: ["antenatal_registration"] } };
const ALL = [SCH_014, SCH_022, SCH_031];

const blank = { gender: null, age: null, maritalStatus: null, hasBplCard: null, pregnancy: null, shgMember: null };
const codes = (answers, schemes = ALL) => matchSchemes({ ...blank, ...answers }, schemes).matches.map((m) => m.code);

describe("eligibility finder", () => {
  it("matches a widow aged 50 with a BPL card to the widow pension", () => {
    expect(codes({ gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true })).toContain("SCH-014");
  });

  it("includes the rules used, with passed, failed and unknown states", () => {
    const { matches } = matchSchemes(
      { ...blank, gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true },
      [SCH_014]
    );
    const rules = matches[0].rules;
    expect(rules.map((r) => r.status)).toEqual(["passed", "passed", "passed", "passed"]);
    expect(rules.every((r) => r.label.hi && r.label.en)).toBe(true);
  });

  it("respects the age boundaries 18 and 79 and rejects 17 and 80", () => {
    const base = { gender: "female", maritalStatus: "widow", hasBplCard: true };
    expect(codes({ ...base, age: 18 })).toContain("SCH-014");
    expect(codes({ ...base, age: 79 })).toContain("SCH-014");
    expect(codes({ ...base, age: 17 })).not.toContain("SCH-014");
    expect(codes({ ...base, age: 80 })).not.toContain("SCH-014");
  });

  it("does not match a widow without a BPL card", () => {
    expect(codes({ gender: "female", age: 50, maritalStatus: "widow", hasBplCard: false })).not.toContain("SCH-014");
  });

  it("does not match a married woman to the widow pension", () => {
    expect(codes({ gender: "female", age: 50, maritalStatus: "married", hasBplCard: true })).not.toContain("SCH-014");
  });

  it("matches maternity benefit for a first pregnancy, even though one rule cannot be checked", () => {
    const { matches } = matchSchemes({ ...blank, gender: "female", pregnancy: "first" }, [SCH_031]);
    expect(matches).toHaveLength(1);
    expect(matches[0].rules.find((r) => r.key === "requires:antenatal_registration").status).toBe("unknown");
  });

  it("does not match maternity benefit for a later pregnancy", () => {
    expect(codes({ gender: "female", pregnancy: "later" })).not.toContain("SCH-031");
  });

  it("matches the self-help group loan only for SHG members", () => {
    expect(codes({ gender: "female", age: 30, shgMember: true })).toContain("SCH-022");
    expect(codes({ gender: "female", age: 30, shgMember: false })).not.toContain("SCH-022");
  });

  it("treats an unanswered question as unknown, never as failed", () => {
    // BPL card not answered: the widow pension is still possible, with that rule unknown.
    const { matches } = matchSchemes(
      { ...blank, gender: "female", age: 50, maritalStatus: "widow" },
      [SCH_014]
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].rules.find((r) => r.key === "requires:bpl_card").status).toBe("unknown");
  });

  it("returns nothing when no question was answered", () => {
    expect(codes({})).toEqual([]);
  });

  it("returns nothing for applicants who are not women (all schemes are for women)", () => {
    expect(codes({ gender: "other", age: 50, maritalStatus: "widow", hasBplCard: true })).toEqual([]);
  });

  it("ranks the scheme with the most confirmed rules first", () => {
    const result = codes({
      gender: "female", age: 50, maritalStatus: "widow", hasBplCard: true, shgMember: true,
    });
    expect(result[0]).toBe("SCH-014");
    expect(result).toContain("SCH-022");
  });
});
