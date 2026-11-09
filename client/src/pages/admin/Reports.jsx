import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, Loading } from "../../components/States.jsx";
import { Icon } from "../../components/Icons.jsx";
import { TextField } from "../../components/Field.jsx";
import { api, downloadFile } from "../../lib/api.js";
import { formatDate, formatRupees, pick } from "../../lib/format.js";
import { useApi } from "../../lib/useApi.js";

function currentFinancialYear() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export default function Reports() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fy, setFy] = useState(currentFinancialYear());
  const [fyError, setFyError] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvFailed, setCsvFailed] = useState(false);
  const [subs, setSubs] = useState({ busy: false, result: null, failed: false });

  const report = useApi(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(`${from}T00:00:00+05:30`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59+05:30`).toISOString());
    return api.get(`/api/admin/reports/campaigns?${params.toString()}`);
  }, [from, to]);
  const callbacks = useApi(() => api.get("/api/admin/callbacks"), []);

  async function downloadCsv(e) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(fy)) return setFyError(t("admin.rep.fyError"));
    setFyError("");
    setCsvBusy(true);
    setCsvFailed(false);
    try {
      await downloadFile(`/api/admin/reports/form10bd.csv?fy=${encodeURIComponent(fy)}`, `form-10bd-${fy}.csv`);
    } catch {
      setCsvFailed(true);
    }
    setCsvBusy(false);
    return undefined;
  }

  async function runSubs() {
    setSubs({ busy: true, result: null, failed: false });
    try {
      const res = await api.post("/api/admin/subscriptions/run");
      setSubs({ busy: false, result: res.processed, failed: false });
      report.reload();
    } catch {
      setSubs({ busy: false, result: null, failed: true });
    }
  }

  async function markCalled(id) {
    await api.patch(`/api/admin/callbacks/${id}`, { status: "called" });
    callbacks.reload();
  }

  const rows = report.data?.campaigns || [];

  return (
    <div className="stack">
      <section className="section-card stack" aria-labelledby="rep-c">
        <h2 id="rep-c">{t("admin.rep.campaigns")}</h2>
        <div className="grid-2">
          <TextField label={t("admin.rep.from")} type="date" value={from} onChange={setFrom} />
          <TextField label={t("admin.rep.to")} type="date" value={to} onChange={setTo} />
        </div>
        {report.loading && <Loading />}
        {report.error && <ErrorState error={report.error} onRetry={report.reload} />}
        {report.data && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("admin.rep.campaign")}</th>
                  <th className="num">{t("admin.rep.count")}</th>
                  <th className="num">{t("admin.rep.total")}</th>
                  <th className="num">{t("admin.rep.average")}</th>
                  <th className="num">{t("admin.rep.donors")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug}>
                    <td>{pick(r.title, lang)}</td>
                    <td className="num">{r.donations}</td>
                    <td className="num">{formatRupees(r.total)}</td>
                    <td className="num">{formatRupees(r.average)}</td>
                    <td className="num">{r.uniqueDonors}</td>
                  </tr>
                ))}
                <tr>
                  <th>{t("admin.rep.grand")}</th>
                  <th className="num">{report.data.totals.donations}</th>
                  <th className="num">{formatRupees(report.data.totals.total)}</th>
                  <th />
                  <th />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-card" aria-labelledby="rep-10">
        <h2 id="rep-10">{t("admin.rep.form10bd")}</h2>
        <form className="stack" onSubmit={downloadCsv} noValidate>
          <div style={{ maxWidth: "18rem" }}>
            <TextField label={t("admin.rep.fy")} value={fy} onChange={setFy} error={fyError} autoComplete="off" />
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {t("admin.rep.csvNote")}
          </p>
          {csvFailed && (
            <div className="notice error" role="alert">
              <Icon name="alert" size={22} />
              <p>{t("common.error")}</p>
            </div>
          )}
          <div>
            <button type="submit" className="btn secondary" disabled={csvBusy}>
              <Icon name="download" size={20} /> {t("admin.rep.download")}
            </button>
          </div>
        </form>
      </section>

      <section className="section-card stack" aria-labelledby="rep-s">
        <h2 id="rep-s">{t("admin.rep.subs")}</h2>
        <div>
          <button type="button" className="btn secondary" onClick={runSubs} disabled={subs.busy}>
            {t("admin.rep.runSubs")}
          </button>
        </div>
        {subs.result !== null && (
          <div className="notice ok" role="status">
            <Icon name="check" size={22} />
            <p>{t("admin.rep.subsResult", { count: subs.result })}</p>
          </div>
        )}
        {subs.failed && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={22} />
            <p>{t("common.error")}</p>
          </div>
        )}
      </section>

      <section className="section-card stack" aria-labelledby="rep-cb">
        <h2 id="rep-cb">{t("admin.rep.callbacks")}</h2>
        {callbacks.loading && <Loading />}
        {callbacks.error && <ErrorState error={callbacks.error} onRetry={callbacks.reload} />}
        {callbacks.data && callbacks.data.callbacks.length === 0 && <EmptyState icon="phone" title={t("admin.rep.noCallbacks")} />}
        {callbacks.data && callbacks.data.callbacks.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("callback.name")}</th>
                  <th>{t("admin.rep.phone")}</th>
                  <th>{t("admin.rep.scheme")}</th>
                  <th>{t("admin.rep.when")}</th>
                  <th>{t("admin.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {callbacks.data.callbacks.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.schemeCode || "–"}</td>
                    <td>{formatDate(c.createdAt, lang)}</td>
                    <td>
                      {c.status === "called" ? (
                        <span className="tag published">{t("admin.rep.called")}</span>
                      ) : (
                        <button type="button" className="btn secondary small" onClick={() => markCalled(c._id)}>
                          {t("admin.rep.markCalled")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
