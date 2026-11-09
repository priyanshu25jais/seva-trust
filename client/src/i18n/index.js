import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import hi from "./hi.json";
import en from "./en.json";

const LANG_KEY = "seva_lang";

function savedLanguage() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return value === "en" || value === "hi" ? value : "hi"; // Hindi first
  } catch {
    return "hi";
  }
}

i18n.use(initReactI18next).init({
  resources: {
    hi: { translation: hi },
    en: { translation: en },
  },
  lng: savedLanguage(),
  fallbackLng: "hi",
  interpolation: { escapeValue: false },
});

// Keep <html lang> correct (screen readers pick the right voice) and remember the choice.
function applyLanguage(lng) {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* ignore */
  }
}
applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

export default i18n;
