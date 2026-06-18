import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import "@/styles/dashboard-shell.css";
import "./AccountManagement.css";

function PasswordResetRow({ token, account, readOnly, onDone }) {
  const [pw, setPw] = useState("");
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
      setMsg("Password updated.");
      onDone?.();
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
      <td>{account.municipalityName ?? "—"}</td>
      <td>{account.barangayName ?? "—"}</td>
      <td className="am-cell-password">
        {readOnly ? (
          <span className="am-badge am-badge--muted">View only</span>
        ) : (
          <form className="am-reset-form" onSubmit={submit}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              className="am-reset-input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={busy}
              aria-label={`New password for ${account.username}`}
            />
            <button type="submit" className="am-reset-btn" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            {msg ? (
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

function AccountTable({ accounts, token, readOnly, onDone, emptyMessage }) {
  if (!accounts.length) {
    return <p className="am-empty">{emptyMessage}</p>;
  }

  return (
    <div className="am-table-card">
      <div className="am-table-scroll">
        <table className="am-table">
          <thead>
            <tr>
              <th scope="col">Username</th>
              <th scope="col">Display name</th>
              <th scope="col">Municipality</th>
              <th scope="col">Barangay</th>
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
              />
            ))}
          </tbody>
        </table>
      </div>
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
  const headerSubline = isProvince
    ? "Province · rotate municipality account passwords in Davao de Oro"
    : "Municipality · rotate barangay BHU passwords in your jurisdiction";

  const kpis = useMemo(
    () => ({
      municipalities: muniAccounts.length,
      barangays: brgyAccounts.length
    }),
    [muniAccounts.length, brgyAccounts.length]
  );

  return (
    <div className="am-page">
      <DashboardPageHeader pageTitle="Account management" subline={headerSubline} />

      <div className="am-main">
        <section className="am-intro" aria-label="Account management overview">
          <div className="am-intro-kpi" aria-label="Account counts">
            {isProvince ? (
              <div className="am-kpi">
                <div className="am-kpi-label">Municipalities</div>
                <div className="am-kpi-value">{loading ? "—" : kpis.municipalities}</div>
              </div>
            ) : (
              <div className="am-kpi">
                <div className="am-kpi-label">Barangays</div>
                <div className="am-kpi-value">{loading ? "—" : kpis.barangays}</div>
              </div>
            )}
          </div>

          <div className="am-intro-copy">
            <p className="am-scope-title">Jurisdiction</p>
            <p className="am-scope-value">
              {isProvince ? "Davao de Oro Province" : String(user?.municipalityName ?? "Municipality").trim()}
            </p>
            <p className="am-scope-hint">
              Accounts are not self-registered. Use this screen only to rotate passwords for accounts in
              your jurisdiction.
            </p>

            {isProvince ? (
              <>
                <h3 id="am-muni-heading" className="am-section-title">
                  Municipality accounts
                </h3>
                <p className="am-section-hint">
                  Reset passwords for municipality accounts in Davao de Oro. Barangay passwords are
                  managed by each municipality.
                </p>
              </>
            ) : (
              <>
                <h3 id="am-brgy-heading" className="am-section-title">
                  Barangay accounts
                </h3>
                <p className="am-section-hint">
                  One account exists per barangay. Set a new password when a barangay user is locked out
                  or rotated.
                </p>
              </>
            )}
          </div>

          <div className="am-intro-count">
            {!loading && !loadError ? (
              <span className="am-section-count">
                {isProvince ? muniAccounts.length : brgyAccounts.length} accounts
                {!isProvince && brgyReadOnly ? " · read-only" : ""}
              </span>
            ) : null}
          </div>
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

        {isProvince && !loading && !loadError ? (
          <section className="am-section" aria-labelledby="am-muni-heading">
            <AccountTable
              accounts={muniAccounts}
              token={token}
              readOnly={false}
              onDone={load}
              emptyMessage="No municipality accounts found."
            />
          </section>
        ) : null}

        {!loading && !loadError && user?.role === "municipality" ? (
          <section className="am-section" aria-labelledby="am-brgy-heading">
            <AccountTable
              accounts={brgyAccounts}
              token={token}
              readOnly={brgyReadOnly}
              onDone={load}
              emptyMessage="No barangay accounts found."
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
