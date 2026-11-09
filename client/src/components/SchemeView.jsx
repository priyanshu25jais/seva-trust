import { useTranslation } from "react-i18next";
import { Icon } from "./Icons.jsx";
import { formatDate, pick } from "../lib/format.js";

// The public scheme page body. Also used by the admin preview, so editors see exactly what
// the public will see.
export function SchemeView({ scheme }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const districts = scheme.districts && scheme.districts.length ? scheme.districts.join(", ") : t("scheme.allDistricts");
  const centre = scheme.helpCentre || {};

  return (
    <article>
      <p>
        <span className="tag">
          <Icon name={scheme.need} size={16} /> {t(`home.need.${scheme.need}`)}
        </span>
      </p>
      <h1>{pick(scheme.title, lang)}</h1>
      <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent-strong)" }}>{pick(scheme.benefit, lang)}</p>

      {scheme.summaryHi && (
        <section className="summary-box" aria-labelledby="sum-h">
          <h2 id="sum-h" style={{ fontSize: "1.05rem", margin: 0 }}>
            {t("scheme.summary")}
          </h2>
          <p lang="hi" style={{ margin: "0.4rem 0" }}>
            {scheme.summaryHi}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {t("scheme.summaryNote")}
          </p>
        </section>
      )}

      <section className="detail-block">
        <h2>{t("scheme.who")}</h2>
        <p>{pick(scheme.whoCanApply, lang)}</p>
        <p className="small muted">
          {t("scheme.districts")}: {districts}
        </p>
      </section>

      <section className="detail-block">
        <h2>{t("scheme.documents")}</h2>
        <ul>
          {(scheme.documents || []).map((d, i) => (
            <li key={i}>{pick(d, lang)}</li>
          ))}
        </ul>
      </section>

      <section className="detail-block">
        <h2>{t("scheme.how")}</h2>
        <p>{pick(scheme.howToApply, lang)}</p>
      </section>

      <section className="detail-block">
        <h2>{t("scheme.help")}</h2>
        <p style={{ marginBottom: 0 }}>
          <Icon name="pin" size={18} /> <strong>{centre.name}</strong>
          <br />
          <span className="muted">
            {centre.address}
            {centre.district ? `, ${centre.district}` : ""}
          </span>
        </p>
      </section>

      <section className="detail-block">
        <p style={{ margin: 0 }}>
          <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t("scheme.source")} <span className="sr-only">{t("common.opensNew")}</span>
          </a>
          <br />
          <span className="small muted">{t("scheme.lastChecked", { date: formatDate(scheme.lastChecked, lang) })}</span>
        </p>
      </section>
    </article>
  );
}
