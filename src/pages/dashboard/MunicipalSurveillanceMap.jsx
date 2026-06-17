import { useMemo, useState, useDeferredValue, startTransition } from "react";
import { Link } from "react-router-dom";
import { FaBell, FaMapMarkedAlt } from "react-icons/fa";

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
  { value: "DENGUE", label: "Dengue", buttonClass: "muni-disease-btn--dengue" },
  { value: "ILI", label: "Influenza-like illness", buttonClass: "muni-disease-btn--ili" },
  { value: "AWD", label: "Acute watery diarrhea", buttonClass: "muni-disease-btn--awd" },
  { value: "ALL", label: "All diseases", buttonClass: "muni-disease-btn--all" }
];

const METRIC_OPTIONS = [
  { value: "count", label: "Case count" },
  { value: "velocity", label: "Change (Δ)" }
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

function diseaseLabel(value) {
  return DISEASE_OPTIONS.find((o) => o.value === value)?.label ?? value;
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

  const mapSummary = useMemo(() => {
    const total = velocityRows.reduce((sum, row) => sum + (row.current || 0), 0);
    const active = velocityRows.filter((row) => row.current > 0).length;
    const hotspot = velocityRows.reduce(
      (best, row) => (!best || row.current > best.current ? row : best),
      null
    );
    return { total, active, hotspot, barangays: velocityRows.length };
  }, [velocityRows]);

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
          <div className={`muni-dash muni-dash--map-only${isFilterPending ? " muni-dash--pending" : ""}`}>
            <section className="muni-panel muni-map-filters" aria-label="Map time and disease filters">
              <div className="muni-dash-period-info">
                <p className="muni-section-kicker">Surveillance window</p>
                <h3 className="muni-dash-period-title">Last 4 weeks</h3>
                <p className="muni-dash-period-dates">{periodCaption}</p>
                <p className="muni-dash-period-note">
                  Raw case counts by barangay · population rates when census data is available
                </p>
              </div>

              <div className="muni-map-filter-groups">
                <div
                  className="muni-dash-disease-buttons"
                  role="group"
                  aria-label="Choose a disease to view"
                  aria-busy={isFilterPending}
                >
                  {DISEASE_OPTIONS.map((o) => {
                    const isActive = diseaseFilter === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        className={[
                          "muni-disease-btn",
                          o.buttonClass,
                          isActive ? "muni-disease-btn--active" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={isActive}
                        onClick={() => handleDiseaseChange(o.value)}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>

                <div className="muni-map-metric-toggle" role="group" aria-label="Map metric">
                  <span className="muni-map-metric-label">Display</span>
                  <div className="muni-map-metric-buttons">
                    {METRIC_OPTIONS.map((o) => {
                      const isActive = mapMetric === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          className={`muni-map-metric-btn${isActive ? " muni-map-metric-btn--active" : ""}`}
                          aria-pressed={isActive}
                          onClick={() => handleMapMetricChange(o.value)}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <div className="muni-map-summary" aria-label="Map summary statistics">
              <article className="muni-map-stat">
                <span className="muni-map-stat-label">Cases this period</span>
                <strong className="muni-map-stat-value">{mapSummary.total.toLocaleString()}</strong>
              </article>
              <article className="muni-map-stat">
                <span className="muni-map-stat-label">Barangays with cases</span>
                <strong className="muni-map-stat-value">
                  {mapSummary.active}
                  <span className="muni-map-stat-sub"> / {mapSummary.barangays}</span>
                </strong>
              </article>
              <article className="muni-map-stat muni-map-stat--hotspot">
                <span className="muni-map-stat-label">Highest activity</span>
                <strong className="muni-map-stat-value">
                  {mapSummary.hotspot?.barangay ?? "—"}
                  {mapSummary.hotspot ? (
                    <span className="muni-map-stat-sub"> · {mapSummary.hotspot.current} cases</span>
                  ) : null}
                </strong>
              </article>
            </div>

            <section className="muni-dash-map-section muni-dash-map-section--primary" aria-labelledby="muni-map-title">
              <div className="muni-dash-map-head">
                <span className="muni-section-badge muni-dash-map-badge">
                  {mapMetric === "velocity" ? "Velocity mode" : "Count mode"}
                </span>
                <div className="muni-dash-map-head-copy">
                  <p className="muni-section-kicker">Geographic view</p>
                  <h3 id="muni-map-title">Barangay surveillance map</h3>
                  <p className="muni-dash-risers-sub">
                    Bubble size reflects volume · color reflects{" "}
                    {mapMetric === "velocity" ? "period-over-period change" : "rolling case count"} ·
                    select a barangay for details
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
                  <aside className="muni-barangay-panel muni-barangay-panel--selected" aria-label="Selected barangay details">
                    <div className="muni-barangay-panel-head">
                      <div>
                        <p className="muni-section-kicker">Selected barangay</p>
                        <h4>{selectedRow.barangay}</h4>
                      </div>
                      <button
                        type="button"
                        className="muni-barangay-panel-close"
                        onClick={() => setSelectedBarangayKey(null)}
                        aria-label="Close barangay details"
                      >
                        ×
                      </button>
                    </div>

                    <div className="muni-barangay-panel-stats">
                      <div className="muni-barangay-stat">
                        <span>Current period</span>
                        <strong>{selectedRow.current}</strong>
                      </div>
                      <div className="muni-barangay-stat">
                        <span>Prior period</span>
                        <strong>{selectedRow.prior}</strong>
                      </div>
                      <div className={`muni-barangay-stat muni-barangay-stat--delta ${deltaClass(selectedRow.delta)}`}>
                        <span>Change</span>
                        <strong>
                          {selectedRow.delta > 0 ? "+" : ""}
                          {selectedRow.delta} ({fmtPct(selectedRow.pctChange)})
                        </strong>
                      </div>
                    </div>

                    <dl className="muni-barangay-panel-dl">
                      <dt>Disease filter</dt>
                      <dd>{diseaseLabel(selectedRow.disease)}</dd>
                      <dt>Reporting window</dt>
                      <dd>{periodCaption}</dd>
                    </dl>

                    <p className="muni-barangay-panel-hint">
                      Click the bubble again or close to deselect. View trends on the Dashboard.
                    </p>
                  </aside>
                ) : (
                  <aside className="muni-barangay-panel muni-barangay-panel--empty">
                    <FaMapMarkedAlt className="muni-barangay-panel-icon" aria-hidden />
                    <p className="muni-barangay-panel-empty-title">No barangay selected</p>
                    <p>Select a bubble on the map to inspect period counts and percent change.</p>
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
