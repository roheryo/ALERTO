import { useMemo, useState, useDeferredValue, startTransition } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";

import logo from "@/assets/images/ddoLOGO.jpg";
import MunicipalBarangayMap from "@/components/dashboard/MunicipalBarangayMap";
import { barangaysForMunicipality } from "@/data/davaoDeOroGeography";
import { useAuth } from "@/context/AuthContext";
import { sessionUserFromAuth } from "@/lib/authUser";
import { filterConfirmedPatients } from "@/lib/disease";
import { usePatients } from "@/hooks/usePatients";
import {
  buildSurveillanceIndex,
  computeBarangayVelocityRows,
  formatPeriodCaption,
  resolveSurveillanceWindows
} from "@/lib/surveillance";
import "@/styles/dashboard-shell.css";
import "./MunicipalDashboard.css";

const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "ILI" },
  { value: "AWD", label: "AWD" },
  { value: "ALL", label: "All diseases" }
];

const FIXED_WINDOW_WEEKS = 4;

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function deltaClass(delta) {
  if (delta > 0) return "muni-kpi-delta--up";
  if (delta < 0) return "muni-kpi-delta--down";
  return "muni-kpi-delta--flat";
}

/**
 * Municipal spatiotemporal barangay map — rolling counts and velocity by area.
 */
function MunicipalSurveillanceMap() {
  const { user: authUser } = useAuth();
  const user = sessionUserFromAuth(authUser);
  const municipalityName = String(user?.municipality ?? "").trim();

  const { patients, loading, error } = usePatients();

  const [diseaseFilter, setDiseaseFilter] = useState("DENGUE");
  const deferredDiseaseFilter = useDeferredValue(diseaseFilter);
  const isFilterPending = deferredDiseaseFilter !== diseaseFilter;
  const [mapMetric, setMapMetric] = useState("count");
  const [selectedBarangayKey, setSelectedBarangayKey] = useState(null);

  const scopedPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const list = municipalityName
      ? patients.filter((p) => String(p?.municipality ?? "").trim() === municipalityName)
      : patients;
    return filterConfirmedPatients(list);
  }, [patients, municipalityName]);

  const caseIndex = useMemo(() => buildSurveillanceIndex(scopedPatients), [scopedPatients]);

  const barangayNames = useMemo(
    () => barangaysForMunicipality(municipalityName),
    [municipalityName]
  );

  const timeOptions = useMemo(
    () => ({ windowMode: "weeks", periodOffset: 0, referenceDate: new Date(), caseIndex }),
    [caseIndex]
  );

  const windows = useMemo(
    () =>
      resolveSurveillanceWindows({
        windowWeeks: FIXED_WINDOW_WEEKS,
        windowMode: "weeks",
        periodOffset: 0,
        referenceDate: new Date()
      }),
    []
  );

  const periodCaption = useMemo(
    () =>
      formatPeriodCaption(windows, {
        windowMode: "weeks",
        windowWeeks: FIXED_WINDOW_WEEKS,
        periodOffset: 0
      }),
    [windows]
  );

  const velocityRows = useMemo(
    () =>
      computeBarangayVelocityRows(scopedPatients, barangayNames, FIXED_WINDOW_WEEKS, deferredDiseaseFilter, {
        ...timeOptions,
        windows
      }),
    [scopedPatients, barangayNames, deferredDiseaseFilter, timeOptions, windows]
  );

  function handleDiseaseChange(nextValue) {
    startTransition(() => {
      setDiseaseFilter(nextValue);
      setSelectedBarangayKey(null);
    });
  }

  function handleMapMetricChange(nextValue) {
    startTransition(() => setMapMetric(nextValue));
  }

  const selectedRow = useMemo(
    () => velocityRows.find((r) => r.barangayKey === selectedBarangayKey) ?? null,
    [velocityRows, selectedBarangayKey]
  );

  const headerSubline = municipalityName
    ? `${municipalityName} · Barangay-level case distribution`
    : null;

  return (
    <div className="dashboard-container muni-map-page">
      <header className="dashboard-header">
        <div>
          <h2 className="header-title">Surveillance Map</h2>
          {headerSubline ? <p className="header-subline">{headerSubline}</p> : null}
        </div>
        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>
          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>Municipal Health Office</p>
          </div>
          <img src={logo} alt="logo" className="header-logo" />
        </div>
      </header>

      <div className="content-area">
        {loading ? <p className="dashboard-data-status">Loading case data…</p> : null}
        {error ? (
          <p className="dashboard-data-status dashboard-data-status--error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <div className="muni-dash muni-dash--map-only">
            <section className="muni-dash-time" aria-label="Map time and disease filters">
              <div className="muni-dash-time-copy">
                <h3>Map period</h3>
                <p className="muni-dash-period-caption">{periodCaption}</p>
                <p className="muni-dash-raw-note">
                  Fixed 4-week window · raw case counts by barangay until population data is available.
                </p>
              </div>
              <div className="muni-dash-time-controls">
                <label className="muni-dash-control">
                  <span>Disease</span>
                  <select
                    value={diseaseFilter}
                    onChange={(e) => handleDiseaseChange(e.target.value)}
                    aria-busy={isFilterPending}
                  >
                    {DISEASE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="muni-dash-control">
                  <span>Map metric</span>
                  <select value={mapMetric} onChange={(e) => handleMapMetricChange(e.target.value)}>
                    <option value="count">Rolling count</option>
                    <option value="velocity">Velocity (Δ)</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="muni-dash-map-section muni-dash-map-section--primary" aria-labelledby="muni-map-title">
              <div className="muni-dash-map-head">
                <div>
                  <h3 id="muni-map-title">Barangay surveillance map</h3>
                  <p className="muni-dash-risers-sub">
                    Bubble size reflects case volume · color reflects{" "}
                    {mapMetric === "velocity" ? "change (Δ)" : "rolling count"} · click a barangay for details
                  </p>
                </div>
              </div>

              <div className="muni-dash-map-layout muni-dash-map-layout--wide">
                <MunicipalBarangayMap
                  rows={velocityRows}
                  municipalityName={municipalityName}
                  mapMetric={mapMetric}
                  selectedBarangayKey={selectedBarangayKey}
                  onSelectBarangay={(key) =>
                    setSelectedBarangayKey((prev) => (prev === key ? null : key))
                  }
                />
                {selectedRow ? (
                  <aside className="muni-barangay-panel" aria-label="Selected barangay details">
                    <button
                      type="button"
                      className="muni-barangay-panel-close"
                      onClick={() => setSelectedBarangayKey(null)}
                      aria-label="Close barangay details"
                    >
                      ×
                    </button>
                    <h4>{selectedRow.barangay}</h4>
                    <dl className="muni-barangay-panel-dl">
                      <dt>Current period</dt>
                      <dd>{selectedRow.current} cases</dd>
                      <dt>Prior period</dt>
                      <dd>{selectedRow.prior} cases</dd>
                      <dt>Change</dt>
                      <dd className={deltaClass(selectedRow.delta)}>
                        {selectedRow.delta > 0 ? "+" : ""}
                        {selectedRow.delta} ({fmtPct(selectedRow.pctChange)})
                      </dd>
                      <dt>Disease filter</dt>
                      <dd>{selectedRow.disease}</dd>
                    </dl>
                    <p className="muni-barangay-panel-hint">
                      Click the bubble again or close to deselect. View trends on the Dashboard.
                    </p>
                  </aside>
                ) : (
                  <aside className="muni-barangay-panel muni-barangay-panel--empty">
                    <p>Select a barangay on the map to view period counts and percent change.</p>
                  </aside>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MunicipalSurveillanceMap;
