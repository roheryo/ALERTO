import "@/styles/dashboard-shell.css";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { sessionUserFromAuth } from "@/lib/authUser";

import { filterConfirmedPatients } from "@/lib/disease";
import { usePatients } from "@/hooks/usePatients";
import { useAccountWeather } from "@/hooks/useAccountWeather";
import { useForecasts } from "@/hooks/useForecasts";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import BarangayDashboard from "./BarangayDashboard";
import MunicipalDashboard from "./MunicipalDashboard";
import ProvincialDashboard from "./ProvincialDashboard";

function fmtSyncedAt(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function resolveRoleKey(user) {
  const role = String(user?.role ?? "").toLowerCase();
  if (role.includes("barangay")) return "barangay";
  if (role.includes("municipal")) return "municipal";
  return "provincial";
}

function BarangayMunicipalDashboard({ user, roleKey, token }) {
  const { patients, loading, error } = usePatients();
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const accountMunicipality = String(user?.municipality ?? "").trim();
  const accountBarangay = String(user?.barangay ?? "").trim();
  const municipalityName = accountMunicipality;

  const { weather } = useAccountWeather({
    municipality: accountMunicipality,
    barangay: accountBarangay,
    token
  });

  const { error: forecastError } = useForecasts({
    disease: "DENGUE",
    enabled: roleKey === "municipal"
  });
  const mlActive = roleKey === "municipal" && !forecastError;

  useEffect(() => {
    if (!loading && !error) {
      setLastSyncedAt(new Date());
    }
  }, [loading, error, patients]);

  const barangayPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const b = String(user?.barangay ?? "").trim();
    let list = patients;
    if (b) list = list.filter((p) => String(p?.barangay ?? "").trim() === b);
    return filterConfirmedPatients(list);
  }, [patients, user?.barangay]);

  const municipalPatients = useMemo(() => {
    if (roleKey !== "municipal" || !Array.isArray(patients)) return [];
    const municipality = String(user?.municipality ?? "").trim();
    const list = municipality
      ? patients.filter((p) => String(p?.municipality ?? "").trim() === municipality)
      : patients;
    return filterConfirmedPatients(list);
  }, [patients, roleKey, user?.municipality]);

  const headerTitle = roleKey === "municipal" ? "Municipal surveillance" : "Dashboard";

  const headerSubline = useMemo(() => {
    if (roleKey !== "municipal") return null;
    const parts = [];
    if (municipalityName) parts.push(`${municipalityName} · Municipal Health Office`);
    const synced = fmtSyncedAt(lastSyncedAt);
    if (synced) parts.push(`Last synced ${synced}`);
    if (loading) parts.push("Updating…");
    return parts.join(" · ") || null;
  }, [roleKey, municipalityName, lastSyncedAt, loading]);

  return (
    <div className="dashboard-container">
      <DashboardPageHeader
        pageTitle={headerTitle}
        subline={headerSubline}
        showMlStatus={roleKey === "municipal"}
        mlActive={mlActive}
      />

      <div
        className={[
          "content-area",
          roleKey === "municipal"
            ? "content-area--municipal"
            : roleKey === "barangay"
              ? "content-area--barangay"
              : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {roleKey === "barangay" ? (
          <>
            {loading ? <p className="dashboard-data-status">Loading case data…</p> : null}
            {error ? (
              <p className="dashboard-data-status dashboard-data-status--error" role="alert">
                {error}
              </p>
            ) : null}
            {!loading ? (
              <BarangayDashboard
                patients={barangayPatients}
                barangayName={accountBarangay}
                municipalityName={accountMunicipality}
                weather={weather}
              />
            ) : null}
          </>
        ) : (
          <>
            {loading ? <p className="dashboard-data-status">Loading case data…</p> : null}
            {error ? (
              <p className="dashboard-data-status dashboard-data-status--error" role="alert">
                {error}
              </p>
            ) : null}
            {!loading ? (
              <MunicipalDashboard
                patients={municipalPatients}
                municipalityName={municipalityName}
                weather={weather}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { user: authUser, token } = useAuth();
  const user = sessionUserFromAuth(authUser);
  const roleKey = resolveRoleKey(user);

  if (roleKey === "provincial") {
    return <ProvincialDashboard />;
  }

  return <BarangayMunicipalDashboard user={user} roleKey={roleKey} token={token} />;
}

export default Dashboard;
