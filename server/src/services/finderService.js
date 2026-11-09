// Eligibility finder: a deterministic rule engine. AI never decides eligibility.
//
// Each scheme stores structured eligibility rules. For a woman's answers we report, per
// scheme, which rules passed, which failed and which cannot be checked from the answers
// ("unknown", to be confirmed when she applies). A scheme is shown as a POSSIBLE match
// only when no rule failed and at least one rule beyond "is a woman" passed. The result is
// never a promise of eligibility.

const LABELS = {
  bpl_card: { hi: "बीपीएल कार्ड", en: "BPL card" },
  registered_shg_membership: {
    hi: "पंजीकृत स्व-सहायता समूह की सदस्यता",
    en: "Membership of a registered self-help group",
  },
  antenatal_registration: { hi: "गर्भावस्था पंजीकरण", en: "Antenatal registration" },
  income_certificate: { hi: "आय प्रमाण पत्र", en: "Income certificate" },
  udid_card: { hi: "यूडीआईडी कार्ड", en: "UDID card" },
  skill_training_certificate: { hi: "कौशल प्रशिक्षण प्रमाण पत्र", en: "Skill training certificate" },
  vendor_id: { hi: "वेंडर पहचान पत्र", en: "Vendor ID card" },
  land_or_shed_proof: { hi: "भूमि या शेड का प्रमाण", en: "Land or shed proof" },
  health_centre_registration: {
    hi: "स्वास्थ्य केंद्र में पंजीकरण",
    en: "Registration at a health centre",
  },
  institutional_delivery: { hi: "सरकारी केंद्र में प्रसव", en: "Delivery at a government facility" },
};

const MARITAL = {
  widow: { hi: "विधवा", en: "Widow" },
  single: { hi: "अविवाहित", en: "Unmarried" },
  married: { hi: "विवाहित", en: "Married" },
  separated: { hi: "तलाकशुदा या अलग रह रही", en: "Divorced or separated" },
};

function humanize(key) {
  const text = String(key).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const tri = (value, test) => (value === null || value === undefined ? null : test(value));

// Turn a scheme's eligibility JSON into a list of checkable rules.
function describeRules(e = {}) {
  const rules = [];

  if (e.gender) {
    rules.push({
      key: "gender",
      label: e.gender === "female" ? { hi: "महिला आवेदक", en: "Woman applicant" } : { hi: e.gender, en: e.gender },
      check: (a) => tri(a.gender, (g) => g === e.gender),
    });
  }

  if (e.minAge !== undefined || e.maxAge !== undefined) {
    const { minAge: min, maxAge: max } = e;
    let label;
    if (min !== undefined && max !== undefined) {
      label = { hi: `आयु ${min} से ${max} वर्ष`, en: `Age ${min} to ${max}` };
    } else if (min !== undefined) {
      label = { hi: `आयु ${min} वर्ष या अधिक`, en: `Age ${min} or more` };
    } else {
      label = { hi: `आयु ${max} वर्ष तक`, en: `Age up to ${max}` };
    }
    rules.push({
      key: "age",
      label,
      check: (a) =>
        tri(a.age, (age) => (min === undefined || age >= min) && (max === undefined || age <= max)),
    });
  }

  if (e.maritalStatus) {
    rules.push({
      key: "maritalStatus",
      label: MARITAL[e.maritalStatus] || { hi: e.maritalStatus, en: humanize(e.maritalStatus) },
      check: (a) => tri(a.maritalStatus, (m) => m === e.maritalStatus),
    });
  }

  if (e.pregnancy) {
    rules.push({
      key: "pregnancy",
      label: { hi: "गर्भवती", en: "Pregnant" },
      check: (a) => tri(a.pregnancy, (p) => p === "first" || p === "later"),
    });
  }
  if (e.firstChild) {
    rules.push({
      key: "firstChild",
      label: { hi: "पहली संतान की अपेक्षा", en: "Expecting the first child" },
      check: (a) => tri(a.pregnancy, (p) => p === "first"),
    });
  }

  for (const item of e.requires || []) {
    const label = LABELS[item] || { hi: humanize(item), en: humanize(item) };
    let check = () => null; // not asked by the finder: confirmed at the help centre
    if (item === "bpl_card") check = (a) => tri(a.hasBplCard, (v) => v === true);
    if (item === "registered_shg_membership") check = (a) => tri(a.shgMember, (v) => v === true);
    rules.push({ key: `requires:${item}`, label, check });
  }

  if (e.minDisabilityPercent !== undefined) {
    rules.push({
      key: "disability",
      label: {
        hi: `${e.minDisabilityPercent}% या अधिक दिव्यांगता`,
        en: `Disability of ${e.minDisabilityPercent}% or more`,
      },
      check: () => null,
    });
  }
  if (e.occupation) {
    rules.push({
      key: "occupation",
      label: { hi: `व्यवसाय: ${humanize(e.occupation)}`, en: `Occupation: ${humanize(e.occupation)}` },
      check: () => null,
    });
  }
  if (e.rural) {
    rules.push({
      key: "rural",
      label: { hi: "ग्रामीण क्षेत्र की निवासी", en: "Lives in a rural area" },
      check: () => null,
    });
  }

  return rules;
}

function evaluateScheme(scheme, answers) {
  const evaluated = describeRules(scheme.eligibility).map((rule) => {
    const result = rule.check(answers);
    return {
      key: rule.key,
      label: rule.label,
      status: result === true ? "passed" : result === false ? "failed" : "unknown",
    };
  });
  const passed = evaluated.filter((r) => r.status === "passed");
  const failed = evaluated.filter((r) => r.status === "failed");
  const unknown = evaluated.filter((r) => r.status === "unknown");
  const strongPasses = passed.filter((r) => r.key !== "gender");
  const possible = failed.length === 0 && strongPasses.length >= 1;
  return { code: scheme.code, possible, rules: evaluated, passedCount: passed.length, unknownCount: unknown.length, failedCount: failed.length };
}

// Pure function: schemes in, ranked possible matches out.
function matchSchemes(answers, schemes) {
  const evaluated = schemes.map((s) => ({ scheme: s, ...evaluateScheme(s, answers) }));
  const matches = evaluated
    .filter((r) => r.possible)
    .sort(
      (a, b) =>
        b.passedCount - a.passedCount ||
        a.unknownCount - b.unknownCount ||
        a.code.localeCompare(b.code)
    );
  return { matches, checked: evaluated.length, notMatched: evaluated.length - matches.length };
}

module.exports = { matchSchemes, evaluateScheme, describeRules };
