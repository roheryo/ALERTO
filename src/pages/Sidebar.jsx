import { Link } from "react-router-dom";
import "./Sidebar.css";

import profileIcon from "../assets/images/account.png";

function Sidebar() {

  return (

    <div className="sidebar">

      {/* Title */}
      <h3 className="sidebar-title">
        Disease Surveillance
      </h3>

      {/* Profile Section */}
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

      {/* Sidebar Menu */}
      <ul>

        <li>
          <Link to="/">Dashboard</Link>
        </li>

        {/* NEW ITEM */}
        <li>
          <Link to="/add-patient">
            Add New Patient
          </Link>
        </li>

        <li>
          <Link to="/cases">
            Cases Logs
          </Link>
        </li>

        <li>
          <Link to="/reports">
            Reports
          </Link>
        </li>

        <li>
          <Link to="/notification">
            Notification
          </Link>
        </li>

      </ul>

    </div>

  );

}

export default Sidebar;