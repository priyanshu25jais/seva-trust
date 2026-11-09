const { Scheme, User } = require("../models");
const { httpError } = require("../middleware/errors");
const { escapeRegex } = require("./schemeService");
const { generateHindiSummary } = require("./aiService");
const { checkSummary } = require("../utils/summaryGuard");

// draft -> review -> published. Editing a published scheme sends it back to review.
const TRANSITIONS = {
  draft: ["review"],
  review: ["draft", "published"],
  published: ["draft"],
};

async function actorLabel(userId) {
  const user = await User.findById(userId).lean();
  return user ? user.email : String(userId);
}

function adminView(s) {
  const obj = typeof s.toObject === "function" ? s.toObject() : s;
  const { summaryNotice, ...rest } = obj;
  return { ...rest, hasNotice: Boolean(summaryNotice) };
}

async function loadScheme(id) {
  const scheme = await Scheme.findById(id).select("+summaryNotice");
  if (!scheme) throw httpError(404, "Scheme not found", "not_found");
  return scheme;
}

async function list({ status, q } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ "title.hi": rx }, { "title.en": rx }, { code: rx }];
  }
  const schemes = await Scheme.find(filter).sort({ updatedAt: -1 }).lean();
  return schemes.map(adminView);
}

async function getOne(id) {
  return adminView(await loadScheme(id));
}

async function create(input, userId) {
  const by = await actorLabel(userId);
  const scheme = await Scheme.create({
    ...input,
    status: "draft",
    audit: [{ by, action: "created as draft" }],
  });
  return adminView(scheme);
}

async function update(id, input, userId) {
  const scheme = await loadScheme(id);
  const by = await actorLabel(userId);
  const wasPublished = scheme.status === "published";

  scheme.set(input);
  scheme.markModified("eligibility");
  if (wasPublished) {
    scheme.status = "review";
    scheme.audit.push({ by, action: "edited; moved from published to review" });
  } else {
    scheme.audit.push({ by, action: "edited" });
  }
  await scheme.save();
  return adminView(scheme);
}

async function setStatus(id, status, userId) {
  const scheme = await loadScheme(id);
  if (!TRANSITIONS[scheme.status].includes(status)) {
    throw httpError(409, `Cannot move a scheme from ${scheme.status} to ${status}`, "invalid_transition");
  }
  scheme.status = status;
  scheme.audit.push({ by: await actorLabel(userId), action: `status: ${status}` });
  await scheme.save();
  return adminView(scheme);
}

/**
 * Draft a Hindi summary from the pasted official notice. The draft is saved with
 * summaryStatus "draft": it is invisible to the public until an admin approves it.
 */
async function draftSummary(id, noticeText, userId) {
  const scheme = await loadScheme(id);
  const result = await generateHindiSummary({ noticeText, scheme });
  const { flags, blocking } = checkSummary({
    summary: result.summary,
    notice: noticeText,
    unsure: result.unsure,
  });

  const allFlags = [...flags];
  if (result.usedFallback) allFlags.unshift(`template_used:${result.fallbackReason}`);

  scheme.summaryNotice = noticeText;
  scheme.summaryHi = result.summary;
  scheme.summaryStatus = "draft";
  scheme.summaryFlags = allFlags;
  scheme.summaryProvider = result.provider;
  scheme.audit.push({
    by: await actorLabel(userId),
    action: result.usedFallback ? "summary draft from template (AI unavailable)" : `summary draft by ${result.provider}`,
  });
  await scheme.save();

  return { scheme: adminView(scheme), blocking, usedFallback: result.usedFallback };
}

/**
 * An editor approves the summary (optionally after editing it). The guardrails run again
 * on the final text. A summary with a number that is not in the official notice, text that
 * is not Hindi, or too many words cannot be approved.
 */
async function approveSummary(id, summaryHi, userId) {
  const scheme = await loadScheme(id);
  const text = (summaryHi ?? scheme.summaryHi ?? "").trim();
  if (!scheme.summaryNotice) {
    throw httpError(422, "Paste the official notice first so the summary can be checked against it", "notice_required");
  }

  const { flags, blocking } = checkSummary({ summary: text, notice: scheme.summaryNotice });
  if (blocking.length) {
    const err = httpError(422, "This summary cannot be approved until the problems are fixed", "summary_blocked");
    err.details = blocking;
    throw err;
  }

  scheme.summaryHi = text;
  scheme.summaryStatus = "approved";
  scheme.summaryFlags = flags;
  scheme.audit.push({ by: await actorLabel(userId), action: "summary approved" });
  await scheme.save();
  return adminView(scheme);
}

async function discardSummary(id, userId) {
  const scheme = await loadScheme(id);
  scheme.summaryHi = "";
  scheme.summaryStatus = "none";
  scheme.summaryFlags = [];
  scheme.audit.push({ by: await actorLabel(userId), action: "summary discarded" });
  await scheme.save();
  return adminView(scheme);
}

module.exports = { list, getOne, create, update, setStatus, draftSummary, approveSummary, discardSummary, TRANSITIONS };
