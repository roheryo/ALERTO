import React, { useState } from "react";
import "./Dashboard.css";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const [disease, setDisease] = useState("DENGUE");

  const data = {
    DENGUE: [
      { municipality: "Nabunturan", cases: 124 },
      { municipality: "Montevista", cases: 98 },
      { municipality: "Mawab", cases: 76 }
    ],
    ILI: [
      { municipality: "Montevista", cases: 110 },
      { municipality: "Laak", cases: 89 },
      { municipality: "Maco", cases: 65 }
    ],
    AWD: [
      { municipality: "Laak", cases: 92 },
      { municipality: "Pantukan", cases: 71 },
      { municipality: "New Bataan", cases: 58 }
    ]
  };

  const maxCases = Math.max(...data[disease].map(d => d.cases));

 return (
  <div className="dashboard-container">
    {/* HEADER */}
    <div className="top-bar">
      <h1>Disease Surveillance Dashboard – Davao de Oro</h1>
      <FaBell className="bell-icon" />
    </div>

   {/* MANAGEMENT BUTTONS */}
<div className="management-buttons">
  <button className="manage-btn" onClick={() => navigate("/patients")}>
    Manage Patient Information
  </button>

  <button className="manage-btn" onClick={() => navigate("/logs")}>
    Patient Logs
  </button>
</div>



    {/* CHART SECTION */}
    <div className="chart-section">
      
      {/* DISEASE SELECTOR – NOW AT BOTTOM / ABOVE GRAPH */}
      <div className="disease-selector">
        {["AWD", "DENGUE", "ILI"].map(type => (
          <button
            key={type}
            className={disease === type ? "active" : ""}
            onClick={() => setDisease(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <h2>Municipalities with Highest {disease} Cases</h2>

      <div className="bar-chart">
        {data[disease].map((item, index) => (
          <div className="bar-item" key={item.municipality}>
            <div className="bar-wrapper">
              <div
                className={`bar ${index === 0 ? "highest" : "other"}`}
                style={{ height: `${(item.cases / maxCases) * 100}%` }}
              ></div>
            </div>
            <span className="cases">{item.cases}</span>
            <span className="label">{item.municipality}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

};

export default Dashboard;
