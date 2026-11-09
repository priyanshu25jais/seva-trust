import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { formatRupees, pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

// A campaign page: what the money is for, how far it has come, and one clear way to give.
export default function Campaign() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data, loading, error, reload } = useApi(() => api.get(`/api/campaigns/${encodeURIComponent(slug)}`), [slug]);
  usePageTitle(data ? pick(data.campaign.title, lang) : t("campaign.all"));

  if (loading) return <div className="container"><Loading rows={1} /></div>;
  if (error && error.status === 404) {
    return (
      <div className="container">
        <EmptyState
          icon="search"
          title={t("campaign.notFound")}
          action={<Link to="/" className="btn secondary">{t("common.home")}</Link>}
        />
      </div>
    );
  }
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;

  const c = data.campaign;
  const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;

  return (
    <div className="container stack">
      <p style={{ margin: 0 }}>
        <Link to="/">← {t("common.home")}</Link>
      </p>
      <h1>{pick(c.title, lang)}</h1>
      <p className="lead muted">{t("campaign.about")}</p>
      <section className="card stack-sm" aria-label={pick(c.title, lang)}>
        <div className="row between">
          <strong style={{ fontSize: "1.4rem" }}>{formatRupees(c.raised)}</strong>
          <span className="muted">{pct}%</span>
        </div>
        <div className="progress" role="img" aria-label={`${pct}%`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {t("home.raised", { raised: formatRupees(c.raised).slice(1), goal: formatRupees(c.goal).slice(1) })} · {t("campaign.donations", { count: c.donations })}
        </p>
      </section>
      <div>
        <Link to={`/donate?campaign=${encodeURIComponent(c.slug)}`} className="btn">
          {t("campaign.donate")}
        </Link>
      </div>
    </div>
  );
}
