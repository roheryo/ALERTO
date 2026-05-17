import Sidebar from "../pages/Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import "../pages/Dashboard.css";

function DashboardLayout() {
  const { pathname } = useLocation();
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <div className={`dashboard-layout${isDashboardHome ? " dashboard-layout--home" : ""}`}>
      <Sidebar />

      <div className="main-section">
        <div className="main-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
