import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icons.jsx";
import { formatDate, pick } from "../lib/format.js";

export function SchemeCard({ scheme }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <li className="card scheme-card">
      <span className="tag">
        <Icon name={scheme.need} size={16} /> {t(`home.need.${scheme.need}`)}
      </span>
      <h3>
        <Link to={`/schemes/${scheme.code}`}>{pick(scheme.title, lang)}</Link>
      </h3>
      <p className="benefit">{pick(scheme.benefit, lang)}</p>
      <p className="meta">{t("home.lastChecked", { date: formatDate(scheme.lastChecked, lang) })}</p>
    </li>
  );
}
