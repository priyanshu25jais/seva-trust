import { useTranslation } from "react-i18next";

export default function Home() {
  const { t, i18n } = useTranslation();

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "hi" ? "en" : "hi");
  }

  return (
    <main>
      <h1>{t("home.heading")}</h1>
      <button type="button" onClick={toggleLanguage}>
        {t("language.toggle")}
      </button>
    </main>
  );
}
