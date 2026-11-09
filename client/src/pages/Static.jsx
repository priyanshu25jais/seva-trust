import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/States.jsx";
import { usePageTitle } from "../components/Layout.jsx";

export function Privacy() {
  const { t } = useTranslation();
  usePageTitle(t("privacy.title"));
  return (
    <div className="container stack">
      <h1>{t("privacy.title")}</h1>
      <p className="lead muted">{t("privacy.intro")}</p>
      <ul className="stack-sm">
        {["p1", "p2", "p3", "p4", "p5"].map((k) => (
          <li key={k}>{t(`privacy.${k}`)}</li>
        ))}
      </ul>
    </div>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  usePageTitle(t("notFound.title"));
  return (
    <div className="container">
      <EmptyState
        icon="search"
        title={t("notFound.title")}
        text={t("notFound.text")}
        action={
          <Link to="/" className="btn">
            {t("common.home")}
          </Link>
        }
      />
    </div>
  );
}

export function Forbidden() {
  const { t } = useTranslation();
  usePageTitle(t("forbidden.title"));
  return (
    <div className="container">
      <EmptyState
        icon="alert"
        title={t("forbidden.title")}
        text={t("forbidden.text")}
        action={
          <Link to="/" className="btn">
            {t("common.home")}
          </Link>
        }
      />
    </div>
  );
}
