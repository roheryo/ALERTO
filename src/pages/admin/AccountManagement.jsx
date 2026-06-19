import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import "./AccountManagement.css";

function PasswordResetRow({ token, account, readOnly, onDone, showMunicipality }) {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (readOnly) return;
    if (pw.length < 8) {
      setMsg("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/admin/users/${account.id}/password`, {
        token,
        method: "PATCH",
        body: { newPassword: pw }
      });
      setPw("");
      setShowPw(false);
      setMsg("Password updated.");      onDone?.();
    } catch (err) {
      setMsg(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td className="am-cell-username">{account.username}</td>
      <td>{account.fullName}</td>
      {showMunicipality ? <td>{account.municipalityName ?? "—"}</td> : null}
      {!showMunicipality ? <td>{account.barangayName ?? "—"}</td> : null}
      <td className="am-cell-password">
        {readOnly ? (
          <span className="am-badge am-badge--muted">View only</span>
        ) : (
          <form className="am-reset-form" onSubmit={submit}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="am-sr-only"
              value={account.username}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="am-password-field">
              <input
                type={showPw ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                placeholder="New password"
                className="am-reset-input"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                disabled={busy}
                aria-label={`New password for ${account.username}`}
              />
              <button
                type="button"
                className="am-password-toggle"
                onClick={() => setShowPw((v) => !v)}
                disabled={busy}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
              >
                {showPw ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
              </button>
            </div>
            <button type="submit" className="am-reset-btn" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>            {msg ? (
              <span className={`am-msg${msg.includes("updated") ? " am-msg--ok" : " am-msg--err"}`}>
                {msg}
              </span>
            ) : null}
          </form>
        )}
      </td>
    </tr>
  );
}

function AccountTable({ accounts, token, readOnly, onDone, emptyMessage, showMunicipality }) {
  if (!accounts.length) {
    return <p className="am-empty">{emptyMessage}</p>;
  }

  return (
    <div className="am-table-scroll">
      <table className="am-table">
        <thead>
          <tr>
            <th scope="col">Username</th>
            <th scope="col">Display name</th>
            {showMunicipality ? <th scope="col">Municipality</th> : null}
            {!showMunicipality ? <th scope="col">Barangay</th> : null}
            <th scope="col">Password</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <PasswordResetRow
              key={a.id}
              token={token}
              account={a}
              readOnly={readOnly}
              onDone={onDone}
              showMunicipality={showMunicipality}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AccountManagement() {
  const { token, user } = useAuth();
  const [muniAccounts, setMuniAccounts] = useState([]);
  const [brgyAccounts, setBrgyAccounts] = useState([]);
  const [brgyReadOnly, setBrgyReadOnly] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setLoadError("");
    try {
      if (user.role === "province") {
        const mun = await apiFetch("/admin/municipality-accounts", { token });
        setMuniAccounts(mun.accounts ?? []);
        setBrgyAccounts([]);
        setBrgyReadOnly(false);
      } else if (user.role === "municipality") {
        const brgy = await apiFetch("/admin/barangay-accounts", { token });
        setMuniAccounts([]);
        setBrgyAccounts(brgy.accounts ?? []);
        setBrgyReadOnly(Boolean(brgy.readOnly));
      }
    } catch (e) {
      setLoadError(e.message || "Could not load accounts");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    load();
  }, [load]);

  const isProvince = user?.role === "province";
  const jurisdiction = isProvince
    ? "Davao de Oro Province"
    : String(user?.municipalityName ?? "Municipality").trim();

  const headerSubline = isProvince
    ? "Province · rotate municipality account passwords in Davao de Oro"
    : "Municipality · rotate barangay BHU passwords in your jurisdiction";

  const accountCount = isProvince ? muniAccounts.length : brgyAccounts.length;
  const sectionTitle = isProvince ? "Municipality accounts" : "Barangay accounts";
  const sectionHint = isProvince
    ? "Reset passwords for municipality accounts. Barangay passwords are managed by each municipality."
    : "One account per barangay. Set a new password when a user is locked out or rotated.";

  const accounts = useMemo(
    () => (isProvince ? muniAccounts : brgyAccounts),
    [isProvince, muniAccounts, brgyAccounts]
  );

  return (
    <div className="am-page">
      <DashboardPageHeader pageTitle="Account management" subline={headerSubline} />

      <div className="am-main">
        <section className="am-summary" aria-label="Account management overview">
          <div className="am-summary-row">
            <div className="am-summary-copy">
              <p className="am-summary-kicker">{isProvince ? "Province admin" : "Municipality admin"}</p>
              <h2 className="am-summary-title">{sectionTitle}</h2>
            </div>
            <dl className="am-summary-stats">
              <div className="am-stat">
                <dt>Jurisdiction</dt>
                <dd>{jurisdiction}</dd>
              </div>
              <div className="am-stat">
                <dt>{isProvince ? "Municipalities" : "Barangays"}</dt>
                <dd>{loading ? "—" : accountCount}</dd>
              </div>
              {!loading && !loadError && !isProvince && brgyReadOnly ? (
                <div className="am-stat am-stat--muted">
                  <dt>Access</dt>
                  <dd>Read-only</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <p className="am-summary-hint">{sectionHint}</p>
        </section>
        {loading ? (
          <p className="am-status" role="status">
            Loading accounts…
          </p>
        ) : null}

        {loadError ? (
          <p className="am-status am-status--error" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loading && !loadError ? (
          <section className="am-panel" aria-label={sectionTitle}>
            <AccountTable              accounts={accounts}
              token={token}
              readOnly={!isProvince && brgyReadOnly}
              onDone={load}
              showMunicipality={isProvince}
              emptyMessage={
                isProvince ? "No municipality accounts found." : "No barangay accounts found."
              }
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
