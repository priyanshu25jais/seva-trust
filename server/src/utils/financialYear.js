// Indian financial year: 1 April to 31 March, always computed in India time (IST, UTC+5:30).
// A donation at 00:30 IST on 1 April is 19:00 UTC on 31 March, so reading the UTC date
// would file it under the wrong year. We shift to IST first and read the UTC fields of
// the shifted date, which does not depend on the server's timezone or ICU data.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIst(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError("Invalid date");
  }
  return new Date(d.getTime() + IST_OFFSET_MS);
}

// Returns e.g. "2026-27".
function financialYear(date = new Date()) {
  const ist = toIst(date);
  const month = ist.getUTCMonth() + 1; // 1..12
  const startYear = month >= 4 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Start (inclusive) and end (exclusive) of a financial year as UTC instants.
function financialYearRange(fy) {
  const match = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!match) {
    throw new TypeError("Financial year must look like 2026-27");
  }
  const startYear = Number(match[1]);
  const start = new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(startYear + 1, 3, 1) - IST_OFFSET_MS);
  return { start, end };
}

// Date as shown on certificates: 05 Nov 2026 (IST).
function formatDateIst(date) {
  const ist = toIst(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(ist.getUTCDate()).padStart(2, "0")} ${months[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

function formatReceiptNo(fy, seq) {
  return `80G/${fy}/${String(seq).padStart(6, "0")}`;
}

module.exports = { financialYear, financialYearRange, formatDateIst, formatReceiptNo };
