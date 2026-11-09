import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { Loading } from "./components/States.jsx";
import { useAuth } from "./lib/auth.jsx";
import Home from "./pages/Home.jsx";
import SchemeDetail from "./pages/SchemeDetail.jsx";
import Finder from "./pages/Finder.jsx";
import Donate from "./pages/Donate.jsx";
import DonationDone from "./pages/DonationDone.jsx";
import Campaign from "./pages/Campaign.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import Account from "./pages/Account.jsx";
import { Forbidden, NotFound, Privacy } from "./pages/Static.jsx";

// The admin screens are only needed by trust staff, so they load on demand and keep the
// public pages light on slow connections.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.jsx"));
const SchemeList = lazy(() => import("./pages/admin/SchemeList.jsx"));
const SchemeEditor = lazy(() => import("./pages/admin/SchemeEditor.jsx"));
const Reports = lazy(() => import("./pages/admin/Reports.jsx"));

// Hiding a link is not security (the API checks the role too), but a visitor should
// still get a sensible page instead of a broken one.
function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="container"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Forbidden />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<div className="container"><Loading /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="schemes/:code" element={<SchemeDetail />} />
          <Route path="finder" element={<Finder />} />
          <Route path="campaigns/:slug" element={<Campaign />} />
          <Route path="donate" element={<Donate />} />
          <Route path="donate/done/:key" element={<DonationDone />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="privacy" element={<Privacy />} />
          <Route
            path="account"
            element={
              <RequireRole>
                <Account />
              </RequireRole>
            }
          />
          <Route
            path="admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="schemes" replace />} />
            <Route path="schemes" element={<SchemeList />} />
            <Route path="schemes/new" element={<SchemeEditor />} />
            <Route path="schemes/:id" element={<SchemeEditor />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
