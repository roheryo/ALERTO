import "./Dashboard.css"; 

import logo from "../assets/images/ddoLOGO.jpg";
import { useEffect, useMemo, useState } from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function Dashboard() {

  const temperature = "29°C";
  const condition = "Partly Cloudy";

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

            <div className="weather-temp">
              {temperature}
            </div>

            <div>
              {condition}
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

            <h3>
              {awdChartTitle}
            </h3>

            <ResponsiveContainer width="100%" height={250}>

              <BarChart data={awdData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="municipality" />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="cases"
                  fill="#2f80ed"
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="chart-card">

            <h3>
              {iliChartTitle}
            </h3>

            <ResponsiveContainer width="100%" height={250}>

              <BarChart data={iliData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="municipality" />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="cases"
                  fill="#eb5757"
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="chart-card">

            <h3>
              {dengueChartTitle}
            </h3>

            <ResponsiveContainer width="100%" height={250}>

              <BarChart data={dengueData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="municipality" />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="cases"
                  fill="#f2994a"
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