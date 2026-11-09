import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CallbackForm } from "../components/CallbackForm.jsx";
import { ChoiceGroup, TextArea, TextField } from "../components/Field.jsx";
import { Icon } from "../components/Icons.jsx";
import { ErrorState, Loading } from "../components/States.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { pick } from "../lib/format.js";

// Six simple questions, one per screen. Rules are matched on the server; this page only asks
// the questions and shows the result with the rules used (never a promise).
const QUESTIONS = ["gender", "age", "maritalStatus", "hasBplCard", "pregnancy", "shgMember"];
const EMPTY = { gender: null, age: null, maritalStatus: null, hasBplCard: null, pregnancy: null, shgMember: null };

function optionsFor(key, t) {
  switch (key) {
    case "gender":
      return [
        { value: "female", label: t("finder.a.female") },
        { value: "other", label: t("finder.a.other") },
      ];
    case "maritalStatus":
      return ["single", "married", "widow", "separated"].map((v) => ({ value: v, label: t(`finder.a.${v}`) }));
    case "pregnancy":
      return ["no", "first", "later"].map((v) => ({ value: v, label: t(`finder.a.preg.${v}`) }));
    default: // yes / no / don't know
      return [
        { value: true, label: t("common.yes") },
        { value: false, label: t("common.no") },
        { value: "unknown", label: t("common.dontKnow") },
      ];
  }
}

function describe(key, value, t) {
  if (value === null || value === undefined) return t("finder.notAnswered");
  if (key === "age") return t("finder.ageYears", { age: value });
  if (key === "gender") return t(`finder.a.${value}`);
  if (key === "maritalStatus") return t(`finder.a.${value}`);
  if (key === "pregnancy") return t(`finder.a.preg.${value}`);
  return value ? t("common.yes") : t("common.no");
}

function SpeechButton({ onText }) {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const Ctor = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  if (!Ctor) return null; // not supported on this phone: typing still works

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "hi-IN";
    rec.interimResults = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <button type="button" className="btn secondary" onClick={toggle} aria-pressed={listening}>
      <Icon name="mic" size={20} /> {listening ? t("finder.micStop") : t("finder.micStart")}
    </button>
  );
}

export default function Finder() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  usePageTitle(t("finder.title"));

  const [stage, setStage] = useState("intro"); // intro | question | review | loading | results
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(EMPTY);
  const [ageText, setAgeText] = useState("");
  const [ageError, setAgeError] = useState("");
  const [sentence, setSentence] = useState("");
  const [askState, setAskState] = useState("idle"); // idle | working | unavailable | failed
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const headingRef = useRef(null);

  // Move focus to the new question so screen reader users hear it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage, index]);

  function setAnswer(key, value) {
    setAnswers((a) => ({ ...a, [key]: value === "unknown" ? null : value }));
  }

  function goNext(from = index) {
    if (from + 1 >= QUESTIONS.length) {
      submit();
    } else {
      setIndex(from + 1);
    }
  }

  function choose(key, value) {
    // Build the new answers here and send them directly: state set in this same click has
    // not been applied yet, so reading it from the last question would lose the answer.
    const next = { ...answers, [key]: value === "unknown" ? null : value };
    setAnswers(next);
    const position = QUESTIONS.indexOf(key);
    if (position + 1 >= QUESTIONS.length) {
      submit(next);
    } else {
      setIndex(position + 1);
    }
  }

  function submitAge(e) {
    e.preventDefault();
    const text = ageText.trim();
    if (text === "") {
      setAnswer("age", null);
      setAgeError("");
      return goNext();
    }
    const n = Number(text);
    if (!Number.isInteger(n) || n < 0 || n > 120) {
      setAgeError(t("finder.ageError"));
      return undefined;
    }
    setAgeError("");
    setAnswer("age", n);
    return goNext();
  }

  async function submit(payload = answers) {
    setStage("loading");
    setError(null);
    try {
      const res = await api.post("/api/finder/match", { answers: payload });
      setResult(res);
      setStage("results");
    } catch (err) {
      setError(err);
      setStage("results");
    }
  }

  async function askInWords(e) {
    e.preventDefault();
    if (sentence.trim().length < 3) return;
    setAskState("working");
    try {
      const res = await api.post("/api/finder/parse", { sentence: sentence.trim() });
      setAnswers({ ...EMPTY, ...res.answers });
      setAskState("idle");
      setStage("review"); // a person always confirms what the AI understood
    } catch (err) {
      setAskState(err.status === 503 ? "unavailable" : "failed");
    }
  }

  function restart() {
    setAnswers(EMPTY);
    setAgeText("");
    setIndex(0);
    setResult(null);
    setError(null);
    setStage("intro");
  }

  const current = QUESTIONS[index];

  return (
    <div className="container stack">
      {stage === "intro" && (
        <>
          <div>
            <h1 ref={headingRef} tabIndex={-1}>
              {t("finder.title")}
            </h1>
            <p className="lead muted">{t("finder.intro")}</p>
          </div>
          <div className="notice">
            <Icon name="info" size={22} />
            <p>{t("finder.limit")}</p>
          </div>
          <button type="button" className="btn" onClick={() => setStage("question")}>
            {t("finder.start")} <Icon name="arrow" size={20} />
          </button>

          <form className="card stack" onSubmit={askInWords} aria-labelledby="ask-h">
            <h2 id="ask-h" style={{ fontSize: "1.2rem" }}>
              {t("finder.askTitle")}
            </h2>
            <TextArea
              label={t("finder.askLabel")}
              value={sentence}
              onChange={setSentence}
              placeholder={t("finder.askPlaceholder")}
              rows={3}
              maxLength={400}
            />
            <div className="row">
              <button type="submit" className="btn secondary" disabled={askState === "working" || sentence.trim().length < 3}>
                {askState === "working" ? t("finder.askWorking") : t("finder.askButton")}
              </button>
              <SpeechButton onText={(text) => setSentence((s) => `${s} ${text}`.trim())} />
            </div>
            {askState === "unavailable" && (
              <div className="notice warn" role="alert">
                <Icon name="info" size={22} />
                <p>{t("finder.askUnavailable")}</p>
              </div>
            )}
            {askState === "failed" && (
              <div className="notice error" role="alert">
                <Icon name="alert" size={22} />
                <p>{t("finder.askFailed")}</p>
              </div>
            )}
          </form>
        </>
      )}

      {stage === "question" && (
        <div className="stack">
          <ol className="stepper" aria-hidden="true">
            {QUESTIONS.map((q, i) => (
              <li key={q} className={i <= index ? "done" : ""} />
            ))}
          </ol>
          <p className="step-label">{t("finder.step", { current: index + 1, total: QUESTIONS.length })}</p>
          <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: "1.6rem" }} id="q-title">
            {t(`finder.q.${current}`)}
          </h1>

          {current === "age" ? (
            <form className="stack" onSubmit={submitAge} noValidate>
              <TextField
                label={t("finder.ageLabel")}
                value={ageText}
                onChange={(v) => setAgeText(v.replace(/\D/g, "").slice(0, 3))}
                error={ageError}
                type="text"
                inputMode="numeric"
                autoComplete="off"
              />
              <div className="row">
                <button type="submit" className="btn">
                  {ageText.trim() === "" ? t("common.skipQuestion") : t("common.next")}
                </button>
              </div>
            </form>
          ) : (
            <ChoiceGroup
              legend={<span className="sr-only">{t(`finder.q.${current}`)}</span>}
              name={current}
              value={answers[current] === null ? undefined : answers[current]}
              onChange={(v) => choose(current, v)}
              options={optionsFor(current, t)}
            />
          )}

          <div className="row">
            {index > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setIndex(index - 1)}>
                ← {t("common.back")}
              </button>
            ) : (
              <button type="button" className="btn ghost" onClick={restart}>
                ← {t("common.back")}
              </button>
            )}
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="stack">
          <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: "1.6rem" }}>
            {t("finder.reviewTitle")}
          </h1>
          <p className="muted">{t("finder.reviewHelp")}</p>
          <ul className="card" style={{ listStyle: "none", margin: 0, display: "grid", gap: "0.75rem" }}>
            {QUESTIONS.map((key, i) => (
              <li key={key} className="row between">
                <div>
                  <div className="small muted">{t(`finder.q.${key}`)}</div>
                  <strong>{describe(key, answers[key], t)}</strong>
                </div>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setAgeText(answers.age === null ? "" : String(answers.age));
                    setIndex(i);
                    setStage("question");
                  }}
                >
                  {t("common.edit")}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={() => submit()}>
            {t("finder.reviewConfirm")}
          </button>
        </div>
      )}

      {stage === "loading" && <Loading rows={2} />}

      {stage === "results" && (
        <div className="stack">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("finder.results")}
          </h1>
          {error && <ErrorState error={error} onRetry={() => submit()} />}
          {result && (
            <>
              <div className="notice">
                <Icon name="info" size={22} />
                <p>{t("finder.disclaimer")}</p>
              </div>
              <p className="muted" aria-live="polite" style={{ margin: 0 }}>
                {t("finder.resultsCount", { count: result.matches.length })} {t("finder.checked", { checked: result.checked })}
              </p>
              {result.matches.length === 0 ? (
                <div className="card soft">
                  <h2 style={{ fontSize: "1.2rem" }}>{t("finder.noMatch")}</h2>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {t("finder.noMatchHelp")}
                  </p>
                </div>
              ) : (
                <ul className="scheme-list" style={{ gridTemplateColumns: "1fr" }}>
                  {result.matches.map((m) => (
                    <li key={m.scheme.code} className="card">
                      <span className="tag">
                        <Icon name={m.scheme.need} size={16} /> {t(`home.need.${m.scheme.need}`)}
                      </span>
                      <h2 style={{ fontSize: "1.3rem", margin: "0.4rem 0 0.2rem" }}>{pick(m.scheme.title, lang)}</h2>
                      <p style={{ fontWeight: 600, color: "var(--accent-strong)", marginBottom: "0.4rem" }}>{pick(m.scheme.benefit, lang)}</p>
                      <h3 style={{ fontSize: "1rem", marginBottom: 0 }}>{t("finder.rulesUsed")}</h3>
                      <ul className="rules">
                        {m.rules.map((r) => (
                          <li key={r.key} className={r.status}>
                            <Icon name={r.status === "passed" ? "check" : "question"} size={20} />
                            <span>
                              {pick(r.label, lang)} <span className="muted">· {r.status === "passed" ? t("finder.rule.passed") : t("finder.rule.unknown")}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p style={{ margin: "1rem 0 0" }}>
                        <Link to={`/schemes/${m.scheme.code}`} className="btn secondary small">
                          {t("finder.view")}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <CallbackForm />
            </>
          )}
          <div>
            <button type="button" className="btn ghost" onClick={restart}>
              {t("finder.restart")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
