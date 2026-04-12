import "./CasesLogs.css";
import logo from "../assets/images/ddoLOGO.JPG";
import { useState } from "react";

function CasesLogs() {

  /* ================= MUNICIPALITY DATA ================= */

  const municipalityData = {
    Nabunturan: ["Poblacion", "Magsaysay", "San Vicente"],
    Monkayo: ["Union", "Casoon", "Oro"],
    Compostela: ["Poblacion", "Ngan", "Mangayon"],
    Mawab: ["Salvacion", "Nueva Visayas"]
  };

  /* ================= SAMPLE PATIENT DATA ================= */

  const [patients, setPatients] = useState([
    {
      id: 1,
      name: "Juan Dela Cruz",
      age: 25,
      sex: "Male",
      disease: "Dengue",
      municipality: "Nabunturan",
      barangay: "Poblacion",
      address: "Purok 1, Main Street", // NEW
      dateStarted: "08/04/2026"
    }
  ]);

  /* ================= FILTER STATE ================= */

  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [barangays, setBarangays] = useState([]);

  /* ================= MODAL STATE ================= */

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState(null);

  /* ================= HANDLE MUNICIPALITY ================= */

  const handleMunicipalityChange = (e) => {

    const municipality = e.target.value;

    setSelectedMunicipality(municipality);

    if (municipalityData[municipality]) {
      setBarangays(municipalityData[municipality]);
    } else {
      setBarangays([]);
    }

  };

  /* ================= VIEW ================= */

  const handleView = (patient) => {
    setSelectedPatient(patient);
    setShowViewModal(true);
  };

  /* ================= EDIT ================= */

  const handleEdit = (patient) => {
    setSelectedPatient(patient);
    setShowEditModal(true);
  };

  /* ================= SAVE EDIT ================= */

  const handleSaveEdit = () => {

    const updatedPatients = patients.map((p) =>
      p.id === selectedPatient.id ? selectedPatient : p
    );

    setPatients(updatedPatients);
    setShowEditModal(false);
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

          <input
            type="text"
            placeholder="Search patient name..."
            className="search-input"
          />

          <div className="filters-right">

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

            <select className="filter-select">

              <option>All Diseases</option>
              <option>Dengue</option>
              <option>Influenza-Like Illness</option>
              <option>Acute Watery Diarrhea</option>

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

            <tbody>

              {patients.map((patient) => (

                <tr key={patient.id}>

                  <td>{patient.name}</td>
                  <td>{patient.age}</td>
                  <td>{patient.sex}</td>
                  <td>{patient.disease}</td>
                  <td>{patient.municipality}</td>
                  <td>{patient.barangay}</td>
                  <td>{patient.dateStarted}</td>

                  <td className="action-buttons">

                    <button
                      className="view-btn"
                      onClick={() => handleView(patient)}
                    >
                      View
                    </button>

                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(patient)}
                    >
                      Edit
                    </button>

                    <button className="delete-btn">
                      Delete
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      {/* ================= VIEW MODAL ================= */}

      {showViewModal && selectedPatient && (

        <div className="modal-overlay">

          <div className="modal-container">

            <h3 className="modal-title">
              Patient Details
            </h3>

            <div className="view-details">

              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">
                  {selectedPatient.name}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Age:</span>
                <span className="detail-value">
                  {selectedPatient.age}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Sex:</span>
                <span className="detail-value">
                  {selectedPatient.sex}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Disease:</span>
                <span className="detail-value">
                  {selectedPatient.disease}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Municipality:</span>
                <span className="detail-value">
                  {selectedPatient.municipality}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Barangay:</span>
                <span className="detail-value">
                  {selectedPatient.barangay}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Address:</span>
                <span className="detail-value">
                  {selectedPatient.address}
                </span>
              </div>

            </div>

            <div className="modal-actions">

              <button
                className="close-btn"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ================= EDIT MODAL ================= */}

      {/* ================= EDIT MODAL ================= */}

{showEditModal && selectedPatient && (

  <div className="modal-overlay">

    <div className="modal-container">

      <h3 className="modal-title">
        Edit Patient Address Details
      </h3>

      <div className="modal-content">

        {/* FIRST NAME (READ ONLY) */}

        <label>First Name</label>
        <input
          type="text"
          value={selectedPatient.name.split(" ")[0]}
          readOnly
          className="readonly-input"
        />

        {/* LAST NAME (EDITABLE) */}

        <label>Last Name</label>
        <input
          type="text"
          value={selectedPatient.name.split(" ")[1] || ""}
          onChange={(e) => {

            const firstName = selectedPatient.name.split(" ")[0];

            setSelectedPatient({
              ...selectedPatient,
              name: firstName + " " + e.target.value
            });

          }}
        />

        {/* AGE (READ ONLY) */}

        <label>Age</label>
        <input
          type="number"
          value={selectedPatient.age}
          readOnly
          className="readonly-input"
        />

        {/* SEX (READ ONLY) */}

        <label>Sex</label>
        <input
          type="text"
          value={selectedPatient.sex}
          readOnly
          className="readonly-input"
        />

        {/* DISEASE (READ ONLY) */}

        <label>Disease</label>
        <input
          type="text"
          value={selectedPatient.disease}
          readOnly
          className="readonly-input"
        />

        {/* MUNICIPALITY (EDITABLE) */}

        <label>Municipality</label>
        <select
          value={selectedPatient.municipality}
          onChange={(e) => {

            const municipality = e.target.value;

            setSelectedPatient({
              ...selectedPatient,
              municipality: municipality,
              barangay: municipalityData[municipality][0]
            });

          }}
        >

          {Object.keys(municipalityData).map((m) => (

            <option key={m} value={m}>
              {m}
            </option>

          ))}

        </select>

        {/* BARANGAY (EDITABLE) */}

        <label>Barangay</label>
        <select
          value={selectedPatient.barangay}
          onChange={(e) =>
            setSelectedPatient({
              ...selectedPatient,
              barangay: e.target.value
            })
          }
        >

          {municipalityData[selectedPatient.municipality]?.map((b, i) => (

            <option key={i} value={b}>
              {b}
            </option>

          ))}

        </select>

        {/* ADDRESS (EDITABLE) */}

        <label>Full Address</label>
        <input
          type="text"
          value={selectedPatient.address}
          onChange={(e) =>
            setSelectedPatient({
              ...selectedPatient,
              address: e.target.value
            })
          }
        />

      </div>

      <div className="modal-actions">

        <button
          className="save-btn"
          onClick={handleSaveEdit}
        >
          Save
        </button>

        <button
          className="close-btn"
          onClick={() => setShowEditModal(false)}
        >
          Cancel
        </button>

      </div>

    </div>

  </div>

)}

    </div>

  );

}

export default CasesLogs;