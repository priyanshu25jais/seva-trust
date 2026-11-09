import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChoiceGroup, TextField } from "../components/Field.jsx";
import { Icon } from "../components/Icons.jsx";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { PAN_REGEX, formatRupees, newKey, pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

const PRESETS = [100, 500, 1000, 2500];
const MIN = 10;
const MAX = 200000;

function groupCard(value) {
  return value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export default function Donate() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  usePageTitle(t("donate.title"));

  const campaigns = useApi(() => api.get("/api/campaigns"), []);
  const list = useMemo(() => campaigns.data?.campaigns || [], [campaigns.data]);

  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState("");
  const [type, setType] = useState("one-time");
  const [campaign, setCampaign] = useState(params.get("campaign") || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pan, setPan] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "" });
  const [errors, setErrors] = useState({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const headingRef = useRef(null);

  // The idempotency key makes a double click or a retry safe: the server returns the same
  // donation and receipt. A new key is made only if the amount, cause or type changed.
  const keyRef = useRef(newKey());
  const sigRef = useRef("");

  // Default to the first campaign, and prefill name and email for a logged-in donor.
  useEffect(() => {
    if (!campaign && list.length) setCampaign(list[0].slug);
  }, [list, campaign]);
  useEffect(() => {
    if (user) {
      setName((n) => n || user.name || "");
      setEmail((e) => e || user.email || "");
    }
  }, [user]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const chosen = list.find((c) => c.slug === campaign);

  function validateStep(n) {
    const next = {};
    if (n === 1) {
      if (!Number.isInteger(amount) || amount < MIN || amount > MAX) next.amount = t("donate.err.amount");
      if (!campaign) next.campaign = t("donate.err.campaign");
    }
    if (n === 2) {
      if (name.trim().length < 2) next.name = t("donate.err.name");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("donate.err.email");
      if (!PAN_REGEX.test(pan)) next.pan = t("donate.err.pan");
    }
    if (n === 3) {
      const digits = card.number.replace(/\D/g, "");
      if (digits.length < 12) next.number = t("donate.err.card");
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) next.expiry = t("donate.err.expiry");
      if (!/^\d{3,4}$/.test(card.cvv)) next.cvv = t("donate.err.cvv");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (validateStep(step)) setStep(step + 1);
  }

  function pickPreset(value) {
    setAmount(value);
    setCustom("");
  }
  function changeCustom(text) {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setCustom(digits);
    setAmount(digits === "" ? null : Number(digits));
  }

  async function pay(e) {
    e.preventDefault();
    if (paying || !validateStep(3)) return;
    setPaying(true);
    setPayError(null);

    const sig = `${amount}|${campaign}|${type}`;
    if (sig !== sigRef.current) {
      keyRef.current = newKey();
      sigRef.current = sig;
    }
    const key = keyRef.current;

    try {
      await api.post("/api/donations", {
        amount,
        type,
        campaignSlug: campaign,
        donorName: name.trim(),
        donorEmail: email.trim(),
        pan,
        idempotencyKey: key,
      });
      await api.post("/api/payments/mock/pay", {
        idempotencyKey: key,
        card: { number: card.number, expiry: card.expiry, cvv: card.cvv },
      });
      navigate(`/donate/done/${key}`);
    } catch (err) {
      setPayError(err);
      setPaying(false);
    }
  }

  const steps = [t("donate.step1"), t("donate.step2"), t("donate.step3")];

  if (campaigns.loading) return <div className="container"><Loading rows={2} /></div>;
  if (campaigns.error) return <div className="container"><ErrorState error={campaigns.error} onRetry={campaigns.reload} /></div>;
  if (list.length === 0) return <div className="container"><EmptyState icon="info" title={t("donate.title")} text={t("donate.noCampaigns")} /></div>;

  return (
    <div className="container stack">
      <ol className="stepper" aria-hidden="true">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? "done" : ""} />
        ))}
      </ol>
      <div>
        <p className="step-label" style={{ margin: 0 }}>
          {t("donate.stepOf", { current: step })}
        </p>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: "1.7rem" }}>
          {steps[step - 1]}
        </h1>
      </div>

      {step === 1 && (
        <div className="stack">
          <fieldset className="field">
            <legend className="label">{t("donate.amountLabel")}</legend>
            <div className="amount-presets">
              {PRESETS.map((p) => (
                <label className="choice" key={p}>
                  <input type="radio" name="amount" checked={amount === p && custom === ""} onChange={() => pickPreset(p)} />
                  <span className="box" style={{ justifyContent: "center" }}>
                    {formatRupees(p)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <TextField
            label={t("donate.custom")}
            value={custom}
            onChange={changeCustom}
            error={errors.amount}
            inputMode="numeric"
            autoComplete="off"
            placeholder="₹"
          />
          <ChoiceGroup
            legend={t("donate.frequency")}
            name="type"
            value={type}
            onChange={setType}
            columns={2}
            options={[
              { value: "one-time", label: t("donate.once") },
              { value: "monthly", label: t("donate.monthly") },
            ]}
          />
          {type === "monthly" && (
            <div className="notice">
              <Icon name="info" size={22} />
              <p>{t("donate.monthlyNote")}</p>
            </div>
          )}
          <div>
            <ChoiceGroup
              legend={t("donate.campaign")}
              name="campaign"
              value={campaign}
              onChange={setCampaign}
              options={list.map((c) => ({ value: c.slug, label: pick(c.title, lang) }))}
            />
            {errors.campaign && <span className="field-error" role="alert">{errors.campaign}</span>}
          </div>
          <button type="button" className="btn" onClick={goNext}>
            {t("common.next")} <Icon name="arrow" size={20} />
          </button>
        </div>
      )}

      {step === 2 && (
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
        >
          <TextField label={t("donate.name")} value={name} onChange={setName} error={errors.name} autoComplete="name" />
          <TextField label={t("donate.email")} value={email} onChange={setEmail} error={errors.email} type="email" autoComplete="email" />
          <TextField
            label={t("donate.pan")}
            hint={t("donate.panHelp")}
            value={pan}
            onChange={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
            error={errors.pan}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
          />
          <p className="small muted" style={{ margin: 0 }}>
            {t("donate.privacy")}
          </p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setStep(1)}>
              ← {t("common.back")}
            </button>
            <button type="submit" className="btn">
              {t("common.next")} <Icon name="arrow" size={20} />
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="stack" noValidate onSubmit={pay}>
          <div className="card soft">
            <div className="small muted">{t("donate.summary")}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatRupees(amount)}</div>
            <div className="muted">
              {type === "monthly" ? t("donate.monthly") : t("donate.once")} · {chosen ? pick(chosen.title, lang) : ""}
            </div>
          </div>
          <div className="notice warn">
            <Icon name="info" size={22} />
            <p>{t("donate.testMode")}</p>
          </div>

          {payError && payError.code === "foreign_card_blocked" && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <div>
                <p style={{ fontWeight: 700 }}>{t("donate.foreignTitle")}</p>
                <p>{t("donate.foreignText")}</p>
              </div>
            </div>
          )}
          {payError && payError.code === "card_declined" && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <p>{t("donate.declined")}</p>
            </div>
          )}
          {payError && payError.code === "rate_limited" && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <p>{t("donate.tooMany")}</p>
            </div>
          )}
          {payError && !["foreign_card_blocked", "card_declined", "rate_limited"].includes(payError.code) && (
            <ErrorState error={payError} />
          )}

          <TextField
            label={t("donate.card")}
            value={card.number}
            onChange={(v) => setCard((c) => ({ ...c, number: groupCard(v) }))}
            error={errors.number}
            inputMode="numeric"
            autoComplete="cc-number"
          />
          <div className="grid-2">
            <TextField
              label={t("donate.expiry")}
              value={card.expiry}
              onChange={(v) => setCard((c) => ({ ...c, expiry: formatExpiry(v) }))}
              error={errors.expiry}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
            />
            <TextField
              label={t("donate.cvv")}
              value={card.cvv}
              onChange={(v) => setCard((c) => ({ ...c, cvv: v.replace(/\D/g, "").slice(0, 4) }))}
              error={errors.cvv}
              inputMode="numeric"
              autoComplete="cc-csc"
              type="password"
            />
          </div>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: "2.75rem" }}>{t("donate.testCards")}</summary>
            <ul className="small muted">
              <li>{t("donate.testCardOk")}</li>
              <li>{t("donate.testCardDeclined")}</li>
              <li>{t("donate.testCardForeign")}</li>
            </ul>
            <p className="small muted">{t("donate.testCardAny")}</p>
          </details>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setStep(2)} disabled={paying}>
              ← {t("common.back")}
            </button>
            <button type="submit" className="btn" disabled={paying} aria-busy={paying}>
              {paying ? (
                <>
                  <span className="spinner" aria-hidden="true" /> {t("donate.paying")}
                </>
              ) : (
                t("donate.pay", { amount: amount ? amount.toLocaleString("en-IN") : "" })
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
