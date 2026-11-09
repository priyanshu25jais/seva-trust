import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SelectField, TextArea, TextField } from "../../components/Field.jsx";
import { Icon } from "../../components/Icons.jsx";
import { SchemeView } from "../../components/SchemeView.jsx";
import { ErrorState, Loading } from "../../components/States.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import SummaryPanel from "./SummaryPanel.jsx";
import { EMPTY_FORM, formToPayload, formToPublic, schemeToForm, validateForm } from "./schemeForm.js";

const NEXT = {
  draft: [{ to: "review", label: "admin.act.toReview", kind: "" }],
  review: [
    { to: "published", label: "admin.act.publish", kind: "" },
    { to: "draft", label: "admin.act.backToDraft", kind: "secondary" },
  ],
  published: [{ to: "draft", label: "admin.act.unpublish", kind: "danger" }],
};

export default function SchemeEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();

  const [saved, setSaved] = useState(null); // the scheme as stored on the server
  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY_FORM));
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState([]);
  const [tab, setTab] = useState("edit");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    setLoading(true);
    api
      .get(`/api/admin/schemes/${id}`)
      .then((res) => {
        if (!alive) return;
        const f = schemeToForm(res.scheme);
        setSaved(res.scheme);
        setForm(f);
        setBaseline(JSON.stringify(f));
        setLoading(false);
      })
      .catch((err) => {
        if (alive) {
          setLoadError(err);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, reloadTick]);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setElig = (key) => (value) => setForm((f) => ({ ...f, elig: { ...f.elig, [key]: value } }));
  const setDoc = (i, key, value) =>
    setForm((f) => ({ ...f, docs: f.docs.map((d, n) => (n === i ? { ...d, [key]: value } : d)) }));

  async function save(e) {
    e.preventDefault();
    setNotice(null);
    setServerErrors([]);
    const found = validateForm(form, { isNew }, t);
    setErrors(found);
    if (Object.keys(found).length) {
      setTab("edit");
      return;
    }
    setBusy("save");
    try {
      if (isNew) {
        const res = await api.post("/api/admin/schemes", formToPayload(form, { withCode: true }));
        navigate(`/admin/schemes/${res.scheme._id}`, { replace: true });
      } else {
        const res = await api.put(`/api/admin/schemes/${id}`, formToPayload(form, { withCode: false }));
        const f = schemeToForm(res.scheme);
        setSaved(res.scheme);
        setForm(f);
        setBaseline(JSON.stringify(f));
        setNotice({ kind: "ok", text: t("admin.saved") });
      }
    } catch (err) {
      if (err.code === "validation_error" && Array.isArray(err.details)) {
        setServerErrors(err.details.map((d) => `${(d.path || []).filter((p) => p !== "body").join(".")}: ${d.message}`));
      } else if (err.status === 409) {
        setErrors({ code: err.message });
      } else {
        setNotice({ kind: "error", text: err.code === "network" ? t("common.network") : t("common.error") });
      }
    }
    setBusy("");
  }

  async function changeStatus(status) {
    setBusy("status");
    setNotice(null);
    try {
      const res = await api.post(`/api/admin/schemes/${id}/status`, { status });
      setSaved(res.scheme);
      setNotice({ kind: "ok", text: t("admin.statusChanged") });
    } catch (err) {
      setNotice({ kind: "error", text: err.code === "network" ? t("common.network") : t("common.error") });
    }
    setBusy("");
  }

  if (loading) return <Loading rows={2} />;
  if (loadError) {
    return <ErrorState error={loadError} onRetry={() => setReloadTick((n) => n + 1)} />;
  }

  const publicScheme = formToPublic(form, saved);

  return (
    <div className="stack">
      <p style={{ margin: 0 }}>
        <Link to="/admin/schemes">← {t("admin.schemes")}</Link>
      </p>
      <div className="row between">
        <h2 style={{ margin: 0 }}>{isNew ? t("admin.create.title") : t("admin.edit.title")}</h2>
        {saved && <span className={`tag ${saved.status}`}>{t(`admin.status.${saved.status}`)}</span>}
      </div>

      {saved && (
        <section className="section-card" aria-labelledby="wf-h">
          <h2 id="wf-h">{t("admin.workflow")}</h2>
          {saved.status === "published" && (
            <div className="notice warn" style={{ marginBottom: "0.8rem" }}>
              <Icon name="info" size={22} />
              <p>{t("admin.editWarn")}</p>
            </div>
          )}
          <div className="row">
            {NEXT[saved.status].map((a) => (
              <button
                key={a.to}
                type="button"
                className={`btn ${a.kind}`}
                onClick={() => changeStatus(a.to)}
                disabled={busy !== "" || dirty}
              >
                {t(a.label)}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="tabs" role="group" aria-label={t("admin.edit.title")}>
        <button type="button" className="tab" aria-pressed={tab === "edit"} onClick={() => setTab("edit")}>
          {t("admin.tab.edit")}
        </button>
        <button type="button" className="tab" aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>
          {t("admin.tab.preview")}
        </button>
      </div>

      {tab === "preview" && (
        <div className="stack">
          <div className="notice">
            <Icon name="info" size={22} />
            <p>{t("admin.previewNote")}</p>
          </div>
          <div className="card">
            <SchemeView scheme={publicScheme} />
          </div>
        </div>
      )}

      {tab === "edit" && (
        <form className="stack" onSubmit={save} noValidate>
          {serverErrors.length > 0 && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {serverErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <section className="section-card stack" aria-labelledby="s-basics">
            <h2 id="s-basics">{t("admin.sec.basics")}</h2>
            <div className="editor-grid two">
              <TextField
                label={t("admin.f.code")}
                value={form.code}
                onChange={(v) => set("code")(v.toUpperCase())}
                error={errors.code}
                disabled={!isNew}
                hint={!isNew ? t("admin.f.codeLocked") : undefined}
                autoComplete="off"
              />
              <SelectField label={t("admin.f.need")} value={form.need} onChange={set("need")}>
                {["Pension", "Livelihood", "Health"].map((n) => (
                  <option key={n} value={n}>
                    {t(`home.need.${n}`)}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField label={t("admin.f.districts")} value={form.districts} onChange={set("districts")} />
          </section>

          <section className="section-card stack" aria-labelledby="s-content">
            <h2 id="s-content">{t("admin.sec.content")}</h2>
            <div className="editor-grid two">
              <TextField label={t("admin.f.titleHi")} value={form.titleHi} onChange={set("titleHi")} error={errors.titleHi} lang="hi" />
              <TextField label={t("admin.f.titleEn")} value={form.titleEn} onChange={set("titleEn")} error={errors.titleEn} lang="en" />
              <TextArea label={t("admin.f.benefitHi")} value={form.benefitHi} onChange={set("benefitHi")} error={errors.benefitHi} rows={3} lang="hi" />
              <TextArea label={t("admin.f.benefitEn")} value={form.benefitEn} onChange={set("benefitEn")} error={errors.benefitEn} rows={3} lang="en" />
              <TextArea label={t("admin.f.whoHi")} value={form.whoHi} onChange={set("whoHi")} error={errors.whoHi} rows={3} lang="hi" />
              <TextArea label={t("admin.f.whoEn")} value={form.whoEn} onChange={set("whoEn")} error={errors.whoEn} rows={3} lang="en" />
              <TextArea label={t("admin.f.howHi")} value={form.howHi} onChange={set("howHi")} error={errors.howHi} rows={3} lang="hi" />
              <TextArea label={t("admin.f.howEn")} value={form.howEn} onChange={set("howEn")} error={errors.howEn} rows={3} lang="en" />
            </div>
          </section>

          <section className="section-card stack" aria-labelledby="s-elig">
            <h2 id="s-elig">{t("admin.sec.eligibility")}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {t("admin.e.help")}
            </p>
            <label className="check">
              <input type="checkbox" checked={form.elig.womenOnly} onChange={(e) => setElig("womenOnly")(e.target.checked)} />
              <span>{t("admin.e.womenOnly")}</span>
            </label>
            <div className="editor-grid two">
              <TextField label={t("admin.e.minAge")} value={form.elig.minAge} onChange={(v) => setElig("minAge")(v.replace(/\D/g, ""))} inputMode="numeric" />
              <TextField label={t("admin.e.maxAge")} value={form.elig.maxAge} onChange={(v) => setElig("maxAge")(v.replace(/\D/g, ""))} inputMode="numeric" error={errors.maxAge} />
              <SelectField label={t("admin.e.marital")} value={form.elig.marital} onChange={setElig("marital")}>
                <option value="">{t("admin.e.maritalAny")}</option>
                {["single", "married", "widow", "separated"].map((m) => (
                  <option key={m} value={m}>
                    {t(`finder.a.${m}`)}
                  </option>
                ))}
              </SelectField>
              <TextField label={t("admin.e.disability")} value={form.elig.disability} onChange={(v) => setElig("disability")(v.replace(/\D/g, ""))} inputMode="numeric" />
            </div>
            <TextField label={t("admin.e.requires")} value={form.elig.requires} onChange={setElig("requires")} autoCapitalize="none" />
            <TextField label={t("admin.e.occupation")} value={form.elig.occupation} onChange={setElig("occupation")} autoCapitalize="none" />
            <label className="check">
              <input type="checkbox" checked={form.elig.pregnancy} onChange={(e) => setElig("pregnancy")(e.target.checked)} />
              <span>{t("admin.e.pregnancy")}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.elig.firstChild} onChange={(e) => setElig("firstChild")(e.target.checked)} />
              <span>{t("admin.e.firstChild")}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.elig.rural} onChange={(e) => setElig("rural")(e.target.checked)} />
              <span>{t("admin.e.rural")}</span>
            </label>
          </section>

          <section className="section-card stack" aria-labelledby="s-docs">
            <h2 id="s-docs">{t("admin.sec.documents")}</h2>
            {form.docs.map((d, i) => (
              <div key={i} className="row" style={{ alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 12rem" }}>
                  <TextField label={t("admin.f.docHi")} value={d.hi} onChange={(v) => setDoc(i, "hi", v)} lang="hi" />
                </div>
                <div style={{ flex: "1 1 12rem" }}>
                  <TextField label={t("admin.f.docEn")} value={d.en} onChange={(v) => setDoc(i, "en", v)} lang="en" />
                </div>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => setForm((f) => ({ ...f, docs: f.docs.filter((_, n) => n !== i) }))}
                  aria-label={`${t("common.remove")} ${i + 1}`}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn secondary small" onClick={() => setForm((f) => ({ ...f, docs: [...f.docs, { hi: "", en: "" }] }))}>
                <Icon name="plus" size={18} /> {t("admin.f.addDoc")}
              </button>
            </div>
          </section>

          <section className="section-card stack" aria-labelledby="s-centre">
            <h2 id="s-centre">{t("admin.sec.centre")}</h2>
            <div className="editor-grid two">
              <TextField label={t("admin.f.centreName")} value={form.centreName} onChange={set("centreName")} error={errors.centreName} />
              <TextField label={t("admin.f.centreDistrict")} value={form.centreDistrict} onChange={set("centreDistrict")} error={errors.centreDistrict} />
            </div>
            <TextField label={t("admin.f.centreAddress")} value={form.centreAddress} onChange={set("centreAddress")} error={errors.centreAddress} />
            <div className="editor-grid two">
              <TextField label={t("admin.f.sourceUrl")} value={form.sourceUrl} onChange={set("sourceUrl")} error={errors.sourceUrl} type="url" autoCapitalize="none" />
              <TextField label={t("admin.f.lastChecked")} value={form.lastChecked} onChange={set("lastChecked")} error={errors.lastChecked} type="date" />
            </div>
          </section>

          {notice && (
            <div className={`notice ${notice.kind === "ok" ? "ok" : "error"}`} role={notice.kind === "ok" ? "status" : "alert"}>
              <Icon name={notice.kind === "ok" ? "check" : "alert"} size={22} />
              <p>{notice.text}</p>
            </div>
          )}

          <div className="sticky-actions row">
            <button type="submit" className="btn" disabled={busy !== "" || (!isNew && !dirty)}>
              {busy === "save" ? t("common.saving") : t("common.save")}
            </button>
            <Link to="/admin/schemes" className="btn ghost">
              {t("common.cancel")}
            </Link>
          </div>
        </form>
      )}

      {!isNew && saved && tab === "edit" && (
        <>
          <SummaryPanel scheme={saved} onChange={setSaved} />
          <section className="section-card" aria-labelledby="audit-h">
            <h2 id="audit-h">{t("admin.audit")}</h2>
            <ul className="audit">
              {[...(saved.audit || [])].reverse().map((a, i) => (
                <li key={i}>
                  {formatDate(a.at, lang)} · {a.by} · {a.action}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {isNew && <p className="small muted">{t("admin.ai.saveFirst")}</p>}
    </div>
  );
}
