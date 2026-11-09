const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const bcrypt = require("bcryptjs");
const { connectDb, disconnectDb } = require("../config/db");
const {
  Scheme,
  User,
  Campaign,
  Donation,
  Receipt,
  Counter,
  Subscription,
  CallbackRequest,
} = require("../models");
const crypto = require("crypto");
const { confirmDonation } = require("../services/receiptService");
const { PAN_REGEX } = require("../utils/pan");

const DEMO_PASSWORD = "DemoPass123";
const FAKE_DONOR_COUNT = 50;

const FIRST_NAMES = [
  "Anita",
  "Rekha",
  "Sunita",
  "Meena",
  "Kavita",
  "Pooja",
  "Neha",
  "Rani",
  "Sarla",
  "Geeta",
];
const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Patel",
  "Yadav",
  "Mishra",
  "Tiwari",
  "Jain",
  "Gupta",
  "Singh",
  "Khan",
];

function sourceUrl(code) {
  return `https://example.gov.in/${code.toLowerCase()}`;
}

function publishedAudit() {
  return [{ by: "seed", at: new Date("2026-11-01T00:00:00.000Z"), action: "publish" }];
}

function fakePan(index) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const a = letters[index % 26];
  const b = letters[(index * 3) % 26];
  const c = letters[(index * 7) % 26];
  const e = letters[(index * 11) % 26];
  const last = letters[(index * 13) % 26];
  const digits = String(1000 + (index % 9000)).slice(-4);
  return `${a}${b}${c}P${e}${digits}${last}`;
}

const schemes = [
  {
    code: "SCH-014",
    title: {
      hi: "राज्य विधवा पेंशन",
      en: "State widow pension",
    },
    need: "Pension",
    districts: ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Sagar"],
    eligibility: {
      gender: "female",
      minAge: 18,
      maxAge: 79,
      maritalStatus: "widow",
      requires: ["bpl_card"],
    },
    benefit: {
      hi: "प्रति माह 600 रुपये पेंशन।",
      en: "Pension of 600 rupees a month.",
    },
    whoCanApply: {
      hi: "18 से 79 वर्ष की विधवा महिलाएँ जिनके पास बीपीएल कार्ड है।",
      en: "Widows aged 18 to 79 who hold a BPL card.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "बीपीएल कार्ड", en: "BPL card" },
      { hi: "पति का मृत्यु प्रमाण पत्र", en: "Husband’s death certificate" },
      { hi: "बैंक पासबुक", en: "Bank passbook" },
    ],
    howToApply: {
      hi: "नज़दीकी जनसेवा केंद्र या समाज कल्याण कार्यालय में आवेदन दें।",
      en: "Apply at the nearest Jan Seva Kendra or social welfare office.",
    },
    helpCentre: {
      name: "समाज कल्याण कार्यालय, भोपाल",
      district: "Bhopal",
      address: "सतपुड़ा भवन परिसर, भोपाल",
    },
    sourceUrl: sourceUrl("SCH-014"),
    lastChecked: new Date("2026-09-12"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  {
    code: "SCH-022",
    title: {
      hi: "स्व-सहायता समूह ऋण सहायता",
      en: "Self-help group loan support",
    },
    need: "Livelihood",
    districts: ["Bhopal", "Indore", "Jabalpur"],
    eligibility: {
      gender: "female",
      requires: ["registered_shg_membership"],
    },
    benefit: {
      hi: "कम ब्याज पर अधिकतम 3 लाख रुपये तक ऋण।",
      en: "Loan of up to 3 lakh rupees at a lower interest rate.",
    },
    whoCanApply: {
      hi: "पंजीकृत स्व-सहायता समूह की सदस्य महिलाएँ।",
      en: "Women who are members of a registered self-help group.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "एसएचजी पंजीकरण प्रमाण", en: "SHG registration proof" },
      { hi: "समूह प्रस्ताव", en: "Group resolution" },
      { hi: "बैंक पासबुक", en: "Bank passbook" },
    ],
    howToApply: {
      hi: "अपने समूह के माध्यम से जिला महिला एवं बाल विकास कार्यालय में आवेदन करें।",
      en: "Apply through your group at the district women and child development office.",
    },
    helpCentre: {
      name: "महिला एवं बाल विकास कार्यालय, इंदौर",
      district: "Indore",
      address: "कलेक्टोरेट परिसर, इंदौर",
    },
    sourceUrl: sourceUrl("SCH-022"),
    lastChecked: new Date("2026-08-30"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  {
    code: "SCH-031",
    title: {
      hi: "मातृत्व नकद लाभ",
      en: "Maternity cash benefit",
    },
    need: "Health",
    districts: ["Bhopal", "Gwalior", "Sagar"],
    eligibility: {
      gender: "female",
      pregnancy: true,
      firstChild: true,
      requires: ["antenatal_registration"],
    },
    benefit: {
      hi: "किस्तों में 5,000 रुपये नकद सहायता।",
      en: "5,000 rupees in instalments.",
    },
    whoCanApply: {
      hi: "पहली संतान की गर्भवती महिलाएँ जो स्वास्थ्य केंद्र में पंजीकृत हैं।",
      en: "Pregnant women expecting their first child and registered at a health centre.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "एमसीपी कार्ड", en: "MCP card" },
      { hi: "बैंक पासबुक", en: "Bank passbook" },
    ],
    howToApply: {
      hi: "आंगनवाड़ी या प्राथमिक स्वास्थ्य केंद्र पर पंजीकरण कराएँ।",
      en: "Register at an anganwadi or primary health centre.",
    },
    helpCentre: {
      name: "जिला स्वास्थ्य कार्यालय, सागर",
      district: "Sagar",
      address: "सिविल लाइन, सागर",
    },
    sourceUrl: sourceUrl("SCH-031"),
    lastChecked: new Date("2026-10-05"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-041",
    title: {
      hi: "निराश्रित वृद्ध महिलाओं की पेंशन",
      en: "Destitute elderly women’s pension",
    },
    need: "Pension",
    districts: ["Sagar", "Jabalpur"],
    eligibility: {
      gender: "female",
      minAge: 60,
      requires: ["income_certificate"],
    },
    benefit: {
      hi: "प्रति माह 500 रुपये सहायता।",
      en: "Support of 500 rupees a month.",
    },
    whoCanApply: {
      hi: "60 वर्ष या अधिक की महिलाएँ जिनकी नियमित आय नहीं है।",
      en: "Women aged 60 or more with no regular income.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "आयु प्रमाण", en: "Age proof" },
      { hi: "आय प्रमाण पत्र", en: "Income certificate" },
    ],
    howToApply: {
      hi: "ग्राम पंचायत या नगर निगम के समाज कल्याण कक्ष में फॉर्म भरें।",
      en: "Fill the form at the gram panchayat or municipal social welfare desk.",
    },
    helpCentre: {
      name: "समाज कल्याण कक्ष, सागर",
      district: "Sagar",
      address: "कलेक्टोरेट, सागर",
    },
    sourceUrl: sourceUrl("SCH-041"),
    lastChecked: new Date("2026-07-18"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-042",
    title: {
      hi: "दिव्यांग महिलाओं की पेंशन",
      en: "Disability pension for women",
    },
    need: "Pension",
    districts: ["Gwalior", "Bhopal"],
    eligibility: {
      gender: "female",
      minDisabilityPercent: 40,
      requires: ["udid_card"],
    },
    benefit: {
      hi: "प्रति माह 600 रुपये पेंशन।",
      en: "Pension of 600 rupees a month.",
    },
    whoCanApply: {
      hi: "40 प्रतिशत या अधिक दिव्यांगता वाली महिलाएँ जिनके पास यूडीआईडी कार्ड है।",
      en: "Women with 40 percent or more disability who hold a UDID card.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "यूडीआईडी कार्ड", en: "UDID card" },
      { hi: "बैंक पासबुक", en: "Bank passbook" },
    ],
    howToApply: {
      hi: "जिला दिव्यांगजन कल्याण कार्यालय में आवेदन जमा करें।",
      en: "Submit the application at the district disability welfare office.",
    },
    helpCentre: {
      name: "दिव्यांगजन कल्याण कार्यालय, ग्वालियर",
      district: "Gwalior",
      address: "मोती महल परिसर, ग्वालियर",
    },
    sourceUrl: sourceUrl("SCH-042"),
    lastChecked: new Date("2026-06-22"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-051",
    title: {
      hi: "सिलाई टूलकिट अनुदान",
      en: "Tailoring toolkit grant",
    },
    need: "Livelihood",
    districts: ["Indore", "Bhopal"],
    eligibility: {
      gender: "female",
      minAge: 18,
      requires: ["skill_training_certificate"],
    },
    benefit: {
      hi: "सिलाई मशीन और टूलकिट के लिए एकमुश्त अनुदान।",
      en: "One-time grant for a sewing machine and toolkit.",
    },
    whoCanApply: {
      hi: "सिलाई प्रशिक्षण पूरी करने वाली महिलाएँ जो स्वरोजगार शुरू करना चाहती हैं।",
      en: "Women who have completed tailoring training and want to start self-employment.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "प्रशिक्षण प्रमाण पत्र", en: "Training certificate" },
      { hi: "निवास प्रमाण", en: "Address proof" },
    ],
    howToApply: {
      hi: "जिला उद्योग केंद्र या आरसेटी कार्यालय में आवेदन करें।",
      en: "Apply at the district industries centre or RSETI office.",
    },
    helpCentre: {
      name: "जिला उद्योग केंद्र, इंदौर",
      district: "Indore",
      address: "उद्योग भवन, इंदौर",
    },
    sourceUrl: sourceUrl("SCH-051"),
    lastChecked: new Date("2026-08-04"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-052",
    title: {
      hi: "स्ट्रीट वेंडर कार्यशील पूंजी",
      en: "Street vendor working capital",
    },
    need: "Livelihood",
    districts: ["Jabalpur", "Gwalior"],
    eligibility: {
      gender: "female",
      occupation: "street_vendor",
      requires: ["vendor_id"],
    },
    benefit: {
      hi: "कम ब्याज पर कार्यशील पूंजी ऋण।",
      en: "Working-capital loan at a lower interest rate.",
    },
    whoCanApply: {
      hi: "नगर निगम में पंजीकृत महिला स्ट्रीट वेंडर।",
      en: "Women street vendors registered with the municipal body.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "वेंडर पहचान पत्र", en: "Vendor ID card" },
      { hi: "बैंक पासबुक", en: "Bank passbook" },
    ],
    howToApply: {
      hi: "नगर निगम के शहरी आजीविका मिशन कक्ष में आवेदन दें।",
      en: "Apply at the municipal urban livelihood mission desk.",
    },
    helpCentre: {
      name: "शहरी आजीविका मिशन, जबलपुर",
      district: "Jabalpur",
      address: "नगर निगम भवन, जबलपुर",
    },
    sourceUrl: sourceUrl("SCH-052"),
    lastChecked: new Date("2026-09-01"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-053",
    title: {
      hi: "कुक्कुट पालन स्टार्टर सहायता",
      en: "Poultry starter support",
    },
    need: "Livelihood",
    districts: ["Sagar", "Indore"],
    eligibility: {
      gender: "female",
      rural: true,
      requires: ["land_or_shed_proof"],
    },
    benefit: {
      hi: "चूजे, दाना और छोटे शेड के लिए सहायता।",
      en: "Support for chicks, feed, and a small shed.",
    },
    whoCanApply: {
      hi: "ग्रामीण क्षेत्र की महिलाएँ जो कुक्कुट पालन शुरू करना चाहती हैं।",
      en: "Rural women who want to start poultry farming.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "भूमि या शेड का प्रमाण", en: "Land or shed proof" },
      { hi: "ग्राम पंचायत प्रमाण पत्र", en: "Gram panchayat certificate" },
    ],
    howToApply: {
      hi: "पशुपालन विभाग के ब्लॉक कार्यालय में आवेदन करें।",
      en: "Apply at the block animal husbandry office.",
    },
    helpCentre: {
      name: "पशुपालन विभाग, सागर",
      district: "Sagar",
      address: "कृषि परिसर, सागर",
    },
    sourceUrl: sourceUrl("SCH-053"),
    lastChecked: new Date("2026-07-29"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-061",
    title: {
      hi: "एनीमिया जाँच और लौह सहायता",
      en: "Anaemia screening and iron support",
    },
    need: "Health",
    districts: ["Bhopal", "Indore", "Jabalpur"],
    eligibility: {
      gender: "female",
      minAge: 15,
      maxAge: 49,
      requires: ["health_centre_registration"],
    },
    benefit: {
      hi: "मुफ्त जाँच और लौह-फोलिक एसिड गोलियाँ।",
      en: "Free screening and iron–folic acid tablets.",
    },
    whoCanApply: {
      hi: "15 से 49 वर्ष की महिलाएँ जो आंगनवाड़ी या स्वास्थ्य केंद्र पर पंजीकृत हैं।",
      en: "Women aged 15 to 49 registered at an anganwadi or health centre.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "स्वास्थ्य कार्ड", en: "Health card" },
    ],
    howToApply: {
      hi: "नज़दीकी आंगनवाड़ी या प्राथमिक स्वास्थ्य केंद्र पर जाँच कराएँ।",
      en: "Get screened at the nearest anganwadi or primary health centre.",
    },
    helpCentre: {
      name: "जिला स्वास्थ्य कार्यालय, भोपाल",
      district: "Bhopal",
      address: "ईदगाह हिल्स, भोपाल",
    },
    sourceUrl: sourceUrl("SCH-061"),
    lastChecked: new Date("2026-09-20"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  // Illustrative assumption: not an official scheme record.
  {
    code: "SCH-062",
    title: {
      hi: "संस्थागत प्रसव परिवहन सहायता",
      en: "Institutional delivery transport support",
    },
    need: "Health",
    districts: ["Gwalior", "Sagar", "Bhopal"],
    eligibility: {
      gender: "female",
      pregnancy: true,
      requires: ["institutional_delivery"],
    },
    benefit: {
      hi: "अस्पताल तक आने-जाने के लिए परिवहन सहायता।",
      en: "Transport support to and from the hospital.",
    },
    whoCanApply: {
      hi: "सरकारी स्वास्थ्य केंद्र में प्रसव कराने वाली गर्भवती महिलाएँ।",
      en: "Pregnant women delivering at a government health facility.",
    },
    documents: [
      { hi: "आधार कार्ड", en: "Aadhaar card" },
      { hi: "एमसीपी कार्ड", en: "MCP card" },
      { hi: "डिलीवरी स्लिप", en: "Delivery slip" },
    ],
    howToApply: {
      hi: "प्रसव के बाद अस्पताल के जननी कक्ष में दावा करें।",
      en: "Claim at the hospital maternity desk after delivery.",
    },
    helpCentre: {
      name: "जिला अस्पताल जननी कक्ष, ग्वालियर",
      district: "Gwalior",
      address: "जयेंद्र गंज, ग्वालियर",
    },
    sourceUrl: sourceUrl("SCH-062"),
    lastChecked: new Date("2026-10-12"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "published",
    audit: publishedAudit(),
  },
  {
    // Illustrative assumption: a scheme in DRAFT so the admin review flow has data.
    code: "SCH-071",
    title: { hi: "किशोरी स्वच्छता सहायता", en: "Adolescent hygiene support" },
    need: "Health",
    districts: ["Indore", "Bhopal"],
    eligibility: { gender: "female", minAge: 10, maxAge: 19 },
    benefit: {
      hi: "स्वच्छता किट निःशुल्क।",
      en: "Free hygiene kit.",
    },
    whoCanApply: {
      hi: "10 से 19 वर्ष की बालिकाएँ।",
      en: "Girls aged 10 to 19.",
    },
    documents: [{ hi: "आधार कार्ड", en: "Aadhaar card" }],
    howToApply: {
      hi: "आंगनवाड़ी केंद्र पर संपर्क करें।",
      en: "Contact the nearest anganwadi centre.",
    },
    helpCentre: {
      name: "आंगनवाड़ी केंद्र, इंदौर",
      district: "Indore",
      address: "राजवाड़ा क्षेत्र, इंदौर",
    },
    sourceUrl: sourceUrl("SCH-071"),
    lastChecked: new Date("2026-10-20"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "draft",
    audit: [{ by: "seed", at: new Date("2026-11-02T00:00:00.000Z"), action: "created as draft" }],
  },
  {
    // Illustrative assumption: a scheme in REVIEW, waiting for an admin to publish.
    code: "SCH-072",
    title: { hi: "महिला बचत समूह प्रशिक्षण", en: "Women's savings group training" },
    need: "Livelihood",
    districts: ["Jabalpur", "Sagar"],
    eligibility: { gender: "female", minAge: 18, maxAge: 60, requires: ["registered_shg_membership"] },
    benefit: {
      hi: "तीन दिन का निःशुल्क प्रशिक्षण और प्रमाण पत्र।",
      en: "Three days of free training and a certificate.",
    },
    whoCanApply: {
      hi: "18 से 60 वर्ष की स्व-सहायता समूह सदस्य।",
      en: "Self-help group members aged 18 to 60.",
    },
    documents: [{ hi: "आधार कार्ड", en: "Aadhaar card" }, { hi: "समूह पहचान पत्र", en: "Group ID" }],
    howToApply: {
      hi: "ब्लॉक आजीविका मिशन कार्यालय में नाम दर्ज कराएँ।",
      en: "Register at the block livelihood mission office.",
    },
    helpCentre: {
      name: "ब्लॉक आजीविका मिशन, जबलपुर",
      district: "Jabalpur",
      address: "रानीताल, जबलपुर",
    },
    sourceUrl: sourceUrl("SCH-072"),
    lastChecked: new Date("2026-10-28"),
    summaryHi: "",
    summaryStatus: "none",
    summaryFlags: [],
    status: "review",
    audit: [{ by: "seed", at: new Date("2026-11-03T00:00:00.000Z"), action: "status: review" }],
  },
];

const campaigns = [
  {
    slug: "widow-support",
    title: { hi: "विधवा सहायता कोष", en: "Widow support fund" },
    goal: 500000,
    active: true,
  },
  {
    slug: "health-livelihood",
    title: { hi: "स्वास्थ्य और आजीविका कोष", en: "Health and livelihood fund" },
    goal: 750000,
    active: true,
  },
];

async function clearCollections() {
  await Promise.all([
    Scheme.deleteMany({}),
    User.deleteMany({}),
    Campaign.deleteMany({}),
    Donation.deleteMany({}),
    Receipt.deleteMany({}),
    Counter.deleteMany({}),
    Subscription.deleteMany({}),
    CallbackRequest.deleteMany({}),
  ]);
}

function buildFakeDonors(passwordHash) {
  const donors = [];
  for (let i = 1; i <= FAKE_DONOR_COUNT; i += 1) {
    const pan = fakePan(i);
    if (!PAN_REGEX.test(pan)) {
      throw new Error(`Generated invalid PAN for donor ${i}: ${pan}`);
    }
    donors.push({
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      email: `donor${String(i).padStart(3, "0")}@seva.test`,
      passwordHash,
      role: "donor",
      pan: pan,
    });
  }
  return donors;
}

function seededDonationSpecs(demoDonor, fakeDonors, campaignDocs) {
  const amounts = [100, 250, 500, 500, 1000, 1000, 2000, 2500, 5000];
  const specs = [];
  const day = 24 * 60 * 60 * 1000;
  const start = new Date("2026-06-05T09:30:00.000Z").getTime();
  const span = 150 * day;
  const push = (user, i, type) =>
    specs.push({
      user,
      campaign: campaignDocs[i % campaignDocs.length],
      amount: amounts[(i * 7) % amounts.length],
      type,
      at: new Date(start + ((i * 37) % 100) * (span / 100)),
    });
  push(demoDonor, 0, "one-time");
  push(demoDonor, 1, "monthly");
  push(demoDonor, 2, "one-time");
  fakeDonors.slice(0, 40).forEach((u, i) => push(u, i + 3, i % 7 === 0 ? "monthly" : "one-time"));
  // Oldest first, so receipt numbers rise with receipt dates.
  return specs.sort((a, b) => a.at - b.at);
}

async function seed() {
  if (process.env.SEED_RESET !== "true") {
    throw new Error(
      "Refusing to delete database data. Set SEED_RESET=true only for a disposable demo database."
    );
  }
  await connectDb();
  await clearCollections();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [admin, demoDonor] = await User.create([
    {
      name: "Seva Admin",
      email: "admin@seva.test",
      passwordHash,
      role: "admin",
    },
    {
      name: "Demo Donor",
      email: "donor@seva.test",
      passwordHash,
      role: "donor",
      pan: "ABCDE1234F",
    },
  ]);

  if (!PAN_REGEX.test(demoDonor.pan)) {
    throw new Error("Demo donor PAN is not valid format");
  }

  const fakeDonors = await User.insertMany(buildFakeDonors(passwordHash));
  const campaignDocs = await Campaign.insertMany(campaigns);
  await Scheme.insertMany(schemes);

  // Sample paid donations with real receipts (issued through the same code as production).
  for (const spec of seededDonationSpecs(demoDonor, fakeDonors, campaignDocs)) {
    const key = crypto.randomUUID();
    await Donation.create({
      donor: spec.user._id,
      campaign: spec.campaign._id,
      amount: spec.amount,
      type: spec.type,
      status: "pending",
      idempotencyKey: key,
      donorName: spec.user.name,
      donorEmail: spec.user.email,
      donorPan: spec.user.pan,
    });
    await confirmDonation(key, { now: spec.at });
  }

  await CallbackRequest.create([
    { name: "Sunita Devi", phone: "9000000001", schemeCode: "SCH-014", note: "Fake sample request", consent: true },
    { name: "Meena Bai", phone: "9000000002", schemeCode: "SCH-031", note: "Fake sample request", consent: true, status: "called" },
  ]);

  const receiptCount = await Receipt.countDocuments();
  const schemeCount = await Scheme.countDocuments();
  const campaignCount = await Campaign.countDocuments();
  const userCount = await User.countDocuments();
  const districtSet = new Set();
  const published = await Scheme.find({ status: "published" }).lean();
  for (const scheme of published) {
    for (const district of scheme.districts) {
      districtSet.add(district);
    }
  }

  console.log("Seed complete.");
  console.log(`Schemes: ${schemeCount} (${published.length} published, 1 draft, 1 in review)`);
  console.log(`Paid donations with receipts: ${receiptCount}`);
  console.log(`Campaigns: ${campaignCount}`);
  console.log(`Users: ${userCount} (1 admin, 1 demo donor, ${fakeDonors.length} fake donors)`);
  console.log(`Districts covered: ${[...districtSet].sort().join(", ")}`);
  console.log("");
  console.log("Demo logins");
  console.log(`  admin  ${admin.email}  /  ${DEMO_PASSWORD}`);
  console.log(`  donor  ${demoDonor.email}  /  ${DEMO_PASSWORD}`);

  await disconnectDb();
}

seed().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
