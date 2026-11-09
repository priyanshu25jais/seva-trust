import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "../../components/Layout.jsx";

export default function AdminLayout() {
  const { t } = useTranslation();
  usePageTitle(t("admin.title"));
  return (
    <div className="container wide">
      <h1 style={{ fontSize: "1.6rem" }}>{t("admin.title")}</h1>
      <nav className="admin-tabs" aria-label={t("admin.title")}>
        <NavLink to="/admin/schemes" className="tab">
          {t("admin.schemes")}
        </NavLink>
        <NavLink to="/admin/reports" className="tab">
          {t("admin.reports")}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
