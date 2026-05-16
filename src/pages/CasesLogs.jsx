import "./CasesLogs.css";
import "./Dashboard.css";
import logo from "../assets/images/ddoLOGO.JPG";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { sessionUserFromAuth } from "../lib/authUser";
import { usePatients } from "../hooks/usePatients";
import { normalizeDisease } from "../lib/disease";

const MUNICIPALITY_DATA = {
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

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function diseaseLabel(token) {
  if (token === "DENGUE") return "Dengue";
  if (token === "ILI") return "ILI";
  if (token === "AWD") return "AWD";
  return token || "—";
}

function caseStatusLabel(raw) {
  const s = String(raw ?? "active").trim().toLowerCase();
  if (s === "closed") return "Closed";
  return "Active";
}

function CasesLogs() {
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { patients: remotePatients, loading, error, refetch } = usePatients();
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    setPatients(Array.isArray(remotePatients) ? remotePatients : []);
  }, [remotePatients]);

  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editData, setEditData] = useState(null);

  const { user: authUser } = useAuth();
  const user = sessionUserFromAuth(authUser);
  const roleRaw = String(user?.role ?? "").toLowerCase();

  const roleKey = useMemo(() => {
    if (roleRaw.includes("barangay")) return "barangay";
    if (roleRaw.includes("municipal")) return "municipal";
    if (roleRaw.includes("province") || roleRaw.includes("provincial")) return "province";
    return "province";
  }, [roleRaw]);

  const lockedMunicipality = String(user?.municipality ?? "").trim();
  const lockedBarangay = String(user?.barangay ?? "").trim();

  useEffect(() => {
    if (roleKey === "municipal" || roleKey === "barangay") {
      if (lockedMunicipality) {
        setSelectedMunicipality(lockedMunicipality);
        setBarangayOptions(MUNICIPALITY_DATA[lockedMunicipality] || []);
      }
    } else {
      setSelectedMunicipality("");
      setSelectedBarangay("");
      setBarangayOptions([]);
    }
    if (roleKey === "barangay" && lockedBarangay) {
      setSelectedBarangay(lockedBarangay);
    }
    if (roleKey === "province") {
      setSelectedMunicipality("");
      setSelectedBarangay("");
      setBarangayOptions([]);
    }
  }, [roleKey, lockedMunicipality, lockedBarangay]);

  const scopedPatients = useMemo(() => {
    let list = Array.isArray(patients) ? [...patients] : [];
    if (roleKey === "barangay") {
      const m = norm(lockedMunicipality);
      const b = norm(lockedBarangay);
      if (m && b) {
        list = list.filter((p) => norm(p.municipality) === m && norm(p.barangay) === b);
      }
    } else if (roleKey === "municipal") {
      const m = norm(lockedMunicipality);
      if (m) list = list.filter((p) => norm(p.municipality) === m);
    }
    return list;
  }, [patients, roleKey, lockedMunicipality, lockedBarangay]);

  const visiblePatients = useMemo(() => {
    let list = scopedPatients;

    if (roleKey === "province" && selectedMunicipality) {
      list = list.filter((p) => norm(p.municipality) === norm(selectedMunicipality));
    }

    if ((roleKey === "province" || roleKey === "municipal") && selectedBarangay) {
      list = list.filter((p) => norm(p.barangay) === norm(selectedBarangay));
    }

    if (selectedDisease) {
      list = list.filter((p) => normalizeDisease(p.diseaseType) === selectedDisease);
    }

    if (statusFilter === "suspected") {
      list = list.filter((p) => norm(p.caseClassification) === "suspect");
    } else if (statusFilter === "active") {
      list = list.filter((p) => {
        const s = String(p.caseStatus ?? "active").trim().toLowerCase();
        return s === "active" || s === "";
      });
    }

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => String(p.name ?? "").toLowerCase().includes(q));
    }

    return list;
  }, [scopedPatients, roleKey, selectedMunicipality, selectedBarangay, selectedDisease, statusFilter, searchTerm]);

  const kpi = useMemo(() => {
    let d = 0;
    let i = 0;
    let a = 0;
    for (const p of visiblePatients) {
      const t = normalizeDisease(p.diseaseType);
      if (t === "DENGUE") d += 1;
      else if (t === "ILI") i += 1;
      else if (t === "AWD") a += 1;
    }
    return { total: visiblePatients.length, dengue: d, ili: i, awd: a };
  }, [visiblePatients]);

  const scopeBanner = useMemo(() => {
    if (roleKey === "barangay") {
      return {
        title: "Your barangay scope",
        value: lockedBarangay && lockedMunicipality ? `${lockedBarangay} · ${lockedMunicipality}` : "Barangay user",
        hint: "Cases listed are limited to your barangay (same as the server). Use search or disease filters to narrow the list."
      };
    }
    if (roleKey === "municipal") {
      return {
        title: "Your municipality scope",
        value: lockedMunicipality || "Municipality user",
        hint: "All cases in your municipality are available. Filter by barangay or disease as needed."
      };
    }
    return {
      title: "Province-wide view",
      value: user?.provinceName?.trim() || "Davao de Oro",
      hint: "You can review cases from every municipality and barangay in the province. Use the filters to focus on an area."
    };
  }, [roleKey, lockedMunicipality, lockedBarangay, user?.provinceName]);

  const handleMunicipalityChange = useCallback((e) => {
    const municipality = e.target.value;
    setSelectedMunicipality(municipality);
    setSelectedBarangay("");
    setBarangayOptions(municipality && MUNICIPALITY_DATA[municipality] ? MUNICIPALITY_DATA[municipality] : []);
  }, []);

  const handleView = (p) => {
    setSelectedPatient(p);
    setShowView(true);
  };

  const handleEdit = (p) => {
    setEditData({ ...p });
    setShowEdit(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this case from the list?")) return;
    setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdate = () => {
    if (!editData) return;
    setPatients((prev) => prev.map((p) => (p.id === editData.id ? { ...p, ...editData } : p)));
    setShowEdit(false);
  };

  return (
    <div className="caseslogs-page">
      <header className="dashboard-header">
        <h2 className="header-title">Cases Logs</h2>
        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>
          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>Provincial Health Office</p>
          </div>
          <img src={logo} alt="logo" className="header-logo" />
        </div>
      </header>

      <div className="caseslogs-main">
        <div className="caseslogs-scope">
          <div className="caseslogs-scope-copy">
            <p className="caseslogs-scope-title">{scopeBanner.title}</p>
            <p className="caseslogs-scope-value">{scopeBanner.value}</p>
            <p className="caseslogs-scope-hint">{scopeBanner.hint}</p>
          </div>
          <div className="caseslogs-kpis" aria-label="Case counts for current filters">
            <div className="caseslogs-kpi">
              <div className="caseslogs-kpi-label">Showing</div>
              <div className="caseslogs-kpi-value">{kpi.total}</div>
            </div>
            <div className="caseslogs-kpi">
              <div className="caseslogs-kpi-label">Dengue</div>
              <div className="caseslogs-kpi-value">{kpi.dengue}</div>
            </div>
            <div className="caseslogs-kpi">
              <div className="caseslogs-kpi-label">ILI</div>
              <div className="caseslogs-kpi-value">{kpi.ili}</div>
            </div>
            <div className="caseslogs-kpi">
              <div className="caseslogs-kpi-label">AWD</div>
              <div className="caseslogs-kpi-value">{kpi.awd}</div>
            </div>
          </div>
        </div>

        <div className="caseslogs-toolbar">
          <div className="caseslogs-toolbar-left">
            <input
              type="search"
              placeholder="Search by patient name…"
              className="caseslogs-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search cases"
            />
          </div>
          <div className="caseslogs-toolbar-right">
            {roleKey === "province" ? (
              <select
                className="caseslogs-select"
                aria-label="Filter by municipality"
                onChange={handleMunicipalityChange}
                value={selectedMunicipality}
              >
                <option value="">All municipalities</option>
                {Object.keys(MUNICIPALITY_DATA).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : null}

            {roleKey === "province" || roleKey === "municipal" ? (
              <select
                className="caseslogs-select"
                aria-label="Filter by barangay"
                onChange={(e) => setSelectedBarangay(e.target.value)}
                value={selectedBarangay}
                disabled={roleKey === "province" ? !selectedMunicipality : false}
              >
                <option value="">
                  {roleKey === "province" && !selectedMunicipality ? "Select municipality first" : "All barangays"}
                </option>
                {barangayOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              className="caseslogs-select"
              aria-label="Filter by disease"
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
            >
              <option value="">All diseases</option>
              <option value="DENGUE">Dengue</option>
              <option value="ILI">Influenza-like illness (ILI)</option>
              <option value="AWD">Acute watery diarrhea (AWD)</option>
            </select>

            <select
              className="caseslogs-select"
              aria-label="Filter by case status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All case types</option>
              <option value="suspected">Suspected (classification)</option>
              <option value="active">Active cases only</option>
            </select>
          </div>
        </div>

        {loading ? <div className="caseslogs-loading">Loading cases…</div> : null}
        {error ? (
          <div className="caseslogs-error" role="alert">
            {error}{" "}
            <button type="button" className="caseslogs-btn-ghost" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="caseslogs-table-card">
            <div className="caseslogs-table-scroll">
              <table className="caseslogs-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Age</th>
                    <th>Sex</th>
                    <th>Disease</th>
                    <th>Classification</th>
                    <th>Case status</th>
                    <th>Municipality</th>
                    <th>Barangay</th>
                    <th>Date started</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="caseslogs-empty">
                        <strong>No cases match your filters</strong>
                        Try clearing filters (disease, status, search) or choose another municipality.
                      </td>
                    </tr>
                  ) : (
                    visiblePatients.map((p) => {
                      const dTok = normalizeDisease(p.diseaseType);
                      return (
                        <tr key={p.id}>
                          <td>{p.name ?? "—"}</td>
                          <td className="num">{p.age ?? "—"}</td>
                          <td>{p.sex ?? "—"}</td>
                          <td>
                            <span className="caseslogs-disease-pill">{diseaseLabel(dTok)}</span>
                          </td>
                          <td>{p.caseClassification ?? "—"}</td>
                          <td>{caseStatusLabel(p.caseStatus)}</td>
                          <td>{p.municipality ?? "—"}</td>
                          <td>{p.barangay ?? "—"}</td>
                          <td className="num">{p.dateStarted ?? "—"}</td>
                          <td>
                            <div className="caseslogs-actions">
                              <button type="button" className="caseslogs-btn-ghost" onClick={() => handleView(p)}>
                                View
                              </button>
                              <button type="button" className="caseslogs-btn-ghost" onClick={() => handleEdit(p)}>
                                Edit
                              </button>
                              <button type="button" className="caseslogs-btn-danger" onClick={() => handleDelete(p.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {showView && selectedPatient ? (
        <div className="caseslogs-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cases-view-title">
          <div className="caseslogs-modal">
            <h3 id="cases-view-title">Case details</h3>
            <dl className="caseslogs-modal-dl">
              <dt>Name</dt>
              <dd>{selectedPatient.name}</dd>
              <dt>Age</dt>
              <dd>{selectedPatient.age}</dd>
              <dt>Sex</dt>
              <dd>{selectedPatient.sex}</dd>
              <dt>Disease</dt>
              <dd>{diseaseLabel(normalizeDisease(selectedPatient.diseaseType))}</dd>
              <dt>Classification</dt>
              <dd>{selectedPatient.caseClassification ?? "—"}</dd>
              <dt>Case status</dt>
              <dd>{caseStatusLabel(selectedPatient.caseStatus)}</dd>
              <dt>Municipality</dt>
              <dd>{selectedPatient.municipality}</dd>
              <dt>Barangay</dt>
              <dd>{selectedPatient.barangay}</dd>
              <dt>Purok</dt>
              <dd>{selectedPatient.purok ?? "—"}</dd>
              <dt>Birthdate</dt>
              <dd>{selectedPatient.birthdate ?? "—"}</dd>
              <dt>Civil status</dt>
              <dd>{selectedPatient.civilStatus ?? "—"}</dd>
              <dt>Birthplace</dt>
              <dd>{selectedPatient.birthplace ?? "—"}</dd>
              <dt>Date started</dt>
              <dd>{selectedPatient.dateStarted ?? "—"}</dd>
            </dl>
            <div className="caseslogs-modal-actions">
              <button type="button" className="caseslogs-btn-primary" onClick={() => setShowView(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEdit && editData ? (
        <div className="caseslogs-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cases-edit-title">
          <div className="caseslogs-modal">
            <h3 id="cases-edit-title">Edit case (local)</h3>
            <label className="caseslogs-scope-title" htmlFor="edit-name">
              Name
            </label>
            <input
              id="edit-name"
              value={editData.name ?? ""}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            />
            <label className="caseslogs-scope-title" htmlFor="edit-age">
              Age
            </label>
            <input
              id="edit-age"
              value={editData.age ?? ""}
              onChange={(e) => setEditData({ ...editData, age: e.target.value })}
            />
            <label className="caseslogs-scope-title" htmlFor="edit-sex">
              Sex
            </label>
            <input
              id="edit-sex"
              value={editData.sex ?? ""}
              onChange={(e) => setEditData({ ...editData, sex: e.target.value })}
            />
            <label className="caseslogs-scope-title" htmlFor="edit-disease">
              Disease
            </label>
            <input
              id="edit-disease"
              value={editData.diseaseType ?? ""}
              onChange={(e) => setEditData({ ...editData, diseaseType: e.target.value })}
            />
            <div className="caseslogs-modal-actions">
              <button type="button" className="caseslogs-btn-ghost" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
              <button type="button" className="caseslogs-btn-primary" onClick={handleUpdate}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CasesLogs;
