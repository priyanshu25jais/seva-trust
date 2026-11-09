import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icons.jsx";
import { useAuth } from "../lib/auth.jsx";

export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const first = useRef(true);

  // After each page change, move focus to the page so keyboard and screen reader users
  // start at the top of the new content (single-page apps do not do this by themselves).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const other = i18n.language === "hi" ? "en" : "hi";

  return (
    <>
      <a className="skip-link" href="#main">
        {t("common.skip")}
      </a>
      <header className="site-header">
        <div className="container wide bar">
          <Link to="/" className="brand">
            <Icon name="logo" size={30} /> {t("common.appName")}
          </Link>
          <button
            type="button"
            className="btn ghost small lang-toggle"
            lang={other}
            aria-label={t("nav.languageLabel")}
            onClick={() => i18n.changeLanguage(other)}
          >
            {t("nav.language")}
          </button>
          <nav className="site-nav" aria-label={t("nav.main")}>
            <NavLink to="/" end>
              {t("nav.schemes")}
            </NavLink>
            <NavLink to="/finder">{t("nav.finder")}</NavLink>
            {user?.role === "admin" && <NavLink to="/admin">{t("nav.admin")}</NavLink>}
            {user && <NavLink to="/account">{t("nav.account")}</NavLink>}
            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                {t("nav.logout")}
              </button>
            ) : (
              <NavLink to="/login">{t("nav.login")}</NavLink>
            )}
            <Link to="/donate" className="nav-cta">
              {t("nav.donate")}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container wide">
          <nav aria-label="footer">
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/finder">{t("nav.finder")}</Link>
            <Link to="/donate">{t("nav.donate")}</Link>
          </nav>
          <p style={{ margin: "0 0 0.4rem" }}>{t("footer.noTrackers")}</p>
          <p style={{ margin: 0 }}>{t("footer.demo")}</p>
        </div>
      </footer>
    </>
  );
}

// Sets the browser tab title for a page.
export function usePageTitle(title) {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = title ? `${title} · ${t("common.appName")}` : t("common.appName");
  }, [title, t]);
}
