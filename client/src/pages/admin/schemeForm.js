// Converts between the admin form (all strings, easy to type) and the API shape.
export const EMPTY_FORM = {
  code: "",
  need: "Pension",
  districts: "",
  titleHi: "",
  titleEn: "",
  benefitHi: "",
  benefitEn: "",
  whoHi: "",
  whoEn: "",
  howHi: "",
  howEn: "",
  docs: [{ hi: "", en: "" }],
  centreName: "",
  centreDistrict: "",
  centreAddress: "",
  sourceUrl: "",
  lastChecked: "",
  elig: {
    womenOnly: true,
    minAge: "",
    maxAge: "",
    marital: "",
    pregnancy: false,
    firstChild: false,
    requires: "",
    disability: "",
    occupation: "",
    rural: false,
  },
};

const num = (v) => (String(v).trim() === "" ? undefined : Number(v));
const list = (v) =>
  String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function schemeToForm(s) {
  const e = s.eligibility || {};
  return {
    code: s.code,
    need: s.need,
    districts: (s.districts || []).join(", "),
    titleHi: s.title?.hi || "",
    titleEn: s.title?.en || "",
    benefitHi: s.benefit?.hi || "",
    benefitEn: s.benefit?.en || "",
    whoHi: s.whoCanApply?.hi || "",
    whoEn: s.whoCanApply?.en || "",
    howHi: s.howToApply?.hi || "",
    howEn: s.howToApply?.en || "",
    docs: s.documents && s.documents.length ? s.documents.map((d) => ({ hi: d.hi, en: d.en })) : [{ hi: "", en: "" }],
    centreName: s.helpCentre?.name || "",
    centreDistrict: s.helpCentre?.district || "",
    centreAddress: s.helpCentre?.address || "",
    sourceUrl: s.sourceUrl || "",
    lastChecked: s.lastChecked ? new Date(s.lastChecked).toISOString().slice(0, 10) : "",
    elig: {
      womenOnly: e.gender === "female",
      minAge: e.minAge ?? "",
      maxAge: e.maxAge ?? "",
      marital: e.maritalStatus || "",
      pregnancy: Boolean(e.pregnancy),
      firstChild: Boolean(e.firstChild),
      requires: (e.requires || []).join(", "),
      disability: e.minDisabilityPercent ?? "",
      occupation: e.occupation || "",
      rural: Boolean(e.rural),
    },
  };
}

export function formToPayload(f, { withCode }) {
  const e = f.elig;
  const eligibility = {};
  if (e.womenOnly) eligibility.gender = "female";
  if (num(e.minAge) !== undefined) eligibility.minAge = num(e.minAge);
  if (num(e.maxAge) !== undefined) eligibility.maxAge = num(e.maxAge);
  if (e.marital) eligibility.maritalStatus = e.marital;
  if (e.pregnancy) eligibility.pregnancy = true;
  if (e.firstChild) eligibility.firstChild = true;
  if (list(e.requires).length) eligibility.requires = list(e.requires);
  if (num(e.disability) !== undefined) eligibility.minDisabilityPercent = num(e.disability);
  if (e.occupation.trim()) eligibility.occupation = e.occupation.trim();
  if (e.rural) eligibility.rural = true;

  const payload = {
    need: f.need,
    districts: list(f.districts),
    title: { hi: f.titleHi.trim(), en: f.titleEn.trim() },
    eligibility,
    benefit: { hi: f.benefitHi.trim(), en: f.benefitEn.trim() },
    whoCanApply: { hi: f.whoHi.trim(), en: f.whoEn.trim() },
    documents: f.docs.filter((d) => d.hi.trim() && d.en.trim()).map((d) => ({ hi: d.hi.trim(), en: d.en.trim() })),
    howToApply: { hi: f.howHi.trim(), en: f.howEn.trim() },
    helpCentre: { name: f.centreName.trim(), district: f.centreDistrict.trim(), address: f.centreAddress.trim() },
    sourceUrl: f.sourceUrl.trim(),
    lastChecked: f.lastChecked,
  };
  if (withCode) payload.code = f.code.trim().toUpperCase();
  return payload;
}

// What the public page would show for this form (used for the preview tab).
export function formToPublic(f, saved) {
  const p = formToPayload(f, { withCode: true });
  return {
    code: p.code,
    ...p,
    summaryHi: saved && saved.summaryStatus === "approved" ? saved.summaryHi : "",
  };
}

// Plain checks before sending. The server checks everything again.
export function validateForm(f, { isNew }, t) {
  const errors = {};
  const need = t("common.required");
  if (isNew && !/^SCH-\d{3,4}$/i.test(f.code.trim())) errors.code = "SCH-045";
  for (const key of ["titleHi", "titleEn", "benefitHi", "benefitEn", "whoHi", "whoEn", "howHi", "howEn", "centreName", "centreDistrict", "centreAddress"]) {
    if (!f[key].trim()) errors[key] = need;
  }
  if (!/^https?:\/\/\S+$/i.test(f.sourceUrl.trim())) errors.sourceUrl = "https://…";
  if (!f.lastChecked) errors.lastChecked = need;
  const { minAge, maxAge } = f.elig;
  if (String(minAge) !== "" && String(maxAge) !== "" && Number(minAge) > Number(maxAge)) errors.maxAge = `${minAge} > ${maxAge}`;
  return errors;
}
