import "./Dashboard.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function Dashboard() {

  /* Sample Data */
  const tbData = [
    { year: 2018, cases: 120 },
    { year: 2019, cases: 150 },
    { year: 2020, cases: 130 },
    { year: 2021, cases: 180 },
    { year: 2022, cases: 200 }
  ];

  const hivData = [
    { year: 2018, cases: 90 },
    { year: 2019, cases: 120 },
    { year: 2020, cases: 110 },
    { year: 2021, cases: 140 },
    { year: 2022, cases: 170 }
  ];

  const malariaData = [
    { year: 2018, cases: 60 },
    { year: 2019, cases: 75 },
    { year: 2020, cases: 65 },
    { year: 2021, cases: 90 },
    { year: 2022, cases: 100 }
  ];

  return (

    <div className="dashboard">

      {/* Header */}
      <div className="dashboard-header">

        <h2>
            Disease Surveillance
        </h2>

      </div>

      {/* Summary Cards */}
      <div className="card-container">

        <div className="summary-card blue">
          <h4>Accute Waterry Diarrhea</h4>
          <h2>4,814,900</h2>
          <p>New infections</p>
        </div>

        <div className="summary-card red">
          <h4>Influencia-Like-Illness</h4>
          <h2>3,900,000</h2>
          <p>People living with HIV</p>
        </div>

        <div className="summary-card orange">
          <h4>Dengue</h4>
          <h2>1,464</h2>
          <p>Cases</p>
        </div>

      </div>

      {/* Charts */}
      <div className="chart-container">

        {/* TB Chart */}
        <div className="chart-card">

          <h3>TB Incidence</h3>

          <ResponsiveContainer width="100%" height={250}>

            <LineChart data={tbData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="year" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="cases"
                stroke="#007bff"
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

        {/* HIV Chart */}
        <div className="chart-card">

          <h3>HIV Incidence</h3>

          <ResponsiveContainer width="100%" height={250}>

            <LineChart data={hivData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="year" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="cases"
                stroke="#dc3545"
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

        {/* Malaria Chart */}
        <div className="chart-card">

          <h3>Malaria Incidence</h3>

          <ResponsiveContainer width="100%" height={250}>

            <LineChart data={malariaData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="year" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="cases"
                stroke="#28a745"
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>

    </div>

  );

}

export default Dashboard;