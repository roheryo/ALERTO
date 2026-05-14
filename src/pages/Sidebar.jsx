import { useMemo, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  UserPlus,
  Bell,
  ClipboardList,
  PieChart,
  Users
} from "lucide-react";

import "./Sidebar.css";
import { useAuth } from "../context/AuthContext";
import LogoutConfirmModal from "../components/LogoutConfirmModal";

function initialsFromUser(user) {
  const name = String(user?.fullName ?? user?.username ?? "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "U";
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const closeLogoutModal = useCallback(() => setLogoutOpen(false), []);

  const pathname = location.pathname;

  const canManageAccounts =
    user?.role === "province" || user?.role === "municipality";

  const canReportCase =
    user?.role === "municipality" || user?.role === "barangay";

  const showExtendedNav =
    user?.role === "municipality" || user?.role === "province";

  const isDashboardActive = /^\/dashboard\/?$/.test(pathname);

  const isReportCaseActive =
    pathname === "/dashboard/report-case" || pathname === "/dashboard/add-patient";

  const isAlertsActive =
    pathname === "/dashboard/notification" || pathname.startsWith("/dashboard/notification/");

  const barangayLine = useMemo(() => {
    const b = user?.barangayName?.trim();
    if (b) return `${b} - Barangay`;
    if (user?.role === "barangay") return "Barangay";
    if (user?.role === "municipality" && user?.municipalityName) {
      return `${user.municipalityName} - Municipality`;
    }
    if (user?.role === "province" && user?.provinceName) {
      return `${user.provinceName} - Province`;
    }
    return "ALERTO";
  }, [user]);

  const locationSubtitle = useMemo(() => {
    if (user?.role === "barangay" && user?.barangayName) {
      return `BHU Brgy. ${user.barangayName}`;
    }
    if (user?.municipalityName && user?.barangayName) {
      return `${user.municipalityName} · ${user.barangayName}`;
    }
    if (user?.municipalityName) return user.municipalityName;
    if (user?.provinceName) return user.provinceName;
    return "Davao de Oro PHO";
  }, [user]);

  const locationLabel = useMemo(() => {
    if (user?.role === "barangay") return "Barangay";
    if (user?.role === "municipality") return "Municipality";
    if (user?.role === "province") return "Province";
    return "Workspace";
  }, [user]);

  const usernameLine = String(user?.username ?? user?.email ?? "—").trim();

  const avatarInitials = useMemo(() => initialsFromUser(user), [user]);

  const confirmLogout = () => {
    setLogoutOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-inner">
        <header className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">
            <span className="sidebar-brand-mark-text">AL</span>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">ALERTO</span>
            <span className="sidebar-brand-sub">DAVAO DE ORO PHO</span>
          </div>
        </header>

        <div className="sidebar-location-card">
          <span className="sidebar-location-dot" aria-hidden="true" />
          <div className="sidebar-location-copy">
            <span className="sidebar-location-label">{locationLabel}</span>
            <span className="sidebar-location-detail">{locationSubtitle}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main pages">
          <p className="sidebar-nav-heading">Menu</p>
          <ul className="sidebar-menu">
            <li>
              <Link
                className={`sidebar-link${isDashboardActive ? " is-active" : ""}`}
                to="/dashboard"
              >
                <LayoutGrid className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                <span>Dashboard</span>
              </Link>
            </li>

            {canReportCase ? (
              <li>
                <Link
                  className={`sidebar-link${isReportCaseActive ? " is-active" : ""}`}
                  to="/dashboard/report-case"
                >
                  <UserPlus className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                  <span>Report Case</span>
                </Link>
              </li>
            ) : null}

            <li>
              <Link
                className={`sidebar-link${isAlertsActive ? " is-active" : ""}`}
                to="/dashboard/notification"
              >
                <Bell className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                <span>Alerts</span>
              </Link>
            </li>

            {showExtendedNav ? (
              <>
                <li>
                  <Link
                    className={`sidebar-link${pathname === "/dashboard/cases" ? " is-active" : ""}`}
                    to="/dashboard/cases"
                  >
                    <ClipboardList className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                    <span>Cases Log</span>
                  </Link>
                </li>
                <li>
                  <Link
                    className={`sidebar-link${pathname === "/dashboard/reports" ? " is-active" : ""}`}
                    to="/dashboard/reports"
                  >
                    <PieChart className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                    <span>Reports</span>
                  </Link>
                </li>
              </>
            ) : null}
          </ul>

          {canManageAccounts ? (
            <>
              <p className="sidebar-nav-heading">Administration</p>
              <ul className="sidebar-menu">
                <li>
                  <Link
                    className={`sidebar-link${pathname === "/dashboard/account-management" ? " is-active" : ""}`}
                    to="/dashboard/account-management"
                  >
                    <Users className="sidebar-link-icon" strokeWidth={2} aria-hidden="true" />
                    <span>Account management</span>
                  </Link>
                </li>
              </ul>
            </>
          ) : null}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-profile"
          onClick={() => setLogoutOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="sidebar-profile-avatar" aria-hidden="true">
            {avatarInitials}
          </span>
          <span className="sidebar-profile-meta">
            <span className="sidebar-profile-place">{barangayLine}</span>
            <span className="sidebar-profile-user">{usernameLine}</span>
          </span>
        </button>
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        onCancel={closeLogoutModal}
        onConfirm={confirmLogout}
      />
    </aside>
  );
}

export default Sidebar;
