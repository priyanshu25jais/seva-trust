import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TextField } from "../components/Field.jsx";
import { Icon } from "../components/Icons.jsx";
import { usePageTitle } from "../components/Layout.jsx";
import { useAuth } from "../lib/auth.jsx";

function useAfterAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  return (user) => {
    const from = location.state?.from;
    navigate(from || (user.role === "admin" ? "/admin" : "/account"), { replace: true });
  };
}

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const after = useAfterAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  usePageTitle(t("auth.loginTitle"));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("auth.err.email");
    if (!password) next.password = t("auth.err.password");
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      after(await login(email.trim(), password));
    } catch (err) {
      setFailure(err.status === 401 || err.status === 400 ? t("auth.invalid") : err.code === "network" ? t("common.network") : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: "30rem" }}>
      <h1>{t("auth.loginTitle")}</h1>
      <form className="stack" onSubmit={submit} noValidate>
        {failure && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={22} />
            <p>{failure}</p>
          </div>
        )}
        <TextField label={t("auth.email")} type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="username" />
        <TextField label={t("auth.password")} type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? t("auth.working") : t("auth.loginButton")}
        </button>
        <p className="muted">
          {t("auth.noAccount")} <Link to="/register">{t("auth.registerTitle")}</Link>
        </p>
      </form>
    </div>
  );
}

export function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const after = useAfterAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  usePageTitle(t("auth.registerTitle"));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (name.trim().length < 2) next.name = t("auth.err.name");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("auth.err.email");
    if (password.length < 8) next.password = t("auth.err.password");
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      after(await register(name.trim(), email.trim(), password));
    } catch (err) {
      setFailure(err.status === 409 ? t("auth.exists") : err.code === "network" ? t("common.network") : t("common.error"));
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: "30rem" }}>
      <h1>{t("auth.registerTitle")}</h1>
      <form className="stack" onSubmit={submit} noValidate>
        {failure && (
          <div className="notice error" role="alert">
            <Icon name="alert" size={22} />
            <p>{failure}</p>
          </div>
        )}
        <TextField label={t("auth.name")} value={name} onChange={setName} error={errors.name} autoComplete="name" />
        <TextField label={t("auth.email")} type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
        <TextField label={t("auth.password")} hint={t("auth.passwordHelp")} type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" />
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? t("auth.working") : t("auth.registerButton")}
        </button>
        <p className="muted">
          {t("auth.haveAccount")} <Link to="/login">{t("auth.loginTitle")}</Link>
        </p>
      </form>
    </div>
  );
}
