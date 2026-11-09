import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CallbackForm } from "../components/CallbackForm.jsx";
import { EmptyState, ErrorState, Loading } from "../components/States.jsx";
import { SchemeView } from "../components/SchemeView.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { api } from "../lib/api.js";
import { pick } from "../lib/format.js";
import { useApi } from "../lib/useApi.js";

export default function SchemeDetail() {
  const { code } = useParams();
  const { t, i18n } = useTranslation();
  const { data, loading, error, reload } = useApi(() => api.get(`/api/schemes/${encodeURIComponent(code)}`), [code]);
  usePageTitle(data ? pick(data.scheme.title, i18n.language) : t("scheme.all"));

  return (
    <div className="container stack">
      <p style={{ margin: 0 }}>
        <Link to="/">← {t("scheme.all")}</Link>
      </p>
      {loading && <Loading rows={2} />}
      {error && error.status === 404 && (
        <EmptyState
          icon="search"
          title={t("scheme.notFound")}
          text={t("scheme.notFoundHelp")}
          action={
            <Link to="/" className="btn secondary">
              {t("scheme.all")}
            </Link>
          }
        />
      )}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <SchemeView scheme={data.scheme} />
          <div className="row">
            <Link to="/finder" className="btn secondary">
              {t("scheme.checkEligibility")}
            </Link>
          </div>
          <CallbackForm schemeCode={data.scheme.code} />
        </>
      )}
    </div>
  );
}
