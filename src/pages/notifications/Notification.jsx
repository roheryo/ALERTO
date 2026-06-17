import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

import "@/styles/dashboard-shell.css";
import "./Notification.css";
import logo from "@/assets/images/ddoLOGO.jpg";

/**
 * Placeholder Notifications page.
 *
 * The previous implementation rendered persisted Early-Warning alerts from
 * `/api/alerts`. That backend has been removed pending a rewrite of the
 * Early-Warning module. This stub exists so existing routes (`/dashboard/
 * notification`) keep working without breaking the build.
 *
 * When the new Early-Warning module is ready, replace the body of this
 * component with the new notification feed.
 */
function Notification() {
  return (
    <div className="notify-page">
      <header className="dashboard-header">
        <div className="notify-header-lead">
          <h2 className="header-title">Predictive Alerts and Notifications</h2>
          <p className="header-subline">
            ALERTO Early Warning Center — proactive disease surveillance support for health officials
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
          <img src={logo} alt="logo" className="header-logo" />
        </div>
      </header>

      <div className="notify-body">
        <div
          className="notify-empty"
          role="status"
          aria-live="polite"
          style={{ padding: "3rem 1rem", textAlign: "center" }}
        >
          <h3 style={{ marginBottom: "0.5rem" }}>Early-Warning module is being rebuilt</h3>
          <p style={{ maxWidth: 540, margin: "0 auto", color: "#475569" }}>
            The notification feed will return once the Early-Warning &amp; Outbreak Watch
            module has been redesigned. The municipal surveillance dashboard, forecasts,
            and case reporting tools continue to work normally.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Notification;
