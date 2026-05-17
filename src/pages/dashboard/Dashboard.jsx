import "@/styles/dashboard-shell.css";

import logo from "@/assets/images/ddoLOGO.jpg";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { sessionUserFromAuth } from "@/lib/authUser";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { filterConfirmedPatients, normalizeDisease } from "@/lib/disease";
import { usePatients } from "@/hooks/usePatients";
import { useAccountWeather } from "@/hooks/useAccountWeather";
import LiveWeatherCard from "@/components/weather/LiveWeatherCard";
import BarangayDashboard from "./BarangayDashboard";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="chart-tooltip" role="status" aria-live="polite">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">{Number(value ?? 0).toLocaleString()} cases</div>
    </div>
  );
}

function Dashboard() {
  const { user: authUser, token } = useAuth();
  const { patients, loading, error } = usePatients();
  const user = sessionUserFromAuth(authUser);
  const role = String(user?.role ?? "").toLowerCase();
  const inferredRole = (() => {
    if (role) return role;
    if (user?.barangay && String(user.barangay).trim()) return "barangay employee";
    if (user?.municipality && String(user.municipality).trim()) return "municipal employee";
    return "provincial employee";
  })();

  const roleKey = (() => {
    const r = String(inferredRole ?? "").toLowerCase();
    if (r.includes("barangay")) return "barangay";
    if (r.includes("municipal")) return "municipal";
    return "provincial";
  })();

  const accountMunicipality = String(user?.municipality ?? "").trim();
  const accountBarangay = String(user?.barangay ?? "").trim();
  const municipalityName = accountMunicipality;

  const awdChartTitle =
    roleKey === "provincial"
      ? "Highest Municipalities with AWD Cases"
      : `Highest Cases in Barangays in ${municipalityName || "Municipality"} (AWD)`;

  const iliChartTitle =
    roleKey === "provincial"
      ? "Highest Municipalities with ILI Cases"
      : `Highest Cases in Barangays in ${municipalityName || "Municipality"} (ILI)`;

  const dengueChartTitle =
    roleKey === "provincial"
      ? "Highest Municipalities with Dengue Cases"
      : `Highest Cases in Barangays in ${municipalityName || "Municipality"} (Dengue)`;

  const { weather } = useAccountWeather({
    municipality: accountMunicipality,
    barangay: accountBarangay,
    token
  });

  const barangayPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const b = String(user?.barangay ?? "").trim();
    let list = patients;
    if (b) list = list.filter((p) => String(p?.barangay ?? "").trim() === b);
    return filterConfirmedPatients(list);
  }, [patients, user?.barangay]);

  const scopedPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const municipality = String(user?.municipality ?? "").trim();

    let list = patients;

    if (String(inferredRole).includes("provincial")) {
      list = patients;
    } else if (String(inferredRole).includes("barangay")) {
      return [];
    } else if (String(inferredRole).includes("municipal")) {
      list = municipality
        ? patients.filter((p) => String(p?.municipality ?? "").trim() === municipality)
        : patients;
    }

    return filterConfirmedPatients(list);
  }, [patients, inferredRole, user?.municipality]);

  const { totalAWD, totalILI, totalDengue, awdData, iliData, dengueData } = useMemo(() => {
    const countsByDisease = { AWD: 0, ILI: 0, DENGUE: 0 };
    const groupByKey = String(inferredRole).includes("provincial") ? "municipality" : "barangay";

    const byDiseaseByGroup = {
      AWD: new Map(),
      ILI: new Map(),
      DENGUE: new Map()
    };

    for (const p of scopedPatients) {
      const disease = normalizeDisease(p?.diseaseType);
      if (disease !== "AWD" && disease !== "ILI" && disease !== "DENGUE") continue;

      countsByDisease[disease] += 1;

      const key =
        groupByKey === "municipality"
          ? String(p?.municipality ?? "Unknown").trim() || "Unknown"
          : String(p?.barangay ?? "Unknown").trim() || "Unknown";

      const map = byDiseaseByGroup[disease];
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const toTopList = (map, topN = 3) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        // Keep the same chart XAxis dataKey ("municipality") to avoid UI changes.
        .map(([label, cases]) => ({ municipality: label, cases }));

    return {
      totalAWD: countsByDisease.AWD.toLocaleString(),
      totalILI: countsByDisease.ILI.toLocaleString(),
      totalDengue: countsByDisease.DENGUE.toLocaleString(),
      awdData: toTopList(byDiseaseByGroup.AWD),
      iliData: toTopList(byDiseaseByGroup.ILI),
      dengueData: toTopList(byDiseaseByGroup.DENGUE)
    };
  }, [scopedPatients, inferredRole]);

  return (

    <div className="dashboard-container">

      {/* ================= HEADER ================= */}

      <div className="dashboard-header">

        <h2 className="header-title">
          Dashboard
        </h2>

        <div className="header-right">

          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>

          <div className="header-text">

            <h3>Davao de Oro</h3>

            <p>Provincial Health Office</p>

          </div>

          <img
            src={logo}
            alt="logo"
            className="header-logo"
          />

        </div>

      </div>

      {/* ================= CONTENT ================= */}

      <div className="content-area">

        <LiveWeatherCard
          weather={weather}
          municipalityLabel={accountMunicipality}
          barangayLabel={accountBarangay}
        />

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
                barangayName={String(user?.barangay ?? "").trim()}
                municipalityName={String(user?.municipality ?? "").trim()}
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
              <>
            {/* ================= SUMMARY CARDS ================= */}

            <div className="card-container">

              <div className="summary-card blue">

                <h4>Acute Watery Diarrhea</h4>

                <h2>{totalAWD}</h2>

                <p>Confirmed cases</p>

              </div>

              <div className="summary-card red">

                <h4>Influenza-Like-Illness</h4>

                <h2>{totalILI}</h2>

                <p>Confirmed cases</p>

              </div>

              <div className="summary-card orange">

                <h4>Dengue</h4>

                <h2>{totalDengue}</h2>

                <p>Confirmed cases</p>

              </div>

            </div>

            {/* ================= CHARTS ================= */}

            <div className="chart-container">

              <div className="chart-card">

                <div className="chart-header">
                  <h3 className="chart-title">{awdChartTitle}</h3>
                  <div className="chart-subtitle">Top 3 · confirmed cases</div>
                </div>

                <ResponsiveContainer width="100%" height={250}>

                  <BarChart data={awdData}>

                    <defs>
                      <linearGradient id="dashBarBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" vertical={false} />

                    <XAxis
                      dataKey="municipality"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.70)", fontSize: 12, fontWeight: 700 }}
                      dy={8}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.55)", fontSize: 12, fontWeight: 700 }}
                      width={32}
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                    />

                    <Bar
                      dataKey="cases"
                      fill="url(#dashBarBlue)"
                      radius={[10, 10, 0, 0]}
                      barSize={34}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

              <div className="chart-card">

                <div className="chart-header">
                  <h3 className="chart-title">{iliChartTitle}</h3>
                  <div className="chart-subtitle">Top 3 · confirmed cases</div>
                </div>

                <ResponsiveContainer width="100%" height={250}>

                  <BarChart data={iliData}>

                    <defs>
                      <linearGradient id="dashBarRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity={1} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" vertical={false} />

                    <XAxis
                      dataKey="municipality"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.70)", fontSize: 12, fontWeight: 700 }}
                      dy={8}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.55)", fontSize: 12, fontWeight: 700 }}
                      width={32}
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(225, 29, 72, 0.08)" }}
                    />

                    <Bar
                      dataKey="cases"
                      fill="url(#dashBarRed)"
                      radius={[10, 10, 0, 0]}
                      barSize={34}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

              <div className="chart-card">

                <div className="chart-header">
                  <h3 className="chart-title">{dengueChartTitle}</h3>
                  <div className="chart-subtitle">Top 3 · confirmed cases</div>
                </div>

                <ResponsiveContainer width="100%" height={250}>

                  <BarChart data={dengueData}>

                    <defs>
                      <linearGradient id="dashBarAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="rgba(15, 23, 42, 0.08)" vertical={false} />

                    <XAxis
                      dataKey="municipality"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.70)", fontSize: 12, fontWeight: 700 }}
                      dy={8}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(15, 23, 42, 0.55)", fontSize: 12, fontWeight: 700 }}
                      width={32}
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(217, 119, 6, 0.10)" }}
                    />

                    <Bar
                      dataKey="cases"
                      fill="url(#dashBarAmber)"
                      radius={[10, 10, 0, 0]}
                      barSize={34}
                    />

                  </BarChart>

                </ResponsiveContainer>

              </div>

            </div>
              </>
            ) : null}
          </>
        )}

      </div>

    </div>

  );

}

export default Dashboard;