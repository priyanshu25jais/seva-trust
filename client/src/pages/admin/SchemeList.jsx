import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Loading } from "../../components/States.jsx";
import { Icon } from "../../components/Icons.jsx";
import { api } from "../../lib/api.js";
import { formatDate, pick } from "../../lib/format.js";
import { useApi } from "../../lib/useApi.js";

const STATUSES = ["all", "draft", "review", "published"];

export default function SchemeList() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [status, setStatus] = useState("all");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  // Wait a moment after typing before searching.
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data, loading, error, reload } = useApi(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    return api.get(`/api/admin/schemes?${params.toString()}`);
  }, [status, q]);

  const schemes = data?.schemes || [];

  return (
    <div className="stack">
      <div className="row between">
        <div className="tabs" role="group" aria-label={t("admin.col.status")} style={{ margin: 0 }}>
          {STATUSES.map((s) => (
            <button key={s} type="button" className="tab" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {t(`admin.status.${s}`)}
            </button>
          ))}
        </div>
        <Link to="/admin/schemes/new" className="btn">
          <Icon name="plus" size={20} /> {t("admin.newScheme")}
        </Link>
      </div>

      <div style={{ maxWidth: "24rem" }}>
        <div className="field">
          <label htmlFor="scheme-search">{t("admin.search")}</label>
          <input id="scheme-search" className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>

      {loading && <Loading rows={2} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && schemes.length === 0 && <EmptyState icon="search" title={t("admin.empty")} />}
      {schemes.length > 0 && (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>{t("admin.col.code")}</th>
                <th>{t("admin.col.title")}</th>
                <th>{t("admin.col.need")}</th>
                <th>{t("admin.col.status")}</th>
                <th>{t("admin.col.summary")}</th>
                <th>{t("admin.col.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s._id}>
                  <td>
                    <Link to={`/admin/schemes/${s._id}`}>
                      <strong>{s.code}</strong>
                    </Link>
                  </td>
                  <td>
                    <Link to={`/admin/schemes/${s._id}`}>{pick(s.title, lang)}</Link>
                  </td>
                  <td>{t(`home.need.${s.need}`)}</td>
                  <td>
                    <span className={`tag ${s.status}`}>{t(`admin.status.${s.status}`)}</span>
                  </td>
                  <td>{t(`admin.summary.${s.summaryStatus || "none"}`)}</td>
                  <td>{formatDate(s.updatedAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
