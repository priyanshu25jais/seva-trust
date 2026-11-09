import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { Icon } from "../components/Icons.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api, downloadFile } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate, formatRupees, pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

export default function Account() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.get("/api/me/donations"), []);
  const [busyId, setBusyId] = useState(null);
  const [failed, setFailed] = useState(false);
  usePageTitle(t("account.title"));

  async function getCertificate(receipt) {
    setBusyId(receipt.id);
    setFailed(false);
    try {
      await downloadFile(`/api/receipts/${receipt.id}/pdf`, `80G-${receipt.receiptNo.replace(/\//g, "-")}.pdf`);
    } catch {
      setFailed(true);
    }
    setBusyId(null);
  }

  const donations = data?.donations || [];

  return (
    <div className="container stack">
      <div>
        <h1>{t("account.title")}</h1>
        {user && <p className="muted">{t("account.hello", { name: user.name })}</p>}
      </div>
      {loading && <Loading rows={2} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {failed && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={22} />
          <p>{t("done.downloadFailed")}</p>
        </div>
      )}
      {!loading && !error && donations.length === 0 && (
        <EmptyState
          icon="info"
          title={t("account.empty")}
          text={t("account.emptyHelp")}
          action={<Link to="/donate" className="btn">{t("nav.donate")}</Link>}
        />
      )}
      {donations.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
          {donations.map((d) => (
            <li key={d.id} className="card">
              <div className="row between">
                <strong style={{ fontSize: "1.3rem" }}>{formatRupees(d.amount)}</strong>
                <span className="tag">{d.type === "monthly" ? t("account.monthly") : t("account.once")}</span>
              </div>
              <p className="muted" style={{ margin: "0.3rem 0" }}>
                {pick(d.campaign?.title, lang)} · {formatDate(d.paidAt || d.createdAt, lang)}
              </p>
              {d.receipt && (
                <div className="row between">
                  <span className="small">{d.receipt.receiptNo}</span>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => getCertificate(d.receipt)}
                    disabled={busyId === d.receipt.id}
                    aria-label={`${t("account.download")} ${d.receipt.receiptNo}`}
                  >
                    <Icon name="download" size={18} /> {t("account.download")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
