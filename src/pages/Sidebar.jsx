import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

import profileIcon from "../assets/images/account.png";

/* ICONS */
import {
  FaHome,
  FaUserPlus,
  FaClipboardList,
  FaChartBar,
  FaBell
} from "react-icons/fa";

function Sidebar() {

  const location = useLocation();

  // 🔥 GET USER FROM LOCAL STORAGE
  const user = JSON.parse(localStorage.getItem("user"));

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

        {/* 🔥 DISPLAY USERNAME */}
        <h4 className="profile-name">
          {user?.username || "Guest"}
        </h4>

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

    </div>

  );

}

export default Sidebar;