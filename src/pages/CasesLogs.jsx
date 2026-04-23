import "./CasesLogs.css";
import logo from "../assets/images/ddoLOGO.JPG";
import { useState, useEffect } from "react";

function CasesLogs() {

  /* ================= MUNICIPALITY DATA ================= */

  const municipalityData = {
    Nabunturan: [
      "Poblacion",
      "Magsaysay",
      "San Vicente"
    ],

    Monkayo: [
      "Union",
      "Casoon",
      "Oro"
    ],

    Compostela: [
      "Poblacion",
      "Ngan",
      "Mangayon"
    ],

    Mawab: [
      "Salvacion",
      "Nueva Visayas"
    ]
  };

  /* ================= STATE ================= */

  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [barangays, setBarangays] = useState([]);

  const [patients, setPatients] = useState([]);

useEffect(() => {
  fetch("http://localhost:5000/patients")
    .then(res => res.json())
    .then(data => setPatients(data))
    .catch(err => console.error(err));
}, []);

  /* ================= HANDLE MUNICIPALITY CHANGE ================= */

  const handleMunicipalityChange = (e) => {

    const municipality = e.target.value;

    setSelectedMunicipality(municipality);

    if (municipalityData[municipality]) {
      setBarangays(municipalityData[municipality]);
    } else {
      setBarangays([]);
    }

  };

  return (
    <div className="caseslogs-container">

      {/* ================= HEADER ================= */}

      <div className="dashboard-header">

        <h2>Cases Logs</h2>

        <div className="header-right">

          <div className="header-text">
            <span>Davao de Oro</span>
            <small>Provincial Health Office</small>
          </div>

          <img
            src={logo}
            alt="DDO Logo"
            className="header-logo"
          />

        </div>

      </div>

      {/* ================= CONTENT ================= */}

      <div className="caseslogs-content">

        {/* ================= CONTROLS ================= */}

        <div className="caseslogs-controls">

            {/* LEFT — Search */}
            <input
              type="text"
              placeholder="Search patient name..."
              className="search-input"
            />

            {/* RIGHT — Filters */}
            <div className="filters-right">

              {/* Municipality */}
              <select
                className="filter-select"
                onChange={handleMunicipalityChange}
              >
                <option value="">
                  All Municipalities
                </option>

                {Object.keys(municipalityData).map((municipality) => (

                  <option
                    key={municipality}
                    value={municipality}
                  >
                    {municipality}
                  </option>

                ))}

              </select>

              {/* Barangay */}
              <select
                className="filter-select"
                disabled={!selectedMunicipality}
              >

                <option>
                  All Barangays
                </option>

                {barangays.map((barangay, index) => (

                  <option
                    key={index}
                    value={barangay}
                  >
                    {barangay}
                  </option>

                ))}

              </select>

              {/* Disease */}
              <select className="filter-select">
                <option>All Diseases</option>
                <option>Acute Watery Diarrhea</option>
                <option>Influenza-Like Illness</option>
                <option>Dengue</option>
              </select>

            </div>

          </div>

        {/* ================= TABLE ================= */}

        <div className="table-container">

          <table className="cases-table">

            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Disease</th>
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Date Started</th>
                <th>Actions</th>
              </tr>
            </thead>

            {/* <tbody>

              <tr>
                <td>Juan Dela Cruz</td>
                <td>25</td>
                <td>Male</td>
                <td>Dengue</td>
                <td>Nabunturan</td>
                <td>Poblacion</td>
                <td>08/04/2026</td>

                <td className="action-buttons">

                  <button className="view-btn">
                    View
                  </button>

                  <button className="edit-btn">
                    Edit
                  </button>

                  <button className="delete-btn">
                    Delete
                  </button>

                </td>

              </tr>

            </tbody> */}
            <tbody>
  {patients.map((p) => (
    <tr key={p.id}>
      <td>{p.name}</td>
      <td>{p.age}</td>
      <td>{p.sex}</td>
      <td>{p.diseaseType}</td>
      <td>{p.municipality}</td>
      <td>{p.barangay}</td>
      <td>{p.dateStarted}</td>

      <td className="action-buttons">
        <button className="view-btn">View</button>
        <button className="edit-btn">Edit</button>
        <button className="delete-btn">Delete</button>
      </td>
    </tr>
  ))}
</tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

export default CasesLogs;