import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TextArea } from "../../components/Field.jsx";
import { Icon } from "../../components/Icons.jsx";
import { api } from "../../lib/api.js";

// Problems the server will refuse to approve. Anything else is advice for the editor.
const BLOCKING = ["number_not_in_notice", "not_mostly_hindi", "too_long", "empty_summary"];

function splitFlag(flag) {
  const i = flag.indexOf(":");
  return i === -1 ? [flag, ""] : [flag.slice(0, i), flag.slice(i + 1)];
}

function FlagList({ flags, t }) {
  if (!flags.length) return null;
  return (
    <ul className="flag-list">
      {flags.map((flag) => {
        const [key, value] = splitFlag(flag);
        const label = key === "too_long" ? t(`flag.${key}`, { value: value.replace("_words", "") }) : t(`flag.${key}`, { value, defaultValue: flag });
        return (
          <li key={flag} className={BLOCKING.includes(key) ? "block" : ""}>
            {label}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * AI Hindi summary drafting. The AI only ever produces a DRAFT. It is shown beside the
 * official notice, checked automatically, and goes public only after an editor approves it.
 */
export default function SummaryPanel({ scheme, onChange }) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(scheme.summaryHi || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null); // { kind: ok | error, text }
  const [blocking, setBlocking] = useState([]);

  // Keep the draft box in step when the scheme is reloaded from the server.
  useEffect(() => {
    setDraft(scheme.summaryHi || "");
  }, [scheme.summaryHi, scheme.summaryStatus]);

  const flags = scheme.summaryFlags || [];
  const templateUsed = flags.some((f) => f.startsWith("template_used"));
  const hasDraft = scheme.summaryStatus === "draft" || scheme.summaryStatus === "approved";

  async function generate() {
    setBusy("generate");
    setMessage(null);
    setBlocking([]);
    try {
      const res = await api.post(`/api/admin/schemes/${scheme._id}/ai-summary`, { noticeText: notice.trim() });
      onChange(res.scheme);
      setBlocking(res.blocking || []);
    } catch (err) {
      setMessage({ kind: "error", text: err.code === "network" ? t("common.network") : t("common.error") });
    }
    setBusy("");
  }

  async function approve() {
    setBusy("approve");
    setMessage(null);
    try {
      const res = await api.post(`/api/admin/schemes/${scheme._id}/approve-summary`, { summaryHi: draft.trim() });
      onChange(res.scheme);
      setBlocking([]);
      setMessage({ kind: "ok", text: t("admin.ai.approvedOk") });
    } catch (err) {
      if (err.code === "summary_blocked") {
        setBlocking(err.details || []);
      } else {
        setMessage({ kind: "error", text: err.code === "network" ? t("common.network") : t("common.error") });
      }
    }
    setBusy("");
  }

  async function discard() {
    setBusy("discard");
    setMessage(null);
    try {
      const res = await api.delete(`/api/admin/schemes/${scheme._id}/summary`);
      onChange(res.scheme);
      setBlocking([]);
      setMessage({ kind: "ok", text: t("admin.ai.discarded") });
    } catch {
      setMessage({ kind: "error", text: t("common.error") });
    }
    setBusy("");
  }

  return (
    <section className="section-card stack" aria-labelledby="ai-h">
      <div>
        <h2 id="ai-h">{t("admin.ai.title")}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t("admin.ai.help")}
        </p>
      </div>

      <TextArea label={t("admin.ai.notice")} value={notice} onChange={setNotice} rows={5} maxLength={8000} />
      <div>
        <button type="button" className="btn secondary" onClick={generate} disabled={busy !== "" || notice.trim().length < 20}>
          {busy === "generate" ? (
            <>
              <span className="spinner" aria-hidden="true" /> {t("admin.ai.generating")}
            </>
          ) : (
            t("admin.ai.generate")
          )}
        </button>
      </div>

      {hasDraft && (
        <div className="stack-sm">
          {templateUsed && (
            <div className="notice warn" role="status">
              <Icon name="alert" size={22} />
              <p>{t("admin.ai.templateUsed")}</p>
            </div>
          )}
          {scheme.summaryStatus === "approved" && (
            <div className="notice ok" role="status">
              <Icon name="check" size={22} />
              <p>{t("admin.ai.approved")}</p>
            </div>
          )}
          <TextArea label={t("admin.ai.draft")} value={draft} onChange={setDraft} rows={5} lang="hi" maxLength={1200} />
          <p className="small muted" style={{ margin: 0 }}>
            {t("admin.ai.compare")}
          </p>
          {flags.length > 0 && (
            <div>
              <strong>{t("admin.ai.flags")}</strong>
              <FlagList flags={flags} t={t} />
            </div>
          )}
          {blocking.length > 0 && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <div>
                <p style={{ fontWeight: 700 }}>{t("admin.ai.needsFix")}</p>
                <FlagList flags={blocking} t={t} />
              </div>
            </div>
          )}
          <div className="row">
            <button type="button" className="btn" onClick={approve} disabled={busy !== "" || draft.trim() === ""}>
              {t("admin.ai.approve")}
            </button>
            <button type="button" className="btn danger" onClick={discard} disabled={busy !== ""}>
              {t("admin.ai.discard")}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`notice ${message.kind === "ok" ? "ok" : "error"}`} role={message.kind === "ok" ? "status" : "alert"}>
          <Icon name={message.kind === "ok" ? "check" : "alert"} size={22} />
          <p>{message.text}</p>
        </div>
      )}
    </section>
  );
}
