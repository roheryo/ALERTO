import "./Dashboard.css"; 

import logo from "../assets/images/ddoLOGO.jpg";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const MUNICIPALITY_BARANGAYS = {
  Nabunturan: ["Basak", "Bayabas", "Bukal", "Cabidianan", "Katipunan", "Magsaysay", "San Isidro", "San Vicente"],
  Monkayo: ["Awao", "Babag", "Banlag", "Haguimitan", "Union", "Oro", "Poblacion"],
  Compostela: ["Bagongon", "Gabi", "Lagab", "Mangayon", "Osmena", "Poblacion"],
  Mawab: ["Andap", "Concepcion", "Nuevo Iloco", "Poblacion", "Salvacion"],
  Maco: ["Anibongan", "Anislagan", "Bucana", "Calabcab", "Concepcion", "Dumlan", "Hijo", "Lapu-lapu", "Poblacion", "San Juan", "Taglawig"],
  Maragusan: ["Bagong Silang", "Coronobe", "Katipunan", "Mahayahay", "New Albay", "Poblacion"],
  Montevista: ["Banagbanag", "Banglasan", "Camansi", "Canidkid", "Concepcion", "Poblacion"],
  Pantukan: ["Kingking", "Magnaga", "Napnapan", "Poblacion", "Tagdanua"],
  NewBataan: ["Andap", "Cabinuangan", "Camanlangan", "Poblacion", "San Roque"],
  Laak: ["Amorcruz", "Anitap", "Datu Ampunan", "Longanapan", "Poblacion"],
  Mabini: ["Cadunan", "Golden Valley", "Pindasan", "San Antonio", "Tagnanan"]
};

function getWeatherIcon(condition) {
  const c = String(condition || "").toLowerCase();
  if (c.includes("thunder")) return "⛈";
  if (c.includes("rain") || c.includes("drizzle")) return "🌧";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "🌫";
  if (c.includes("cloud")) return "☁";
  if (c.includes("clear") || c.includes("sun")) return "☀";
  return "🌡";
}

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
  const user = JSON.parse(localStorage.getItem("user"));
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

  const municipalityName = String(user?.municipality ?? "").trim();

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

  const [patients, setPatients] = useState([]);
  const [weather, setWeather] = useState({
    municipality: "",
    temperature: null,
    humidity: null,
    condition: "Loading...",
    provider: ""
  });
  const [selectedWeatherMunicipality, setSelectedWeatherMunicipality] = useState(
    roleKey === "provincial" ? "Nabunturan" : municipalityName || "Nabunturan"
  );
  const [selectedWeatherBarangay, setSelectedWeatherBarangay] = useState(
    roleKey === "barangay" ? String(user?.barangay ?? "").trim() : ""
  );

  useEffect(() => {
    let cancelled = false;

    fetch("http://localhost:5000/patients")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPatients(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPatients([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const weatherMunicipality =
      roleKey === "provincial"
        ? selectedWeatherMunicipality || "Nabunturan"
        : municipalityName || "Nabunturan";
    let cancelled = false;

    fetch(`http://localhost:5000/weather/${encodeURIComponent(weatherMunicipality)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
      })
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data?.error) {
          setWeather({
            municipality: weatherMunicipality,
            temperature: null,
            humidity: null,
            condition: "Unavailable"
          });
          return;
        }
        setWeather({
          municipality: data?.municipality || weatherMunicipality,
          temperature: Number.isFinite(data?.temperature) ? data.temperature : null,
          humidity: Number.isFinite(data?.humidity) ? data.humidity : null,
          condition: data?.condition || "Unknown",
          provider: String(data?.provider ?? "")
        });
      })
      .catch(() => {
        if (cancelled) return;
        setWeather({
          municipality: weatherMunicipality,
          temperature: null,
          humidity: null,
          condition: "Unavailable",
          provider: ""
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWeatherMunicipality, municipalityName, roleKey]);

  const municipalityOptions = useMemo(() => Object.keys(MUNICIPALITY_BARANGAYS), []);
  const barangayOptions = useMemo(() => {
    if (roleKey === "barangay") return [String(user?.barangay ?? "").trim()].filter(Boolean);
    const key =
      roleKey === "provincial"
        ? selectedWeatherMunicipality
        : municipalityName;
    return MUNICIPALITY_BARANGAYS[key] || [];
  }, [roleKey, user?.barangay, selectedWeatherMunicipality, municipalityName]);

  const normalizeDisease = (raw) => {
    const v = String(raw ?? "").trim().toLowerCase();
    if (!v) return "";
    if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) {
      return "AWD";
    }
    if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) {
      return "ILI";
    }
    if (v.includes("dengue")) {
      return "DENGUE";
    }
    return v.toUpperCase();
  };

  const scopedPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const municipality = String(user?.municipality ?? "").trim();
    const barangay = String(user?.barangay ?? "").trim();

    if (String(inferredRole).includes("provincial")) return patients;

    if (String(inferredRole).includes("barangay")) {
      // Dashboard for barangay users should show top barangays within their municipality
      // so we scope to municipality (not a single barangay).
      if (!municipality) return patients;
      return patients.filter((p) => String(p?.municipality ?? "").trim() === municipality);
    }

    if (String(inferredRole).includes("municipal")) {
      if (!municipality) return patients;
      return patients.filter((p) => String(p?.municipality ?? "").trim() === municipality);
    }

    return patients;
  }, [patients, inferredRole, user?.municipality, user?.barangay]);

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
  }, [scopedPatients, normalizeDisease, inferredRole]);

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

        {/* ================= WEATHER ================= */}

        <div className="weather-container">

          <div className="weather-card">
            <div className="weather-header">
              <div className="weather-header-left">
                <div className="weather-title">Live Weather</div>
                <div className="weather-location">
                  {weather.municipality}
                  {selectedWeatherBarangay ? `, ${selectedWeatherBarangay}` : ""}
                </div>
              </div>

              <div className="weather-header-right">
                <span className="weather-pill" aria-label="Weather data source">
                  {weather.provider === "openweathermap"
                    ? "OpenWeather"
                    : weather.provider
                      ? String(weather.provider)
                      : "Open‑Meteo"}
                </span>
              </div>
            </div>

            <div className="weather-controls weather-controls--pro">
              <label>
                Municipality
                <select
                  value={roleKey === "provincial" ? selectedWeatherMunicipality : municipalityName}
                  onChange={(e) => {
                    setSelectedWeatherMunicipality(e.target.value);
                    if (roleKey !== "barangay") setSelectedWeatherBarangay("");
                  }}
                  disabled={roleKey !== "provincial"}
                >
                  {roleKey === "provincial"
                    ? municipalityOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    : (
                        <option value={municipalityName}>{municipalityName || "Municipality"}</option>
                      )}
                </select>
              </label>

              <label>
                Barangay
                <select
                  value={roleKey === "barangay" ? String(user?.barangay ?? "").trim() : selectedWeatherBarangay}
                  onChange={(e) => setSelectedWeatherBarangay(e.target.value)}
                  disabled={roleKey === "barangay"}
                >
                  {roleKey !== "barangay" && <option value="">All Barangays</option>}
                  {barangayOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="weather-main weather-main--pro">
              <div className="weather-icon" aria-hidden="true">
                {getWeatherIcon(weather.condition)}
              </div>

              <div className="weather-primary">
                <div className="weather-stats weather-stats--pro">
                  <div className="weather-stat weather-stat--primary">
                    <div className="weather-stat-label">Temperature</div>
                    <div className="weather-stat-value">
                      {weather.temperature !== null ? `${weather.temperature.toFixed(1)}°C` : "—"}
                    </div>
                  </div>
                  <div className="weather-stat">
                    <div className="weather-stat-label">Condition</div>
                    <div className="weather-stat-value">{weather.condition}</div>
                  </div>
                  <div className="weather-stat">
                    <div className="weather-stat-label">Humidity</div>
                    <div className="weather-stat-value">
                      {weather.humidity !== null ? `${weather.humidity}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ================= SUMMARY CARDS ================= */}

        <div className="card-container">

          <div className="summary-card blue">

            <h4>Acute Watery Diarrhea</h4>

            <h2>{totalAWD}</h2>

            <p>New infections</p>

          </div>

          <div className="summary-card red">

            <h4>Influenza-Like-Illness</h4>

            <h2>{totalILI}</h2>

            <p>Total Cases</p>

          </div>

          <div className="summary-card orange">

            <h4>Dengue</h4>

            <h2>{totalDengue}</h2>

            <p>Cases</p>

          </div>

        </div>

        {/* ================= CHARTS ================= */}

        <div className="chart-container">

          <div className="chart-card">

            <div className="chart-header">
              <h3 className="chart-title">{awdChartTitle}</h3>
              <div className="chart-subtitle">Top 3 by cases</div>
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
              <div className="chart-subtitle">Top 3 by cases</div>
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
              <div className="chart-subtitle">Top 3 by cases</div>
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

      </div>

    </div>

  );

}

export default Dashboard;