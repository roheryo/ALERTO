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
  const isAccountManagement =
    pathname === "/dashboard/account-management" ||
    pathname.startsWith("/dashboard/account-management/");
  const isReports =
    pathname === "/dashboard/reports" || pathname.startsWith("/dashboard/reports/");
  const isMunicipalWide =
    user?.role === "municipality" &&
    (isDashboardHome || isMunicipalSurveillanceMap || isAccountManagement || isReports);

  const isBarangayWide = user?.role === "barangay" && isDashboardHome;

  const isProvincialWide =
    user?.role === "province" &&
    (isDashboardHome || pathname.startsWith("/dashboard/province-") || isAccountManagement || isReports);

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
    isBarangayWide ? "main-content--barangay" : "",
    isProvincialWide ? "main-content--provincial" : "",
    isAccountManagement ? "main-content--account" : ""
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
