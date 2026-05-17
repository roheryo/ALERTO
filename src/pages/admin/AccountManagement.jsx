import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
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
      <td>{account.username}</td>
      <td>{account.fullName}</td>
      <td>{account.municipalityName ?? "—"}</td>
      <td>{account.barangayName ?? "—"}</td>
      <td>
        {readOnly ? (
          <span className="am-readonly">View only</span>
        ) : (
          <form className="am-reset-form" onSubmit={submit}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={busy}
            />
            <button type="submit" disabled={busy}>
              {busy ? "…" : "Save"}
            </button>
            {msg ? <span className="am-msg">{msg}</span> : null}
          </form>
        )}
      </td>
    </tr>
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
        const [mun, brgy] = await Promise.all([
          apiFetch("/admin/municipality-accounts", { token }),
          apiFetch("/admin/barangay-accounts", { token })
        ]);
        setMuniAccounts(mun.accounts ?? []);
        setBrgyAccounts(brgy.accounts ?? []);
        setBrgyReadOnly(Boolean(brgy.readOnly));
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

  const title =
    user?.role === "province"
      ? "Account management (Province)"
      : "Account management (Municipality)";

  return (
    <div className="am-page">
      <div className="am-header">
        <h2>{title}</h2>
        <p className="am-sub">
          Accounts are not self-registered. Use this screen only to rotate passwords for
          accounts in your jurisdiction.
        </p>
      </div>

      {loading ? <p className="am-muted">Loading…</p> : null}
      {loadError ? <p className="am-error">{loadError}</p> : null}

      {user?.role === "province" && !loading ? (
        <section className="am-section">
          <h3>Municipality accounts</h3>
          <p className="am-hint">
            You may reset passwords for municipality accounts in Davao de Oro. Barangay
            passwords are managed by each municipality.
          </p>
          <div className="am-table-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Display name</th>
                  <th>Municipality</th>
                  <th>Barangay</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {muniAccounts.map((a) => (
                  <PasswordResetRow
                    key={a.id}
                    token={token}
                    account={a}
                    readOnly={false}
                    onDone={load}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && (user?.role === "municipality" || user?.role === "province") ? (
        <section className="am-section">
          <h3>Barangay accounts</h3>
          <p className="am-hint">
            {brgyReadOnly
              ? "Province oversight: read-only list of all barangay logins in the province."
              : "One account exists per barangay. Set a new password when a barangay user is locked out or rotated."}
          </p>
          <div className="am-table-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Display name</th>
                  <th>Municipality</th>
                  <th>Barangay</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {brgyAccounts.map((a) => (
                  <PasswordResetRow
                    key={a.id}
                    token={token}
                    account={a}
                    readOnly={brgyReadOnly}
                    onDone={load}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
