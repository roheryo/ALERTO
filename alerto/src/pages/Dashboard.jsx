import "./Dashboard.css";

import { useState } from "react";

import logo from "../assets/images/ddoLOGO.jpg";
import bgImage from "../assets/images/ddoBG.jpg";

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

  /* Sidebar Toggle */

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  /* Weather Placeholder */

  const temperature = "29°C";
  const condition = "Partly Cloudy";

  /* Data */

  const awdData = [
    { municipality: "Nabunturan", cases: 120 },
    { municipality: "Monkayo", cases: 95 },
    { municipality: "Compostela", cases: 80 }
  ];

  const iliData = [
    { municipality: "Monkayo", cases: 140 },
    { municipality: "Nabunturan", cases: 120 },
    { municipality: "Mawab", cases: 100 }
  ];

  const dengueData = [
    { municipality: "Nabunturan", cases: 200 },
    { municipality: "Compostela", cases: 150 },
    { municipality: "Monkayo", cases: 120 }
  ];

  return (

    <div
      className="dashboard"
      style={{
        backgroundImage: `url(${bgImage})`
      }}
    >

      {/* SIDEBAR */}

      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>

        <h3 className="sidebar-title">
          MENU
        </h3>

        <ul>

          <li>Dashboard</li>
          <li>Notifications</li>
          <li>Reports</li>
          <li>Cases Logs</li>
          <li>Alerts</li>
          <li>Settings</li>

        </ul>

      </div>

      {/* OVERLAY */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={toggleSidebar}
        />
      )}

      {/* HEADER */}

      <div className="dashboard-header">

        <div className="header-left">

            <span
            className="menu-icon"
            onClick={toggleSidebar}
            >
            ☰
            </span>

            <h2 className="header-title">
            Disease Surveillance
            </h2>

        </div>

        <div className="header-right">

            <div className="header-text">

            <h3>Davao de Oro</h3>
            <p>Provincial Health Office</p>

            </div>

            <img
            src={logo}
            alt="Davao de Oro Logo"
            className="header-logo"
            />

        </div>

        </div>

      {/* WEATHER */}

      <div className="weather-container">

        <div className="weather-card">

          <div className="weather-temp">
            {temperature}
          </div>

          <div className="weather-condition">
            {condition}
          </div>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="card-container">

        <div className="summary-card blue">
          <h4>Acute Watery Diarrhea</h4>
          <h2>4,814,900</h2>
          <p>New infections</p>
        </div>

        <div className="summary-card red">
          <h4>Influenza-Like-Illness</h4>
          <h2>3,900,000</h2>
          <p>Total Cases</p>
        </div>

        <div className="summary-card orange">
          <h4>Dengue</h4>
          <h2>1,464</h2>
          <p>Cases</p>
        </div>

      </div>

      {/* CHARTS */}

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

  );

}

export default Dashboard;