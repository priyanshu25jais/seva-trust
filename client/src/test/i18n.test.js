import hi from "../i18n/hi.json";
import en from "../i18n/en.json";

const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

describe("translations", () => {
  const hiMap = new Map(flat(hi));
  const enMap = new Map(flat(en));

  it("has the same keys in Hindi and English", () => {
    expect([...hiMap.keys()].filter((k) => !enMap.has(k))).toEqual([]);
    expect([...enMap.keys()].filter((k) => !hiMap.has(k))).toEqual([]);
  });

  it("has no empty text", () => {
    for (const [key, value] of [...hiMap, ...enMap]) {
      expect(String(value).trim(), key).not.toBe("");
    }
  });

  it("uses the same {{placeholders}} in both languages", () => {
    const names = (s) => [...String(s).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
    for (const [key, value] of hiMap) {
      expect(names(value), key).toEqual(names(enMap.get(key)));
    }
  });

  it("Hindi text is really Hindi (Devanagari) for the main user-facing strings", () => {
    const mustBeHindi = ["home.headline", "finder.q.gender", "donate.foreignText", "scheme.who"];
    for (const key of mustBeHindi) {
      expect(/[\u0900-\u097F]/.test(hiMap.get(key)), key).toBe(true);
    }
  });
});
