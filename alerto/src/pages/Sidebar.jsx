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

        <li className={location.pathname === "/" ? "active" : ""}>
          <Link to="/">
            <FaHome className="menu-icon" />
            Dashboard
          </Link>
        </li>

        <li className={location.pathname === "/add-patient" ? "active" : ""}>
          <Link to="/add-patient">
            <FaUserPlus className="menu-icon" />
            Add New Patient
          </Link>
        </li>

        <li className={location.pathname === "/cases" ? "active" : ""}>
          <Link to="/cases">
            <FaClipboardList className="menu-icon" />
            Cases Logs
          </Link>
        </li>

        <li className={location.pathname === "/reports" ? "active" : ""}>
          <Link to="/reports">
            <FaChartBar className="menu-icon" />
            Reports
          </Link>
        </li>

        <li className={location.pathname === "/notification" ? "active" : ""}>
          <Link to="/notification">
            <FaBell className="menu-icon" />
            Notification
          </Link>
        </li>

      </ul>

    </div>

  );

}

export default Sidebar;