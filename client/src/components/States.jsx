import { useTranslation } from "react-i18next";
import { Icon } from "./Icons.jsx";

// Loading, empty and error states used on every screen.
export function Loading({ rows = 0, label }) {
  const { t } = useTranslation();
  const text = label || t("common.loading");
  if (rows > 0) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{text}</span>
        <div className="scheme-list">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="skeleton card-sk" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <p role="status" aria-live="polite" className="state muted">
      <span className="spinner" aria-hidden="true" /> {text}
    </p>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useTranslation();
  const message = error && error.code === "network" ? t("common.network") : t("common.error");
  return (
    <div className="state error" role="alert">
      <Icon name="alert" size={36} />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn secondary" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "info", title, text, action }) {
  return (
    <div className="state">
      <Icon name={icon} size={36} />
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}
