import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

import profileIcon from "../assets/images/account.png";

import {
  FaHome,
  FaUserPlus,
  FaClipboardList,
  FaChartBar,
  FaSignOutAlt
} from "react-icons/fa";

function Sidebar() {

  const location = useLocation();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const roleFromUser =
    user?.role ??
    user?.Role ??
    user?.userRole ??
    user?.user_role ??
    user?.accountRole ??
    user?.account_role;

  const roleKey = (() => {
    const r = String(roleFromUser ?? "").trim().toLowerCase();
    if (r.includes("barangay")) return "barangay";
    if (r.includes("municipal")) return "municipal";
    if (r.includes("provincial") || r.includes("province")) return "provincial";
    if (!user) return null;
    if (user.barangay && String(user.barangay).trim()) return "barangay";
    if (user.municipality && String(user.municipality).trim()) return "municipal";
    return "provincial";
  })();

  const municipalityName = String(user?.municipality ?? "").trim();
  const barangayName = String(user?.barangay ?? "").trim();
  const provinceName = String(user?.province ?? "Davao de Oro").trim();

  const roleLabel = (() => {
    if (!roleKey) return null;
    if (roleKey === "barangay") {
      if (municipalityName && barangayName) {
        return `Municipality of ${municipalityName}, Barangay ${barangayName} Employee`;
      }
      if (municipalityName) return `Municipality of ${municipalityName}, Barangay Employee`;
      return "Barangay Employee";
    }
    if (roleKey === "municipal") {
      if (municipalityName) return `Municipality of ${municipalityName} Employee`;
      return "Municipal Employee";
    }
    if (provinceName) return `Province of ${provinceName} Employee`;
    return "Provincial Employee";
  })();

  const canAddPatient = (() => {
    if (!user) return false;
    return roleKey === "municipal" || roleKey === "barangay";
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

        <div className="profile-meta">
          <h4 className="profile-name">
            {user?.username || "Guest"}
          </h4>

          {/* ROLE DISPLAY */}
          <p className="profile-role">
            {roleLabel || "No Role"}
          </p>
        </div>

      </div>

      <div className="sidebar-divider"></div>

      <ul className="menu-list">

        <li className={location.pathname === "/dashboard" ? "active" : ""}>
          <Link to="/dashboard">
            <FaHome className="menu-icon" />
            Dashboard
          </Link>
        </li>

        {canAddPatient && (
          <li className={location.pathname === "/dashboard/add-patient" ? "active" : ""}>
            <Link to="/dashboard/add-patient">
              <FaUserPlus className="menu-icon" />
              Add New Patient
            </Link>
          </li>
        )}

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