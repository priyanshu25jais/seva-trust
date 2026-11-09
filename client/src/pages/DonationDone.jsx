import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { Icon } from "../components/Icons.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api, downloadFile } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate, formatRupees, pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

export default function DonationDone() {
  const { key } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.get(`/api/donations/${key}`), [key]);
  const [download, setDownload] = useState("idle"); // idle | working | failed
  usePageTitle(t("done.title"));

  async function getCertificate(receipt) {
    setDownload("working");
    try {
      await downloadFile(`/api/receipts/${receipt.id}/pdf?key=${key}`, `80G-${receipt.receiptNo.replace(/\//g, "-")}.pdf`);
      setDownload("idle");
    } catch {
      setDownload("failed");
    }
  }

  if (loading) return <div className="container"><Loading rows={1} /></div>;
  if (error && error.status === 404) {
    return (
      <div className="container">
        <EmptyState
          icon="search"
          title={t("done.notFound")}
          action={<Link to="/donate" className="btn">{t("nav.donate")}</Link>}
        />
      </div>
    );
  }
  if (error) return <div className="container"><ErrorState error={error} onRetry={reload} /></div>;

  const d = data.donation;
  if (d.status !== "paid" || !d.receipt) {
    return (
      <div className="container">
        <EmptyState
          icon="alert"
          title={t("done.pending")}
          action={<Link to="/donate" className="btn">{t("done.pendingAction")}</Link>}
        />
      </div>
    );
  }
  const r = d.receipt;

  return (
    <div className="container stack">
      <div>
        <p style={{ margin: 0, color: "var(--ok)" }}>
          <Icon name="check" size={32} />
        </p>
        <h1 tabIndex={-1} ref={(el) => el && el.focus({ preventScroll: true })}>
          {t("done.thanks")}
        </h1>
        <p className="lead muted">{t("done.thanksText")}</p>
      </div>

      <section className="card receipt-card" aria-label={t("done.receiptNo")}>
        <dl>
          <dt>{t("done.receiptNo")}</dt>
          <dd>{r.receiptNo}</dd>
          <dt>{t("done.amount")}</dt>
          <dd>{formatRupees(r.amount)}</dd>
          <dt>{t("done.date")}</dt>
          <dd>{formatDate(r.date, lang)}</dd>
          <dt>{t("done.cause")}</dt>
          <dd>{pick(r.campaignTitle, lang)}</dd>
          <dt>{t("done.name")}</dt>
          <dd>{r.donorName}</dd>
          <dt>{t("done.pan")}</dt>
          <dd>{r.donorPan}</dd>
        </dl>
      </section>

      <div className="stack-sm">
        <button type="button" className="btn block" onClick={() => getCertificate(r)} disabled={download === "working"} aria-busy={download === "working"}>
          <Icon name="download" size={22} /> {download === "working" ? t("done.downloading") : t("done.download")}
        </button>
        {download === "failed" && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={22} />
            <p>{t("done.downloadFailed")}</p>
          </div>
        )}
        <p className="small muted">{t("done.keepLink")}</p>
      </div>

      {d.type === "monthly" && (
        <div className="notice">
          <Icon name="info" size={22} />
          <p>{t("done.monthly")}</p>
        </div>
      )}

      <div className="row">
        <Link to="/donate" className="btn secondary">
          {t("done.again")}
        </Link>
        {!user && (
          <Link to="/register" className="btn ghost">
            {t("done.createAccount")}
          </Link>
        )}
      </div>
    </div>
  );
}
