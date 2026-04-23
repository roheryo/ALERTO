import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

import profileIcon from "../assets/images/account.png";

import {
  FaHome,
  FaUserPlus,
  FaClipboardList,
  FaChartBar,
  FaBell,
  FaSignOutAlt
} from "react-icons/fa";

function Sidebar() {

  const location = useLocation();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const roleFromUser =
    user?.role ??
    user?.userRole ??
    user?.user_role ??
    user?.accountRole ??
    user?.account_role;

  const inferredRole = (() => {
    if (roleFromUser && String(roleFromUser).trim()) return String(roleFromUser).trim();
    if (!user) return null;
    if (user.barangay && String(user.barangay).trim()) return "Barangay Employee";
    if (user.municipality && String(user.municipality).trim()) return "Municipal Employee";
    return "Provincial Employee";
  })();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("user");
      navigate("/login");
    }
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
          {user?.username || "Guest"}
        </h4>

        {/* 🔥 ROLE DISPLAY FIX */}
        <p className="profile-role">
          {inferredRole || "No Role"}
        </p>

      </div>

      <div className="sidebar-divider"></div>

      <ul className="menu-list">

        <li className={location.pathname === "/dashboard" ? "active" : ""}>
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

      </ul>

      <div className="logout-section">
        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt className="menu-icon" />
          Logout
        </button>
      </div>

    </div>
  );
}

export default Sidebar;