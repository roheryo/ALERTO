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

  const temperature = "29°C";
  const condition = "Partly Cloudy";

  /* ================= TOTAL CASES ================= */

  const totalAWD = "4,814,900";
  const totalILI = "3,900,000";
  const totalDengue = "1,464";

  /* ================= CHART DATA ================= */

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

    <div>

      {/* ================= SIDEBAR ================= */}

      <div className="sidebar">

        <h3 className="sidebar-title">
          Disease Surveillance
        </h3>

        <ul>

          <li className="active">
            Dashboard
          </li>

          <li>
            Cases Logs
          </li>

          <li>
            Reports
          </li>

          <li>
            Notification
          </li>

        </ul>

      </div>

      {/* ================= MAIN ================= */}

      <div className="main-content">

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

          <div className="content-wrapper">

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

              {/* AWD */}

              <div className="summary-card blue">

                <h4>
                  Acute Watery Diarrhea
                </h4>

                <h2>
                  {totalAWD}
                </h2>

                <p>
                  New infections
                </p>

              </div>

              {/* ILI */}

              <div className="summary-card red">

                <h4>
                  Influenza-Like-Illness
                </h4>

                <h2>
                  {totalILI}
                </h2>

                <p>
                  Total Cases
                </p>

              </div>

              {/* Dengue */}

              <div className="summary-card orange">

                <h4>
                  Dengue
                </h4>

                <h2>
                  {totalDengue}
                </h2>

                <p>
                  Cases
                </p>

              </div>

            </div>

            {/* ================= CHARTS ================= */}

            <div className="chart-container">

              {/* AWD */}

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

              {/* ILI */}

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

              {/* Dengue */}

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

      </div>

    </div>

  );

}

export default Dashboard;