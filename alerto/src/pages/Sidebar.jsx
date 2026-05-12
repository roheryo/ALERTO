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

  const pathname = location.pathname;
  const isDashboardActive =
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname.startsWith("/dashboard/");

  return (

    <div className="sidebar">

      {/* TITLE */}
      <h3 className="sidebar-title">
        Disease Surveillance
      </h3>


      {/* PROFILE */}
      <div className="profile-section">

        <img
          src={profileIcon}
          alt="Profile"
          className="profile-icon"
        />

        <h4 className="profile-name">
          Roger Madulara
        </h4>

      </div>


      {/* DIVIDER */}
      <div className="sidebar-divider"></div>


      {/* MENU */}
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

      </ul>

    </div>

  );

}

export default Sidebar;