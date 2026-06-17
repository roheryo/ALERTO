import "./CasesLogs.css";
import "@/styles/dashboard-shell.css";
import logo from "@/assets/images/ddoLOGO.jpg";
import { useMemo, useState, useEffect, useCallback, useDeferredValue, startTransition } from "react";
import { Link } from "react-router-dom";
import { FaBell, FaClipboardList, FaMapMarkerAlt, FaUser } from "react-icons/fa";
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

const PAGE_SIZE = 100;

const CASE_CLASS_OPTIONS = [
  {
    value: "Suspect",
    label: "Suspect",
    hint: "Meets initial clinical criteria for the disease."
  },
  {
    value: "Probable",
    label: "Probable",
    hint: "Strong clinical evidence without full lab confirmation."
  },
  {
    value: "Confirmed",
    label: "Confirmed",
    hint: "Laboratory or definitive confirmation is available."
  }
];

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

function diseaseBadgeClass(token) {
  if (token === "DENGUE") return "caseslogs-badge--dengue";
  if (token === "ILI") return "caseslogs-badge--ili";
  if (token === "AWD") return "caseslogs-badge--awd";
  return "caseslogs-badge--default";
}

function caseStatusBadgeClass(raw) {
  const status = caseStatusDisplay(raw).toLowerCase();
  if (status === "suspect") return "caseslogs-badge--suspect";
  if (status === "probable") return "caseslogs-badge--probable";
  if (status === "confirmed") return "caseslogs-badge--confirmed";
  return "caseslogs-badge--default";
}

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text || "—";
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
  const [page, setPage] = useState(1);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredMunicipality = useDeferredValue(selectedMunicipality);
  const deferredBarangay = useDeferredValue(selectedBarangay);
  const deferredDisease = useDeferredValue(selectedDisease);
  const deferredStatus = useDeferredValue(statusFilter);
  const filtersPending =
    deferredSearchTerm !== searchTerm ||
    deferredMunicipality !== selectedMunicipality ||
    deferredBarangay !== selectedBarangay ||
    deferredDisease !== selectedDisease ||
    deferredStatus !== statusFilter;

  const { patients, loading, error, refetch, mutatePatients } = usePatients();

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

  /** Pre-normalize once per fetch so filters/sort avoid repeated string work. */
  const patientIndex = useMemo(
    () =>
      (Array.isArray(patients) ? patients : []).map((p) => ({
        patient: p,
        normMuni: norm(p.municipality),
        normBrgy: norm(p.barangay),
        disease: normalizeDisease(p.diseaseType),
        normStatus: norm(p.caseClassification),
        searchHaystack: `${displayPatientId(p)} ${String(p.name ?? "")}`.toLowerCase(),
        dateStartedTime: dateSortTime(p.dateStarted)
      })),
    [patients]
  );

  const visibleRows = useMemo(() => {
    const q = deferredSearchTerm.trim().toLowerCase();
    const muniKey = deferredMunicipality ? norm(deferredMunicipality) : "";
    const brgyKey = deferredBarangay ? norm(deferredBarangay) : "";
    const rows = [];

    for (const row of patientIndex) {
      if (roleKey === "province" && muniKey && row.normMuni !== muniKey) continue;
      if ((roleKey === "province" || roleKey === "municipal") && brgyKey && row.normBrgy !== brgyKey) {
        continue;
      }
      if (deferredDisease && row.disease !== deferredDisease) continue;
      if (deferredStatus && row.normStatus !== deferredStatus) continue;
      if (q && !row.searchHaystack.includes(q)) continue;
      rows.push(row);
    }

    return rows;
  }, [
    patientIndex,
    roleKey,
    deferredMunicipality,
    deferredBarangay,
    deferredDisease,
    deferredStatus,
    deferredSearchTerm
  ]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return visibleRows;
    const list = [...visibleRows];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "patientId") cmp = comparePatientIds(a.patient, b.patient);
      else if (sortKey === "dateStarted") {
        cmp = (a.dateStartedTime ?? Number.POSITIVE_INFINITY) - (b.dateStartedTime ?? Number.POSITIVE_INFINITY);
      } else if (sortKey === "municipality") cmp = compareStrings(a.patient.municipality, b.patient.municipality);
      else if (sortKey === "barangay") cmp = compareStrings(a.patient.barangay, b.patient.barangay);
      return dir * cmp;
    });
    return list;
  }, [visibleRows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [
    deferredMunicipality,
    deferredBarangay,
    deferredDisease,
    deferredStatus,
    deferredSearchTerm,
    sortKey,
    sortDir
  ]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const pageStart = sortedRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, sortedRows.length);

  const toggleSort = useCallback((key) => {
    startTransition(() => {
      const defaultDir = key === "dateStarted" ? "desc" : "asc";
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(defaultDir);
      }
    });
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
    for (const row of visibleRows) {
      if (row.disease === "DENGUE") d += 1;
      else if (row.disease === "ILI") i += 1;
      else if (row.disease === "AWD") a += 1;
    }
    return { total: visibleRows.length, dengue: d, ili: i, awd: a };
  }, [visibleRows]);

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
    startTransition(() => {
      setSelectedMunicipality(municipality);
      setSelectedBarangay("");
      setBarangayOptions(municipality && MUNICIPALITY_DATA[municipality] ? MUNICIPALITY_DATA[municipality] : []);
    });
  }, []);

  const handleBarangayChange = useCallback((e) => {
    startTransition(() => setSelectedBarangay(e.target.value));
  }, []);

  const handleDiseaseChange = useCallback((e) => {
    startTransition(() => setSelectedDisease(e.target.value));
  }, []);

  const handleStatusChange = useCallback((e) => {
    startTransition(() => setStatusFilter(e.target.value));
  }, []);

  const handleView = (p) => {
    setSelectedPatient(p);
    setShowView(true);
  };

  const closeView = () => {
    setShowView(false);
    setSelectedPatient(null);
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
      mutatePatients((prev) => prev.filter((p) => p.id !== id));
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

  const openEditFromView = () => {
    if (!selectedPatient) return;
    const patient = selectedPatient;
    closeView();
    handleEdit(patient);
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
      mutatePatients((prev) =>
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
    <div className={`caseslogs-page${filtersPending ? " caseslogs-page--pending" : ""}`}>
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
        <section className="caseslogs-scope-panel" aria-label="Case log scope and summary">
          <div className="caseslogs-scope-copy">
            <p className="caseslogs-scope-title">{scopeBanner.title}</p>
            <h2 className="caseslogs-scope-value">{scopeBanner.value}</h2>
            <p className="caseslogs-scope-hint">{scopeBanner.hint}</p>
          </div>

          <div className="caseslogs-kpis" aria-label="Case counts for current filters">
            <article className="caseslogs-kpi caseslogs-kpi--total">
              <span className="caseslogs-kpi-label">Showing</span>
              <strong className="caseslogs-kpi-value">{kpi.total.toLocaleString()}</strong>
            </article>
            <article className="caseslogs-kpi caseslogs-kpi--dengue">
              <span className="caseslogs-kpi-label">Dengue</span>
              <strong className="caseslogs-kpi-value">{kpi.dengue.toLocaleString()}</strong>
            </article>
            <article className="caseslogs-kpi caseslogs-kpi--ili">
              <span className="caseslogs-kpi-label">ILI</span>
              <strong className="caseslogs-kpi-value">{kpi.ili.toLocaleString()}</strong>
            </article>
            <article className="caseslogs-kpi caseslogs-kpi--awd">
              <span className="caseslogs-kpi-label">AWD</span>
              <strong className="caseslogs-kpi-value">{kpi.awd.toLocaleString()}</strong>
            </article>
          </div>
        </section>

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
                onChange={handleBarangayChange}
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
              onChange={handleDiseaseChange}
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
              onChange={handleStatusChange}
            >
              <option value="">Filter by case status</option>
              <option value="suspect">Suspect</option>
              <option value="probable">Probable</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        {loading && patients.length === 0 ? <div className="caseslogs-loading">Loading cases…</div> : null}
        {error ? (
          <div className="caseslogs-error" role="alert">
            {error}{" "}
            <button type="button" className="caseslogs-btn-ghost" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : null}
        {!error && (patients.length > 0 || !loading) ? (
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
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="caseslogs-empty">
                        <strong>No cases match your filters</strong>
                        Try clearing filters (disease, status, search) or choose another municipality.
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => {
                      const p = row.patient;
                      return (
                        <tr key={p.id}>
                          <td className="num">{displayPatientId(p)}</td>
                          <td>
                            <span className="caseslogs-disease-pill">{diseaseLabel(row.disease)}</span>
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
            {sortedRows.length > PAGE_SIZE ? (
              <footer className="caseslogs-pagination" aria-label="Case list pages">
                <p className="caseslogs-pagination-meta">
                  Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of{" "}
                  {sortedRows.length.toLocaleString()} cases
                  {filtersPending ? " · Updating filters…" : ""}
                </p>
                <div className="caseslogs-pagination-actions">
                  <button
                    type="button"
                    className="caseslogs-btn-ghost"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    className="caseslogs-btn-ghost"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </button>
                  <span className="caseslogs-pagination-page">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className="caseslogs-btn-ghost"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="caseslogs-btn-ghost"
                    onClick={() => setPage(pageCount)}
                    disabled={page >= pageCount}
                  >
                    Last
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        ) : null}
      </div>

      {showView && selectedPatient ? (
        <div
          className="caseslogs-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cases-view-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeView();
          }}
        >
          <div className="caseslogs-modal caseslogs-modal--view" onClick={(e) => e.stopPropagation()}>
            <header className="caseslogs-modal-header">
              <div className="caseslogs-modal-header-copy">
                <p className="caseslogs-modal-kicker">Patient record</p>
                <h3 id="cases-view-title">{displayValue(selectedPatient.name)}</h3>
                <p className="caseslogs-modal-subid">ID {displayPatientId(selectedPatient)}</p>
                <div className="caseslogs-modal-badges">
                  <span
                    className={`caseslogs-badge ${diseaseBadgeClass(normalizeDisease(selectedPatient.diseaseType))}`}
                  >
                    {diseaseLabel(normalizeDisease(selectedPatient.diseaseType))}
                  </span>
                  <span className={`caseslogs-badge ${caseStatusBadgeClass(selectedPatient.caseClassification)}`}>
                    {caseStatusDisplay(selectedPatient.caseClassification)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="caseslogs-modal-close"
                onClick={closeView}
                aria-label="Close patient details"
              >
                ×
              </button>
            </header>

            <div className="caseslogs-modal-body">
              <section className="caseslogs-modal-section" aria-labelledby="cases-view-identification">
                <h4 id="cases-view-identification">
                  <FaUser aria-hidden />
                  Identification
                </h4>
                <div className="caseslogs-field-grid">
                  <div className="caseslogs-field">
                    <span>Patient ID/No.</span>
                    <strong>{displayPatientId(selectedPatient)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Full name</span>
                    <strong>{displayValue(selectedPatient.name)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Age</span>
                    <strong>{displayValue(selectedPatient.age)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Sex</span>
                    <strong>{displayValue(selectedPatient.sex)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Birthdate</span>
                    <strong>{displayValue(selectedPatient.birthdate)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Civil status</span>
                    <strong>{displayValue(selectedPatient.civilStatus)}</strong>
                  </div>
                  <div className="caseslogs-field caseslogs-field--wide">
                    <span>Birthplace</span>
                    <strong>{displayValue(selectedPatient.birthplace)}</strong>
                  </div>
                </div>
              </section>

              <section className="caseslogs-modal-section" aria-labelledby="cases-view-case">
                <h4 id="cases-view-case">
                  <FaClipboardList aria-hidden />
                  Case details
                </h4>
                <div className="caseslogs-field-grid">
                  <div className="caseslogs-field">
                    <span>Disease</span>
                    <strong>{diseaseLabel(normalizeDisease(selectedPatient.diseaseType))}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Classification</span>
                    <strong>{caseStatusDisplay(selectedPatient.caseClassification)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Date of onset</span>
                    <strong>{displayValue(selectedPatient.dateStarted)}</strong>
                  </div>
                </div>
              </section>

              <section className="caseslogs-modal-section" aria-labelledby="cases-view-location">
                <h4 id="cases-view-location">
                  <FaMapMarkerAlt aria-hidden />
                  Location
                </h4>
                <div className="caseslogs-field-grid">
                  <div className="caseslogs-field">
                    <span>Municipality</span>
                    <strong>{displayValue(selectedPatient.municipality)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Barangay</span>
                    <strong>{displayValue(selectedPatient.barangay)}</strong>
                  </div>
                  <div className="caseslogs-field">
                    <span>Purok</span>
                    <strong>{displayValue(selectedPatient.purok)}</strong>
                  </div>
                </div>
              </section>
            </div>

            <footer className="caseslogs-modal-footer">
              <button type="button" className="caseslogs-btn-ghost" onClick={closeView}>
                Close
              </button>
              <button type="button" className="caseslogs-btn-primary caseslogs-btn-primary--blue" onClick={openEditFromView}>
                Edit classification
              </button>
            </footer>
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
        <div
          className="caseslogs-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cases-edit-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSaving) closeEdit();
          }}
        >
          <div className="caseslogs-modal caseslogs-modal--edit" onClick={(e) => e.stopPropagation()}>
            <header className="caseslogs-modal-header">
              <div className="caseslogs-modal-header-copy">
                <p className="caseslogs-modal-kicker">Update case</p>
                <h3 id="cases-edit-title">Edit case classification</h3>
                <p className="caseslogs-modal-subid">
                  {displayValue(editPatient.name)} · ID {displayPatientId(editPatient)}
                </p>
              </div>
              <button
                type="button"
                className="caseslogs-modal-close"
                onClick={closeEdit}
                disabled={editSaving}
                aria-label="Close edit form"
              >
                ×
              </button>
            </header>

            <div className="caseslogs-modal-body">
              <section className="caseslogs-modal-section caseslogs-modal-section--summary" aria-label="Case summary">
                <div className="caseslogs-summary-grid">
                  <div className="caseslogs-summary-card">
                    <span>Disease</span>
                    <strong>{diseaseLabel(normalizeDisease(editPatient.diseaseType))}</strong>
                  </div>
                  <div className="caseslogs-summary-card">
                    <span>Date of onset</span>
                    <strong>{displayValue(editPatient.dateStarted)}</strong>
                  </div>
                  <div className="caseslogs-summary-card">
                    <span>Municipality</span>
                    <strong>{displayValue(editPatient.municipality)}</strong>
                  </div>
                  <div className="caseslogs-summary-card">
                    <span>Barangay</span>
                    <strong>{displayValue(editPatient.barangay)}</strong>
                  </div>
                </div>
              </section>

              <section className="caseslogs-modal-section caseslogs-modal-section--editable" aria-labelledby="cases-edit-classification">
                <h4 id="cases-edit-classification">Case classification</h4>
                <p className="caseslogs-edit-lead">
                  Choose the current classification based on clinical findings and laboratory results.
                </p>
                <div
                  className="caseslogs-class-options"
                  role="radiogroup"
                  aria-label="Case classification"
                  aria-invalid={Boolean(editError && !editCaseClass)}
                >
                  {CASE_CLASS_OPTIONS.map((option) => {
                    const selected = editCaseClass === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={[
                          "caseslogs-class-option",
                          `caseslogs-class-option--${option.value.toLowerCase()}`,
                          selected ? "is-selected" : "",
                          editError && !editCaseClass ? "is-invalid" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          setEditCaseClass(option.value);
                          setEditError(null);
                        }}
                        disabled={editSaving}
                      >
                        <span className="caseslogs-class-option-top">
                          <span className="caseslogs-class-option-label">{option.label}</span>
                          {selected ? <span className="caseslogs-class-option-check">Selected</span> : null}
                        </span>
                        <span className="caseslogs-class-option-hint">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="caseslogs-edit-hint">Maps to the CASECLASS field used in surveillance reporting.</p>
                {editError ? (
                  <p className="caseslogs-edit-error" role="alert">
                    {editError}
                  </p>
                ) : null}
              </section>
            </div>

            <footer className="caseslogs-modal-footer">
              <button type="button" className="caseslogs-btn-ghost" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </button>
              <button type="button" className="caseslogs-btn-primary caseslogs-btn-primary--blue" onClick={handleUpdate} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CasesLogs;
