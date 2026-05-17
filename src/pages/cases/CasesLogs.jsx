import "./CasesLogs.css";
import "@/styles/dashboard-shell.css";
import logo from "@/assets/images/ddoLOGO.jpg";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { sessionUserFromAuth } from "@/lib/authUser";
import { usePatients, PATIENTS_CHANGED_EVENT } from "@/hooks/usePatients";
import { normalizeDisease } from "@/lib/disease";
import { apiFetch } from "@/lib/api";

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

function displayPatientId(patient) {
  const n = String(patient?.patientNumber ?? "").trim();
  if (n) return n;
  if (patient?.id != null) return String(patient.id).padStart(6, "0");
  return "—";
}

/** Case Status column — same values as Report Case caseClass (Suspect / Probable / Confirmed). */
function caseStatusDisplay(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "—";
  const s = t.toLowerCase();
  if (s === "suspect") return "Suspect";
  if (s === "probable") return "Probable";
  if (s === "confirmed") return "Confirmed";
  return t;
}

/** Value for case classification select (Report Case caseClass options). */
function caseClassSelectValue(raw) {
  const d = caseStatusDisplay(raw);
  return d === "—" ? "" : d;
}

function dateSortTime(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "—") return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function comparePatientIds(a, b) {
  const av = displayPatientId(a);
  const bv = displayPatientId(b);
  const aEmpty = av === "—";
  const bEmpty = bv === "—";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const an = Number(a?.id);
  const bn = Number(b?.id);
  if (!a?.patientNumber?.trim() && !b?.patientNumber?.trim() && Number.isFinite(an) && Number.isFinite(bn)) {
    return an - bn;
  }
  return av.localeCompare(bv, "en", { sensitivity: "base", numeric: true });
}

function compareDates(a, b) {
  const at = dateSortTime(a);
  const bt = dateSortTime(b);
  if (at == null && bt == null) return 0;
  if (at == null) return 1;
  if (bt == null) return -1;
  return at - bt;
}

function compareStrings(a, b) {
  const av = String(a ?? "").trim();
  const bv = String(b ?? "").trim();
  const aEmpty = !av || av === "—";
  const bEmpty = !bv || bv === "—";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av.localeCompare(bv, "en", { sensitivity: "base" });
}

function CasesLogs() {
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const { patients: remotePatients, loading, error, refetch } = usePatients();
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    setPatients(Array.isArray(remotePatients) ? remotePatients : []);
  }, [remotePatients]);

  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editPatient, setEditPatient] = useState(null);
  const [editCaseClass, setEditCaseClass] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const { user: authUser, token } = useAuth();
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

  /** API applies RBAC (including cases the user submitted via Report Case). */
  const scopedPatients = useMemo(() => (Array.isArray(patients) ? [...patients] : []), [patients]);

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

    if (statusFilter === "suspect") {
      list = list.filter((p) => norm(p.caseClassification) === "suspect");
    } else if (statusFilter === "probable") {
      list = list.filter((p) => norm(p.caseClassification) === "probable");
    } else if (statusFilter === "confirmed") {
      list = list.filter((p) => norm(p.caseClassification) === "confirmed");
    }

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = String(p.name ?? "").toLowerCase();
        const pid = displayPatientId(p).toLowerCase();
        return name.includes(q) || pid.includes(q);
      });
    }

    return list;
  }, [scopedPatients, roleKey, selectedMunicipality, selectedBarangay, selectedDisease, statusFilter, searchTerm]);

  const sortedPatients = useMemo(() => {
    if (!sortKey) return visiblePatients;
    const list = [...visiblePatients];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "patientId") cmp = comparePatientIds(a, b);
      else if (sortKey === "dateStarted") cmp = compareDates(a.dateStarted, b.dateStarted);
      else if (sortKey === "municipality") cmp = compareStrings(a.municipality, b.municipality);
      else if (sortKey === "barangay") cmp = compareStrings(a.barangay, b.barangay);
      return dir * cmp;
    });
    return list;
  }, [visiblePatients, sortKey, sortDir]);

  const toggleSort = useCallback((key) => {
    const defaultDir = key === "dateStarted" ? "desc" : "asc";
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }, [sortKey]);

  const sortIndicator = useCallback(
    (key) => {
      if (sortKey !== key) return "";
      return sortDir === "asc" ? " ↑" : " ↓";
    },
    [sortKey, sortDir]
  );

  const sortAria = useCallback(
    (key) => {
      if (sortKey !== key) return "none";
      return sortDir === "asc" ? "ascending" : "descending";
    },
    [sortKey, sortDir]
  );

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
    setEditPatient(p);
    setEditCaseClass(caseClassSelectValue(p.caseClassification));
    setEditError(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditPatient(null);
    setEditCaseClass("");
    setEditError(null);
  };

  const openDeleteConfirm = (patient) => {
    if (patient?.id == null) return;
    setDeleteTarget(patient);
    setDeleteError(null);
  };

  const closeDeleteConfirm = () => {
    if (deletingId != null) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    const patient = deleteTarget;
    const id = patient?.id;
    if (id == null || !token) return;

    setDeletingId(id);
    setDeleteError(null);
    try {
      await apiFetch(`/patients/${id}`, { token, method: "DELETE" });
      setPatients((prev) => prev.filter((p) => p.id !== id));
      if (selectedPatient?.id === id) {
        setShowView(false);
        setSelectedPatient(null);
      }
      if (editPatient?.id === id) {
        closeEdit();
      }
      setDeleteTarget(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PATIENTS_CHANGED_EVENT));
      }
      await refetch();
    } catch (e) {
      setDeleteError(e?.message ?? "Failed to delete case");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editPatient?.id || !token) return;
    if (!editCaseClass) {
      setEditError("Select a case classification (Suspect, Probable, or Confirmed).");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const data = await apiFetch(`/patients/${editPatient.id}`, {
        token,
        method: "PATCH",
        body: { caseClassification: editCaseClass }
      });
      const saved = data?.caseClassification ?? editCaseClass;
      setPatients((prev) =>
        prev.map((p) => (p.id === editPatient.id ? { ...p, caseClassification: saved } : p))
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PATIENTS_CHANGED_EVENT));
      }
      closeEdit();
    } catch (e) {
      setEditError(e?.message ?? "Failed to save case classification");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="caseslogs-page">
      <header className="dashboard-header">
        <h2 className="header-title">Case Logs</h2>
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
              placeholder="Search by patient ID or name…"
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
              <option value="">Filter by case status</option>
              <option value="suspect">Suspect</option>
              <option value="probable">Probable</option>
              <option value="confirmed">Confirmed</option>
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
                    <th aria-sort={sortAria("patientId")}>
                      <button
                        type="button"
                        className="caseslogs-sort-btn"
                        onClick={() => toggleSort("patientId")}
                      >
                        Patient ID/No.{sortIndicator("patientId")}
                      </button>
                    </th>
                    <th>Disease</th>
                    <th aria-sort={sortAria("dateStarted")}>
                      <button
                        type="button"
                        className="caseslogs-sort-btn"
                        onClick={() => toggleSort("dateStarted")}
                      >
                        Date of Onset{sortIndicator("dateStarted")}
                      </button>
                    </th>
                    <th>Case Classification</th>
                    <th aria-sort={sortAria("municipality")}>
                      <button
                        type="button"
                        className="caseslogs-sort-btn"
                        onClick={() => toggleSort("municipality")}
                      >
                        Municipality{sortIndicator("municipality")}
                      </button>
                    </th>
                    <th aria-sort={sortAria("barangay")}>
                      <button
                        type="button"
                        className="caseslogs-sort-btn"
                        onClick={() => toggleSort("barangay")}
                      >
                        Barangay{sortIndicator("barangay")}
                      </button>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="caseslogs-empty">
                        <strong>No cases match your filters</strong>
                        Try clearing filters (disease, status, search) or choose another municipality.
                      </td>
                    </tr>
                  ) : (
                    sortedPatients.map((p) => {
                      const dTok = normalizeDisease(p.diseaseType);
                      return (
                        <tr key={p.id}>
                          <td className="num">{displayPatientId(p)}</td>
                          <td>
                            <span className="caseslogs-disease-pill">{diseaseLabel(dTok)}</span>
                          </td>
                          <td className="num">{p.dateStarted ?? "—"}</td>
                          <td>{caseStatusDisplay(p.caseClassification)}</td>
                          <td>{p.municipality ?? "—"}</td>
                          <td>{p.barangay ?? "—"}</td>
                          <td>
                            <div className="caseslogs-actions">
                              <button type="button" className="caseslogs-btn-ghost" onClick={() => handleView(p)}>
                                View
                              </button>
                              <button type="button" className="caseslogs-btn-ghost" onClick={() => handleEdit(p)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="caseslogs-btn-danger"
                                onClick={() => openDeleteConfirm(p)}
                                disabled={deletingId === p.id}
                              >
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
              <dt>Patient ID/No.</dt>
              <dd>{displayPatientId(selectedPatient)}</dd>
              <dt>Name</dt>
              <dd>{selectedPatient.name}</dd>
              <dt>Age</dt>
              <dd>{selectedPatient.age}</dd>
              <dt>Sex</dt>
              <dd>{selectedPatient.sex}</dd>
              <dt>Disease</dt>
              <dd>{diseaseLabel(normalizeDisease(selectedPatient.diseaseType))}</dd>
              <dt>Case Classification</dt>
              <dd>{caseStatusDisplay(selectedPatient.caseClassification)}</dd>
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
              <dt>Date of Onset</dt>
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

      {deleteTarget ? (
        <div
          className="caseslogs-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cases-delete-title"
          onClick={closeDeleteConfirm}
        >
          <div
            className="caseslogs-modal caseslogs-modal--delete"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cases-delete-title">Delete case permanently?</h3>
            <p className="caseslogs-delete-lead">
              This removes the reported case from the database. It cannot be undone and will disappear from
              dashboards and surveillance views.
            </p>
            <dl className="caseslogs-modal-dl caseslogs-modal-dl--readonly">
              <dt>Patient ID/No.</dt>
              <dd>{displayPatientId(deleteTarget)}</dd>
              <dt>Name</dt>
              <dd>{deleteTarget.name ?? "—"}</dd>
              <dt>Disease</dt>
              <dd>{diseaseLabel(normalizeDisease(deleteTarget.diseaseType))}</dd>
              <dt>Municipality</dt>
              <dd>{deleteTarget.municipality ?? "—"}</dd>
              <dt>Barangay</dt>
              <dd>{deleteTarget.barangay ?? "—"}</dd>
            </dl>
            {deleteError ? (
              <p className="caseslogs-edit-error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="caseslogs-modal-actions">
              <button
                type="button"
                className="caseslogs-btn-ghost"
                onClick={closeDeleteConfirm}
                disabled={deletingId != null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="caseslogs-btn-danger caseslogs-btn-danger--confirm"
                onClick={confirmDelete}
                disabled={deletingId != null}
              >
                {deletingId != null ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEdit && editPatient ? (
        <div className="caseslogs-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cases-edit-title">
          <div className="caseslogs-modal">
            <h3 id="cases-edit-title">Edit case classification</h3>
            <dl className="caseslogs-modal-dl caseslogs-modal-dl--readonly">
              <dt>Patient ID/No.</dt>
              <dd>{displayPatientId(editPatient)}</dd>
              <dt>Name</dt>
              <dd>{editPatient.name ?? "—"}</dd>
              <dt>Disease</dt>
              <dd>{diseaseLabel(normalizeDisease(editPatient.diseaseType))}</dd>
              <dt>Date of Onset</dt>
              <dd>{editPatient.dateStarted ?? "—"}</dd>
              <dt>Municipality</dt>
              <dd>{editPatient.municipality ?? "—"}</dd>
              <dt>Barangay</dt>
              <dd>{editPatient.barangay ?? "—"}</dd>
            </dl>
            <div className="caseslogs-edit-field">
              <label className="caseslogs-edit-label" htmlFor="edit-caseClass">
                Case Classification <span className="caseslogs-req">*</span>
              </label>
              <select
                id="edit-caseClass"
                className={`caseslogs-modal-select${editError && !editCaseClass ? " error" : ""}`}
                value={editCaseClass}
                onChange={(e) => {
                  setEditCaseClass(e.target.value);
                  setEditError(null);
                }}
                disabled={editSaving}
              >
                <option value="">— Select classification —</option>
                <option value="Suspect">Suspect</option>
                <option value="Probable">Probable</option>
                <option value="Confirmed">Confirmed</option>
              </select>
              <p className="caseslogs-edit-hint">Based on clinical and lab criteria (CASECLASS field)</p>
            </div>
            {editError ? (
              <p className="caseslogs-edit-error" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="caseslogs-modal-actions">
              <button type="button" className="caseslogs-btn-ghost" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </button>
              <button type="button" className="caseslogs-btn-primary" onClick={handleUpdate} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CasesLogs;
