const { Scheme } = require("../../src/models");

function schemeInput(overrides = {}) {
  return {
    code: "SCH-014",
    title: { hi: "राज्य विधवा पेंशन", en: "State widow pension" },
    need: "Pension",
    districts: ["Bhopal", "Indore"],
    eligibility: { gender: "female", minAge: 18, maxAge: 79, maritalStatus: "widow", requires: ["bpl_card"] },
    benefit: { hi: "प्रति माह 600 रुपये पेंशन।", en: "Pension of 600 rupees a month." },
    whoCanApply: { hi: "18 से 79 वर्ष की विधवा महिलाएँ।", en: "Widows aged 18 to 79." },
    documents: [{ hi: "आधार कार्ड", en: "Aadhaar card" }],
    howToApply: { hi: "जनसेवा केंद्र में आवेदन दें।", en: "Apply at the Jan Seva Kendra." },
    helpCentre: { name: "समाज कल्याण कार्यालय", district: "Bhopal", address: "सतपुड़ा भवन, भोपाल" },
    sourceUrl: "https://example.gov.in/sch-014",
    lastChecked: "2026-09-12",
    ...overrides,
  };
}

async function insertScheme(overrides = {}) {
  const { lastChecked, ...rest } = schemeInput(overrides);
  return Scheme.create({ ...rest, lastChecked: new Date(lastChecked), status: "published" });
}

module.exports = { schemeInput, insertScheme };
