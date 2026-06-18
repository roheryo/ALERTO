import { Link } from "react-router-dom";
import { Bell } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useAlertSummary } from "@/hooks/useAlerts";

/**
 * Light breadcrumb header matching TACAS reference layout.
 * @param {{ pageTitle: string, subline?: string|null, showMlStatus?: boolean, mlActive?: boolean }} props
 */
export default function DashboardPageHeader({
  pageTitle,
  subline = null,
  showMlStatus = false,
  mlActive = false
}) {
  const { user } = useAuth();
  const isMunicipality = user?.role === "municipality";
  const { summary: alertSummary } = useAlertSummary({ enabled: isMunicipality });
  const activeAlertCount = alertSummary.active;

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <p className="dash-breadcrumb">
          <span className="dash-breadcrumb-brand">ALERTO</span>
          <span className="dash-breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="dash-breadcrumb-page">{pageTitle}</span>
        </p>
        {subline ? <p className="header-subline">{subline}</p> : null}
      </div>

      <div className="header-right">
        <div className="dash-status-pills">
          <span className="dash-status-pill">
            <span className="dash-status-pill-dot" aria-hidden="true" />
            System online
          </span>
          {showMlStatus ? (
            <span className={`dash-status-pill${mlActive ? "" : " dash-status-pill--muted"}`}>
              <span className="dash-status-pill-dot" aria-hidden="true" />
              {mlActive ? "ML forecast active" : "ML forecast offline"}
            </span>
          ) : null}
        </div>

        {isMunicipality ? (
          <Link
            className="header-notification-link"
            to="/dashboard/alerts"
            aria-label={
              activeAlertCount > 0
                ? `${activeAlertCount} active alert${activeAlertCount === 1 ? "" : "s"}`
                : "Alerts"
            }
          >
            <Bell strokeWidth={2} aria-hidden="true" />
            {activeAlertCount > 0 ? (
              <span className="header-notification-badge">
                {activeAlertCount > 99 ? "99+" : activeAlertCount}
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
