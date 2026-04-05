import "./Dashboard.css";

import logo from "../assets/images/ddoLOGO.jpg";

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

  /* Weather Placeholder */

  const temperature = "29°C";
  const condition = "Partly Cloudy";

  /* Top 3 Municipality Data */

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

    <div className="dashboard">

      {/* ================= HEADER ================= */}

      <div className="dashboard-header">

        {/* Left Side */}
        <div className="header-left">

          <span className="menu-icon">
            ☰
          </span>

          <h2 className="header-title">
            Disease Surveillance
          </h2>

        </div>

        {/* Right Side */}
        <div className="header-right">

          <div className="header-text">

            <h3>
              Davao de Oro
            </h3>

            <p>
              Provincial Health Office
            </p>

          </div>

          <img
            src={logo}
            alt="Davao de Oro Logo"
            className="header-logo"
          />

        </div>

      </div>

      {/* ================= WEATHER ================= */}

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

      {/* ================= SUMMARY CARDS ================= */}

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

      {/* ================= CHARTS ================= */}

      <div className="chart-container">

        {/* AWD */}
        <div className="chart-card">

          <h3>
            Top 3 AWD Cases per Municipality
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

        {/* ILI */}
        <div className="chart-card">

          <h3>
            Top 3 ILI Cases per Municipality
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

        {/* Dengue */}
        <div className="chart-card">

          <h3>
            Top 3 Dengue Cases per Municipality
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