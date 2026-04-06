import Sidebar from "../pages/Sidebar";
import { Outlet } from "react-router-dom";

function DashboardLayout() {
  return (
    <div className="dashboard-layout">

      {/* Sidebar stays */}
      <Sidebar />

      {/* Right side */}
      <div className="main-section">

        {/* Only content changes here */}
        <div className="main-content">
          <Outlet />
        </div>

      </div>

    </div>
  );
}

export default DashboardLayout;