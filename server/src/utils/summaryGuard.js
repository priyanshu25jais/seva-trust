// Guardrails for AI-written Hindi scheme summaries. A pure function so it is easy to test.
//
// The AI may only restate what the official notice says. The most harmful mistake in a
// welfare summary is a wrong amount, age or count, so every number in the summary must
// also appear in the notice. Other checks: length, and that the text really is Hindi.

const MAX_WORDS = 80;
const MIN_DEVANAGARI_RATIO = 0.7;

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

function normaliseDigits(text) {
  return String(text).replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

// "5,000" -> "5000", "₹600" -> "600", "१८" -> "18"
function extractNumbers(text) {
  const matches = normaliseDigits(text).match(/\d[\d,]*(?:\.\d+)?/g) || [];
  return matches.map((m) => m.replace(/,/g, "").replace(/\.0+$/, "")).filter(Boolean);
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function devanagariRatio(text) {
  const letters = String(text).match(/\p{L}/gu) || [];
  if (letters.length === 0) return 0;
  const dev = letters.filter((ch) => /\p{Script=Devanagari}/u.test(ch));
  return dev.length / letters.length;
}

/**
 * @returns {{ flags: string[], blocking: string[] }}
 *   flags:    everything an editor should look at (shown next to the draft)
 *   blocking: problems that must be fixed before the summary can be approved
 */
function checkSummary({ summary, notice, unsure = [] }) {
  const flags = [];
  const blocking = [];
  const text = String(summary || "").trim();

  if (!text) {
    return { flags: ["empty_summary"], blocking: ["empty_summary"] };
  }

  if (wordCount(text) > MAX_WORDS) {
    const flag = `too_long:${wordCount(text)}_words`;
    flags.push(flag);
    blocking.push(flag);
  }

  if (devanagariRatio(text) < MIN_DEVANAGARI_RATIO) {
    flags.push("not_mostly_hindi");
    blocking.push("not_mostly_hindi");
  }

  const noticeNumbers = new Set(extractNumbers(notice || ""));
  for (const n of new Set(extractNumbers(text))) {
    if (!noticeNumbers.has(n)) {
      const flag = `number_not_in_notice:${n}`;
      flags.push(flag);
      blocking.push(flag);
    }
  }

  for (const item of unsure) {
    if (typeof item === "string" && item.trim()) {
      flags.push(`model_unsure:${item.trim().slice(0, 120)}`);
    }
  }

  return { flags, blocking };
}

module.exports = { checkSummary, extractNumbers, wordCount, devanagariRatio, MAX_WORDS };
