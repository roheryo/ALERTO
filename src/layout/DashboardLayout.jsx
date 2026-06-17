import Sidebar from "./Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import "@/styles/dashboard-shell.css";

function DashboardLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/";
  const isMunicipalSurveillanceMap =
    pathname === "/dashboard/surveillance-map" ||
    pathname.startsWith("/dashboard/surveillance-map/");
  const isMunicipalWide =
    user?.role === "municipality" && (isDashboardHome || isMunicipalSurveillanceMap);

  const isProvincialWide =
    user?.role === "province" &&
    (isDashboardHome || pathname.startsWith("/dashboard/province-"));

  const layoutClass = [
    "dashboard-layout",
    isMunicipalWide ? "dashboard-layout--municipal" : "",
    isProvincialWide ? "dashboard-layout--provincial" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const mainContentClass = [
    "main-content",
    isMunicipalWide ? "main-content--municipal" : "",
    isProvincialWide ? "main-content--provincial" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClass}>
      <Sidebar />

      <div className="main-section">
        <div className={mainContentClass}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
