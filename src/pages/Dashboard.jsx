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

  const { totalAWD, totalILI, totalDengue, awdData, iliData, dengueData } = useMemo(() => {
    const countsByDisease = { AWD: 0, ILI: 0, DENGUE: 0 };
    const byDiseaseByMunicipality = {
      AWD: new Map(),
      ILI: new Map(),
      DENGUE: new Map()
    };

    for (const p of patients) {
      const disease = normalizeDisease(p?.diseaseType);
      if (disease !== "AWD" && disease !== "ILI" && disease !== "DENGUE") continue;

      countsByDisease[disease] += 1;

      const muni = String(p?.municipality ?? "Unknown").trim() || "Unknown";
      const map = byDiseaseByMunicipality[disease];
      map.set(muni, (map.get(muni) ?? 0) + 1);
    }

    const toTopList = (map, topN = 3) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([municipality, cases]) => ({ municipality, cases }));

    return {
      totalAWD: countsByDisease.AWD.toLocaleString(),
      totalILI: countsByDisease.ILI.toLocaleString(),
      totalDengue: countsByDisease.DENGUE.toLocaleString(),
      awdData: toTopList(byDiseaseByMunicipality.AWD),
      iliData: toTopList(byDiseaseByMunicipality.ILI),
      dengueData: toTopList(byDiseaseByMunicipality.DENGUE)
    };
  }, [patients]);

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
              Highest Municipalities with AWD Cases
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
              Highest Municipalities with ILI Cases
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
              Highest Municipalities with Dengue Cases
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