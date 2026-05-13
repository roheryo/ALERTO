import "./CasesLogs.css";
import logo from "../assets/images/ddoLOGO.JPG";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

function CasesLogs() {
  const navigate = useNavigate();

  /* ================= MUNICIPALITY DATA ================= */

  const municipalityData = {
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

  /* ================= STATE ================= */

  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [barangays, setBarangays] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [patients, setPatients] = useState([]);

  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editData, setEditData] = useState(null);

  useEffect(() => {
    setPatients([]);
  }, []);

  const user = JSON.parse(localStorage.getItem("user"));
  const role = String(user?.role ?? "").toLowerCase();

  const roleKey = role.includes("barangay")
    ? "barangay"
    : role.includes("municipal")
    ? "municipal"
    : "provincial";

  const lockedMunicipality = user?.municipality || "";
  const lockedBarangay = user?.barangay || "";

  useEffect(() => {
    if (roleKey === "municipal" || roleKey === "barangay") {
      if (lockedMunicipality) {
        setSelectedMunicipality(lockedMunicipality);
        setBarangays(municipalityData[lockedMunicipality] || []);
      }
    }
    if (roleKey === "barangay") {
      setSelectedBarangay(lockedBarangay);
    }
  }, []);

  const visiblePatients = useMemo(() => {
    let filtered = patients;

    if (roleKey === "municipal") {
      filtered = filtered.filter(p => p.municipality === lockedMunicipality);
    }

    if (roleKey === "barangay") {
      filtered = filtered.filter(
        p => p.municipality === lockedMunicipality &&
             p.barangay === lockedBarangay
      );
    }

    if (selectedMunicipality) {
      filtered = filtered.filter(p => p.municipality === selectedMunicipality);
    }

    if (selectedBarangay) {
      filtered = filtered.filter(p => p.barangay === selectedBarangay);
    }

    if (selectedDisease) {
      filtered = filtered.filter(p => p.diseaseType === selectedDisease);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [patients, selectedMunicipality, selectedBarangay, selectedDisease, searchTerm]);

  /* ================= FUNCTIONS ================= */

  const handleMunicipalityChange = (e) => {
    const municipality = e.target.value;
    setSelectedMunicipality(municipality);
    setSelectedBarangay("");

    if (municipalityData[municipality]) {
      setBarangays(municipalityData[municipality]);
    } else {
      setBarangays([]);
    }
  };

  const handleBarangayChange = (e) => {
    setSelectedBarangay(e.target.value);
  };

  const handleView = (p) => {
    setSelectedPatient(p);
    setShowView(true);
  };

  const handleEdit = (p) => {
    setEditData(p);
    setShowEdit(true);
  };

  const handleDelete = (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete?");
    if (!confirmDelete) return;

    setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdate = () => {
    setPatients((prev) => prev.map((p) => (p.id === editData.id ? editData : p)));
    setShowEdit(false);
  };

  /* ================= UI ================= */

  return (
    <div className="caseslogs-container">

      {/* HEADER (UNCHANGED) */}
      <div className="dashboard-header">
        <h2>Cases Logs</h2>

        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>

          <div className="header-text">
            <span>Davao de Oro</span>
            <small>Provincial Health Office</small>
          </div>

          <img src={logo} alt="DDO Logo" className="header-logo" />
        </div>
      </div>

      {/* CONTENT */}
      <div className="caseslogs-content">

        <div className="caseslogs-controls">

          <input
            type="text"
            placeholder="Search patient name..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {(roleKey === "municipal" || roleKey === "barangay") && (
            <button
              type="button"
              className="add-patient-btn"
              onClick={() => navigate("/dashboard/add-patient")}
            >
              + Add Patient
            </button>
          )}

          <div className="filters-right">

            <select
              className="filter-select"
              onChange={handleMunicipalityChange}
              value={selectedMunicipality}
            >
              <option value="">All Municipalities</option>
              {Object.keys(municipalityData).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            <select
              className="filter-select"
              onChange={handleBarangayChange}
              value={selectedBarangay}
            >
              <option value="">All Barangays</option>
              {barangays.map((b, i) => (
                <option key={i}>{b}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
            >
              <option value="">All Diseases</option>
              <option value="Dengue">Dengue</option>
              <option value="Influenza-Like Illness">Influenza-like illness (ILI)</option>
              <option value="Acute Watery Diarrhea">Acute Watery Diarrhoea (AWD)</option>
            </select>

          </div>
        </div>

        {/* TABLE */}
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
              {visiblePatients.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.sex}</td>
                  <td>{p.diseaseType}</td>
                  <td>{p.municipality}</td>
                  <td>{p.barangay}</td>
                  <td>{p.dateStarted}</td>

                  <td className="action-buttons">
                    <button className="view-btn" onClick={() => handleView(p)}>View</button>
                    <button className="edit-btn" onClick={() => handleEdit(p)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

      {/* VIEW MODAL (FULL DATA) */}
      {showView && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal">

            <h3>Patient Details</h3>

            <p><b>Name:</b> {selectedPatient.name}</p>
            <p><b>Age:</b> {selectedPatient.age}</p>
            <p><b>Sex:</b> {selectedPatient.sex}</p>
            <p><b>Disease:</b> {selectedPatient.diseaseType}</p>
            <p><b>Municipality:</b> {selectedPatient.municipality}</p>
            <p><b>Barangay:</b> {selectedPatient.barangay}</p>
            <p><b>Purok:</b> {selectedPatient.purok}</p>
            <p><b>Birthdate:</b> {selectedPatient.birthdate}</p>
            <p><b>Civil Status:</b> {selectedPatient.civilStatus}</p>
            <p><b>Birthplace:</b> {selectedPatient.birthplace}</p>
            <p><b>Date Started:</b> {selectedPatient.dateStarted}</p>

            <button onClick={() => setShowView(false)}>Close</button>

          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && editData && (
        <div className="modal-overlay">
          <div className="modal">

            <h3>Edit Patient</h3>

            <input value={editData.name} onChange={(e)=>setEditData({...editData,name:e.target.value})}/>
            <input value={editData.age} onChange={(e)=>setEditData({...editData,age:e.target.value})}/>
            <input value={editData.sex} onChange={(e)=>setEditData({...editData,sex:e.target.value})}/>
            <input value={editData.diseaseType} onChange={(e)=>setEditData({...editData,diseaseType:e.target.value})}/>

            <button onClick={handleUpdate}>Save</button>
            <button onClick={()=>setShowEdit(false)}>Cancel</button>

          </div>
        </div>
      )}

    </div>
  );
}

export default CasesLogs;