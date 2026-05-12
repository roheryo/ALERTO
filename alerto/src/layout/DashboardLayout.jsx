import Sidebar from "../pages/Sidebar";
import { Outlet } from "react-router-dom";

function DashboardLayout() {

  return (

    <div className="dashboard-layout">

      {/* SIDEBAR */}

      <Sidebar />

      {/* MAIN SECTION */}

      <div className="main-section">

        {/* PAGE CONTENT */}

        <div className="main-content">

          <Outlet />

        </div>

      </div>

    </div>

  );

}

export default DashboardLayout;