import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

import AlertFeed from "@/components/alerts/AlertFeed";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import "@/styles/dashboard-shell.css";
import "./Notification.css";
import logo from "@/assets/images/ddoLOGO.jpg";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dismissed", label: "Dismissed" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All" }
];

const DISEASE_OPTIONS = [
  { value: "", label: "All diseases" },
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "Influenza-like Illness" },
  { value: "AWD", label: "Acute Watery Diarrhea" }
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "high", label: "High risk" },
  { value: "elevated", label: "Elevated" },
  { value: "watch", label: "Watch" }
];

function headerSubtitle(user) {
  if (user?.role === "municipality" && user?.municipalityName) {
    return `${user.municipalityName} Municipal Health Office`;
  }
  if (user?.role === "province" && user?.provinceName) {
    return `${user.provinceName} Provincial Health Office`;
  }
  if (user?.role === "barangay" && user?.barangayName) {
    return `Brgy. ${user.barangayName} Health Unit`;
  }
  return "ALERTO Early Warning Center";
}

function Notification() {
  const { user } = useAuth();
  const [status, setStatus] = useState("active");
  const [disease, setDisease] = useState("");
  const [severity, setSeverity] = useState("");

  const { grouped, summary, loading, error, canMutate, acknowledge, dismiss } = useAlerts({
    status,
    disease: disease || null,
    severity: severity || null
  });

  const subtitle = useMemo(() => headerSubtitle(user), [user]);

  return (
    <div className="notify-page">
      <header className="dashboard-header">
        <div className="notify-header-lead">
          <h2 className="header-title">Predictive Alerts and Notifications</h2>
          <p className="header-subline">{subtitle} — automated disease outbreak early warning</p>
        </div>
        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>
          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>{subtitle}</p>
          </div>
          <img src={logo} alt="logo" className="header-logo" />
        </div>
      </header>

      <div className="notify-body">
        <div className="notify-summary">
          <span className="pill high">High {summary.bySeverity.high}</span>
          <span className="pill warning">Elevated {summary.bySeverity.elevated}</span>
          <span className="pill info">Watch {summary.bySeverity.watch}</span>
        </div>

        <div className="notify-filters">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Disease
            <select value={disease} onChange={(e) => setDisease(e.target.value)}>
              {DISEASE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="notify-fallback-note" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="notify-empty" role="status" aria-live="polite">
            <p style={{ margin: 0, color: "#64748b" }}>Loading alerts…</p>
          </div>
        ) : (
          <AlertFeed
            grouped={grouped}
            canMutate={canMutate}
            onAcknowledge={acknowledge}
            onDismiss={dismiss}
          />
        )}
      </div>
    </div>
  );
}

export default Notification;
