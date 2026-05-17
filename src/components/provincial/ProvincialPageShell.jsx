import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

import logo from "@/assets/images/ddoLOGO.jpg";
import "@/styles/dashboard-shell.css";
import "@/pages/dashboard/ProvincialDashboard.css";

function fmtSyncedAt(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function ProvincialPageShell({
  title,
  subline = "",
  lastSyncedAt = null,
  loading = false,
  children
}) {
  const synced = fmtSyncedAt(lastSyncedAt);
  const sub =
    subline ||
    [
      "Davao de Oro · Provincial Health Office",
      synced ? `Last synced ${synced}` : null,
      loading ? "Updating…" : null
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="dashboard-container prov-page">
      <header className="dashboard-header">
        <div>
          <h2 className="header-title">{title}</h2>
          <p className="header-subline">
            <span className="prov-live-dot" aria-hidden="true" />
            {sub}
          </p>
        </div>
        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>
          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>Provincial Health Office</p>
          </div>
          <img src={logo} alt="Davao de Oro logo" className="header-logo" />
        </div>
      </header>
      <div className="content-area content-area--provincial">{children}</div>
    </div>
  );
}
