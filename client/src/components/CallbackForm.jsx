import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "./Field.jsx";
import { Icon } from "./Icons.jsx";
import { api } from "../lib/api.js";

// Helpline call-back request. The number is stored only with the person's consent (DPDP).
export function CallbackForm({ schemeCode }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | done | failed

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (name.trim().length < 2) next.name = t("callback.nameError");
    if (!/^[6-9]\d{9}$/.test(phone.trim())) next.phone = t("callback.phoneError");
    if (!consent) next.consent = t("callback.consentError");
    setErrors(next);
    if (Object.keys(next).length) return;

    setState("sending");
    try {
      await api.post("/api/callbacks", {
        name: name.trim(),
        phone: phone.trim(),
        schemeCode: schemeCode || undefined,
        consent: true,
      });
      setState("done");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") {
    return (
      <div className="notice ok" role="status">
        <Icon name="check" size={22} />
        <p>{t("callback.success")}</p>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={submit} noValidate aria-labelledby="cb-title">
      <div>
        <h2 id="cb-title" style={{ fontSize: "1.25rem" }}>
          {t("callback.title")}
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t("callback.help")}
        </p>
      </div>
      <TextField label={t("callback.name")} value={name} onChange={setName} error={errors.name} autoComplete="name" />
      <TextField
        label={t("callback.phone")}
        value={phone}
        onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
        error={errors.phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
      />
      <div className="field">
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={errors.consent ? "true" : undefined} />
          <span>{t("callback.consent")}</span>
        </label>
        {errors.consent && (
          <span className="field-error" role="alert">
            {errors.consent}
          </span>
        )}
      </div>
      {state === "failed" && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={22} />
          <p>{t("common.error")}</p>
        </div>
      )}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? t("callback.sending") : t("callback.submit")}
      </button>
    </form>
  );
}
