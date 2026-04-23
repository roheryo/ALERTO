import "./CasesLogs.css";
import logo from "../assets/images/ddoLOGO.JPG";
import { useMemo, useState, useEffect } from "react";

function CasesLogs() {

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

useEffect(() => {
  fetch("http://localhost:5000/patients")
    .then(res => res.json())
    .then(data => setPatients(data))
    .catch(err => console.error(err));
}, []);

  const user = JSON.parse(localStorage.getItem("user"));
  const role = String(user?.role ?? user?.Role ?? user?.userRole ?? user?.user_role ?? "").toLowerCase();
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

  const lockedMunicipality = String(user?.municipality ?? "").trim();
  const lockedBarangay = String(user?.barangay ?? "").trim();

  useEffect(() => {
    if (roleKey === "municipal" || roleKey === "barangay") {
      if (lockedMunicipality) {
        setSelectedMunicipality(lockedMunicipality);
        setBarangays(municipalityData[lockedMunicipality] ?? []);
      }
    }
    if (roleKey === "barangay") {
      if (lockedBarangay) setSelectedBarangay(lockedBarangay);
    }
  }, [roleKey, lockedMunicipality, lockedBarangay]);

  const visiblePatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];

    const scoped = (() => {
      if (roleKey === "provincial") return patients;
      if (roleKey === "municipal") {
        if (!lockedMunicipality) return patients;
        return patients.filter((p) => String(p?.municipality ?? "").trim() === lockedMunicipality);
      }
      return patients.filter((p) => {
        const pM = String(p?.municipality ?? "").trim();
        const pB = String(p?.barangay ?? "").trim();
        return (!lockedMunicipality || pM === lockedMunicipality) && (!lockedBarangay || pB === lockedBarangay);
      });
    })();

    const muniFilter = roleKey === "provincial" ? selectedMunicipality : lockedMunicipality;
    const brgyFilter = roleKey === "barangay" ? lockedBarangay : selectedBarangay;

    let filtered = scoped;

    if (muniFilter) filtered = filtered.filter((p) => String(p?.municipality ?? "").trim() === muniFilter);
    if (brgyFilter) filtered = filtered.filter((p) => String(p?.barangay ?? "").trim() === brgyFilter);

    if (selectedDisease) {
      filtered = filtered.filter((p) => String(p?.diseaseType ?? "").trim() === selectedDisease);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      if (roleKey === "barangay") {
        filtered = filtered.filter((p) => String(p?.purok ?? "").toLowerCase().includes(q));
      } else {
        filtered = filtered.filter((p) => String(p?.name ?? "").toLowerCase().includes(q));
      }
    }

    return filtered;
  }, [
    patients,
    roleKey,
    lockedMunicipality,
    lockedBarangay,
    selectedMunicipality,
    selectedBarangay,
    selectedDisease,
    searchTerm
  ]);

  /* ================= HANDLE MUNICIPALITY CHANGE ================= */

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* RIGHT — Filters */}
            <div className="filters-right">

              {/* Municipality */}
              <select
                className="filter-select"
                onChange={handleMunicipalityChange}
                value={roleKey === "provincial" ? selectedMunicipality : lockedMunicipality}
                disabled={roleKey !== "provincial"}
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
                disabled={roleKey === "barangay" ? true : !selectedMunicipality}
                onChange={handleBarangayChange}
                value={roleKey === "barangay" ? lockedBarangay : selectedBarangay}
              >

                <option>
                  All Barangays
                </option>

                {(roleKey === "barangay"
                  ? (lockedBarangay ? [lockedBarangay] : [])
                  : barangays
                ).map((barangay, index) => (

                  <option
                    key={index}
                    value={barangay}
                  >
                    {barangay}
                  </option>

                ))}

              </select>

              {/* Disease */}
              <select
                className="filter-select"
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
              >
                <option value="">All Diseases</option>
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