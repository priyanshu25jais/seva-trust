// Formatting helpers. Amounts use Indian digit grouping (1,50,000). Latin digits are used
// in both languages so amounts and PAN numbers read the same everywhere.
export function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function formatDate(value, lang = "hi") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// Pick the current language from a { hi, en } pair, falling back to the other one.
export function pick(pair, lang) {
  if (!pair) return "";
  if (typeof pair === "string") return pair;
  return pair[lang] || pair.hi || pair.en || "";
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function newKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for very old phones without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
