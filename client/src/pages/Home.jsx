import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "../components/Icons.jsx";
import { SchemeCard } from "../components/SchemeCard.jsx";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { SelectField } from "../components/Field.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { formatRupees, pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

const NEEDS = ["all", "Pension", "Livelihood", "Health"];

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [need, setNeed] = useState("all");
  const [district, setDistrict] = useState("");
  usePageTitle(t("home.title"));

  const meta = useApi(() => api.get("/api/meta"), []);
  const schemes = useApi(() => {
    const params = new URLSearchParams();
    if (need !== "all") params.set("need", need);
    if (district) params.set("district", district);
    return api.get(`/api/schemes?${params.toString()}`);
  }, [need, district]);
  const campaigns = useApi(() => api.get("/api/campaigns"), []);

  const districts = useMemo(() => meta.data?.districts || [], [meta.data]);
  const list = schemes.data?.schemes || [];
  const filtered = need !== "all" || district;

  return (
    <div className="container wide stack">
      <section className="hero" aria-labelledby="home-h">
        <h1 id="home-h">{t("home.headline")}</h1>
        <p className="lead">{t("home.lead")}</p>
      </section>

      <section className="finder-cta" aria-labelledby="finder-h">
        <h2 id="finder-h">{t("home.finderTitle")}</h2>
        <div>
          <Link to="/finder" className="btn">
            {t("home.finderButton")} <Icon name="arrow" size={20} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="browse-h" className="stack-sm">
        <h2 id="browse-h">{t("home.browse")}</h2>
        <div className="needs" role="group" aria-label={t("home.browse")}>
          {NEEDS.map((n) => (
            <button key={n} type="button" className="need" aria-pressed={need === n} onClick={() => setNeed(n)}>
              <Icon name={n} size={28} />
              {t(`home.need.${n}`)}
            </button>
          ))}
        </div>
        <div style={{ maxWidth: "22rem" }}>
          <SelectField label={t("home.district")} value={district} onChange={setDistrict}>
            <option value="">{t("home.allDistricts")}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectField>
        </div>

        <div aria-live="polite">
          {schemes.loading && <Loading rows={4} />}
          {schemes.error && <ErrorState error={schemes.error} onRetry={schemes.reload} />}
          {!schemes.loading && !schemes.error && (
            <>
              <p className="muted" style={{ margin: "0.5rem 0 1rem" }}>
                {t("home.count", { count: list.length })}
              </p>
              {list.length === 0 ? (
                <EmptyState
                  icon="search"
                  title={t("home.emptyTitle")}
                  text={t("home.emptyHelp")}
                  action={
                    filtered ? (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          setNeed("all");
                          setDistrict("");
                        }}
                      >
                        {t("home.reset")}
                      </button>
                    ) : null
                  }
                />
              ) : (
                <ul className="scheme-list">
                  {list.map((s) => (
                    <SchemeCard key={s.code} scheme={s} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <section className="band" aria-labelledby="give-h">
        <div>
          <h2 id="give-h">{t("home.giveTitle")}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t("home.giveText")}
          </p>
        </div>
        {campaigns.data?.campaigns?.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.9rem" }}>
            {campaigns.data.campaigns.map((c) => {
              const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
              return (
                <li key={c.slug}>
                  <div className="row between" style={{ marginBottom: "0.3rem" }}>
                    <strong>
                      <Link to={`/campaigns/${c.slug}`}>{pick(c.title, lang)}</Link>
                    </strong>
                    <span className="small muted">{pct}%</span>
                  </div>
                  <div className="progress" role="img" aria-label={`${pct}%`}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <p className="small muted" style={{ margin: "0.3rem 0 0" }}>
                    {t("home.raised", { raised: formatRupees(c.raised).slice(1), goal: formatRupees(c.goal).slice(1) })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="row">
          <Link to="/donate" className="btn">
            {t("home.giveButton")}
          </Link>
          <Link to="/finder" className="btn ghost">
            <Icon name="phone" size={20} /> {t("home.helpline")}
          </Link>
        </div>
      </section>
    </div>
  );
}
