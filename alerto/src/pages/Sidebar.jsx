import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

import profileIcon from "../assets/images/account.png";
import { useAuth } from "../context/AuthContext";

import {
  FaHome,
  FaUserPlus,
  FaClipboardList,
  FaChartBar,
  FaBell,
  FaUsersCog,
  FaSignOutAlt
} from "react-icons/fa";

function Sidebar() {

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const pathname = location.pathname;
  const isDashboardActive =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    (pathname.startsWith("/dashboard/") &&
      pathname !== "/dashboard/account-management");

  const canManageAccounts =
    user?.role === "province" || user?.role === "municipality";

  const displayName = user?.fullName ?? "User";

  const handleLogout = () => {

    logout();
    navigate("/login", { replace: true });

  };

  return (

    <div className="sidebar">

      <h3 className="sidebar-title">
        Disease Surveillance
      </h3>

      <div className="profile-section">

        <img
          src={profileIcon}
          alt="Profile"
          className="profile-icon"
        />

        <h4 className="profile-name">
          {displayName}
        </h4>

        <p className="profile-role">
          {user?.role === "province"
            ? "Province"
            : user?.role === "municipality"
              ? "Municipality"
              : user?.role === "barangay"
                ? "Barangay"
                : ""}
        </p>

      </div>

      <div className="sidebar-divider"></div>

      <ul className="menu-list">

        <li className={isDashboardActive ? "active" : ""}>
          <Link to="/dashboard">
            <FaHome className="menu-icon" />
            Dashboard
          </Link>
        </li>

        <li className={location.pathname === "/dashboard/add-patient" ? "active" : ""}>
          <Link to="/dashboard/add-patient">
            <FaUserPlus className="menu-icon" />
            Add New Patient
          </Link>
        </li>

        <li className={location.pathname === "/dashboard/cases" ? "active" : ""}>
          <Link to="/dashboard/cases">
            <FaClipboardList className="menu-icon" />
            Cases Logs
          </Link>
        </li>

        <li className={location.pathname === "/dashboard/reports" ? "active" : ""}>
          <Link to="/dashboard/reports">
            <FaChartBar className="menu-icon" />
            Reports
          </Link>
        </li>

        <li className={location.pathname === "/dashboard/notification" ? "active" : ""}>
          <Link to="/dashboard/notification">
            <FaBell className="menu-icon" />
            Notification
          </Link>
        </li>

        {canManageAccounts ? (
          <li className={location.pathname === "/dashboard/account-management" ? "active" : ""}>
            <Link to="/dashboard/account-management">
              <FaUsersCog className="menu-icon" />
              Account management
            </Link>
          </li>
        ) : null}

      </ul>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <FaSignOutAlt className="menu-icon" />
          Log out
        </button>
      </div>

    </div>

  );

}

export default Sidebar;
