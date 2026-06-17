import { useEffect, useMemo, useState, useDeferredValue, startTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell } from "lucide-react";

import MunicipalDeclarationWorkspace from "@/components/dashboard/MunicipalDeclarationWorkspace";
import MunicipalForecastCard from "@/components/dashboard/MunicipalForecastCard";
import MunicipalTrendCharts from "@/components/dashboard/MunicipalTrendCharts";
import MunicipalWeatherContext from "@/components/dashboard/MunicipalWeatherContext";
import { barangaysForMunicipality } from "@/data/davaoDeOroGeography";
import { useAlerts } from "@/hooks/useAlerts";
import {
  buildSurveillanceIndex,
  computeAllDiseaseKpis,
  computeBarangayVelocityRows,
  computeBarangayWeeklyTrend,
  computeMunicipalityWeeklyTrend,
  formatDeltaLabel,
  formatWindowLabel,
  normalizePlaceKey,
  resolveSurveillanceWindows
} from "@/lib/surveillance";
import { computeRiskScore } from "@/lib/riskScoring";
import "./MunicipalDashboard.css";

const SEVERITY_RANK = { high: 3, elevated: 2, watch: 1 };
const SEVERITY_LABEL = { high: "High", elevated: "Elevated", watch: "Watch" };
const RISK_SEVERITY_CLASS = { high: "high", elevated: "elevated", watch: "watch", normal: "normal" };

const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue", buttonClass: "muni-disease-btn--dengue" },
  { value: "ILI", label: "Influenza-like Illness", buttonClass: "muni-disease-btn--ili" },
  { value: "AWD", label: "Acute Watery Diarrhea", buttonClass: "muni-disease-btn--awd" },
  { value: "ALL", label: "All diseases", buttonClass: "muni-disease-btn--all" }
];

const FIXED_WINDOW_WEEKS = 4;
const TREND_WEEKS = 8;

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

function KpiCard({ title, kpi, variant }) {
  return (
    <article className={`summary-card muni-kpi-card ${variant}`}>
      <h4>{title}</h4>
      <h2>{kpi.windowCount.toLocaleString()}</h2>
      <p className="muni-kpi-window">{kpi.windowLabel}</p>
      <p className={`muni-kpi-delta ${deltaClass(kpi.wowDelta)}`}>{formatDeltaLabel(kpi.wowDelta)}</p>
    </article>
  );
}

/**
 * Municipal Health Office dashboard — surveillance, trends, forecast, and
 * declaration support. Early-warning alerts have been retired pending a
 * rewrite.
 */
function MunicipalDashboard({ patients = [], municipalityName = "", weather = null }) {
  const [diseaseFilter, setDiseaseFilter] = useState("DENGUE");
  const deferredDiseaseFilter = useDeferredValue(diseaseFilter);
  const isFilterPending = deferredDiseaseFilter !== diseaseFilter;
  const [sortKey, setSortKey] = useState("delta");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedBarangayKey, setSelectedBarangayKey] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link from an alert ("Open declaration workspace"): preselect the
  // barangay + disease, then clear the params so later interaction is normal.
  useEffect(() => {
    const barangayParam = searchParams.get("barangay");
    const diseaseParam = searchParams.get("disease");
    if (!barangayParam && !diseaseParam) return;
    if (diseaseParam) {
      const upper = String(diseaseParam).toUpperCase();
      if (["DENGUE", "ILI", "AWD", "ALL"].includes(upper)) setDiseaseFilter(upper);
    }
    if (barangayParam) setSelectedBarangayKey(barangayParam);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const caseIndex = useMemo(() => buildSurveillanceIndex(patients), [patients]);

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
    () => formatWindowLabel(windows?.current),
    [windows]
  );

  const kpis = useMemo(
    () => computeAllDiseaseKpis(patients, FIXED_WINDOW_WEEKS, { ...timeOptions, windows }),
    [patients, timeOptions, windows]
  );

  // Map barangay name → id from the case list so the declaration workspace can
  // fetch a server decision brief for the selected barangay.
  const barangayIdByKey = useMemo(() => {
    const map = new Map();
    for (const p of patients) {
      const key = normalizePlaceKey(p?.barangay);
      if (key && p?.barangayId != null && !map.has(key)) map.set(key, p.barangayId);
    }
    return map;
  }, [patients]);

  const velocityRows = useMemo(() => {
    const rows = computeBarangayVelocityRows(
      patients,
      barangayNames,
      FIXED_WINDOW_WEEKS,
      deferredDiseaseFilter,
      { ...timeOptions, windows, diseaseFilter: deferredDiseaseFilter }
    );
    if (deferredDiseaseFilter === "ALL") {
      return rows.map((r) => ({ ...r, riskScore: null, riskSeverity: null }));
    }
    return rows.map((r) => {
      const risk = computeRiskScore({
        disease: deferredDiseaseFilter,
        current: r.current,
        prior: r.prior,
        delta: r.delta,
        pctChange: r.pctChange
      });
      return { ...r, riskScore: risk.score, riskSeverity: risk.severity };
    });
  }, [patients, barangayNames, deferredDiseaseFilter, timeOptions, windows]);

  const { alerts: activeAlerts, summary: alertSummary } = useAlerts({ status: "active" });

  // Highest active-alert severity per barangay, filtered to the selected disease
  // (or all diseases when the "ALL" filter is active) for table row indicators.
  const alertSeverityByBarangay = useMemo(() => {
    const map = new Map();
    for (const alert of activeAlerts) {
      if (deferredDiseaseFilter !== "ALL" && alert.disease !== deferredDiseaseFilter) continue;
      const key = normalizePlaceKey(alert.barangay);
      if (!key) continue;
      const current = map.get(key);
      if (!current || (SEVERITY_RANK[alert.severity] ?? 0) > (SEVERITY_RANK[current] ?? 0)) {
        map.set(key, alert.severity);
      }
    }
    return map;
  }, [activeAlerts, deferredDiseaseFilter]);

  const selectedRow = useMemo(
    () => velocityRows.find((r) => r.barangayKey === selectedBarangayKey) ?? null,
    [velocityRows, selectedBarangayKey]
  );

  const selectedBarangayId = useMemo(
    () => (selectedBarangayKey ? barangayIdByKey.get(selectedBarangayKey) ?? null : null),
    [selectedBarangayKey, barangayIdByKey]
  );

  const selectedWeeklyTrend = useMemo(() => {
    if (!selectedBarangayKey) return [];
    return computeBarangayWeeklyTrend(patients, selectedBarangayKey, TREND_WEEKS, {
      ...timeOptions,
      diseaseFilter: deferredDiseaseFilter
    });
  }, [selectedBarangayKey, patients, timeOptions, deferredDiseaseFilter]);

  const sortedRows = useMemo(() => {
    const list = [...velocityRows];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return dir * av.localeCompare(bv, "en", { sensitivity: "base" });
      }
      return dir * ((Number(av) || 0) - (Number(bv) || 0));
    });
    if (sortKey !== "rank") {
      return list.map((row, i) => ({ ...row, rank: i + 1 }));
    }
    return list;
  }, [velocityRows, sortKey, sortDir]);

  const municipalityTrend = useMemo(
    () =>
      computeMunicipalityWeeklyTrend(patients, TREND_WEEKS, {
        ...timeOptions,
        diseaseFilter: deferredDiseaseFilter
      }),
    [patients, timeOptions, deferredDiseaseFilter]
  );

  const showDiseaseColumn = deferredDiseaseFilter === "ALL";

  function handleDiseaseChange(nextValue) {
    startTransition(() => {
      setDiseaseFilter(nextValue);
      setSelectedBarangayKey(null);
    });
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "barangay" ? "asc" : "desc");
    }
  }

  function sortIndicator(key) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function handleSelectBarangay(key) {
    setSelectedBarangayKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className={`muni-dash${isFilterPending ? " muni-dash--pending" : ""}`}>
      {alertSummary.total > 0 ? (
        <Link
          to="/dashboard/notification"
          className={`muni-alert-banner${alertSummary.bySeverity.high > 0 ? " muni-alert-banner--high" : ""}`}
        >
          <Bell className="muni-alert-banner-icon" strokeWidth={2} aria-hidden="true" />
          <span className="muni-alert-banner-copy">
            <strong>
              {alertSummary.total} active early-warning alert
              {alertSummary.total === 1 ? "" : "s"}
            </strong>
            <span className="muni-alert-banner-breakdown">
              {alertSummary.bySeverity.high} high · {alertSummary.bySeverity.elevated} elevated ·{" "}
              {alertSummary.bySeverity.watch} watch
            </span>
          </span>
          <span className="muni-alert-banner-cta">View alerts →</span>
        </Link>
      ) : null}

      <MunicipalWeatherContext weather={weather} municipalityName={municipalityName} />

      <section className="card-container muni-dash-kpis" aria-label="Disease summary">
        <KpiCard title="Acute Watery Diarrhea" kpi={kpis.awd} variant="blue" />
        <KpiCard title="Influenza-Like-Illness" kpi={kpis.ili} variant="red" />
        <KpiCard title="Dengue" kpi={kpis.dengue} variant="orange" />
      </section>

      <section className="muni-panel muni-dash-time" aria-label="Time and disease filters">
        <div className="muni-dash-period-info">
          <p className="muni-section-kicker">Filters</p>
          <h3 className="muni-dash-period-title">Looking at the last month</h3>
          <p className="muni-dash-period-dates">{periodCaption}</p>
        </div>
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
      </section>

      <MunicipalDeclarationWorkspace
        row={selectedRow}
        barangayId={selectedBarangayId}
        weeklyTrend={selectedWeeklyTrend}
        diseaseFilter={deferredDiseaseFilter}
        periodCaption={periodCaption}
        onClose={() => setSelectedBarangayKey(null)}
      />

      <section className="muni-panel muni-dash-trends-card" aria-label="Trend charts">
        <MunicipalTrendCharts municipalityTrend={municipalityTrend} diseaseFilter={deferredDiseaseFilter} />
      </section>

      <MunicipalForecastCard diseaseFilter={deferredDiseaseFilter} />

      <section className="muni-panel muni-dash-risers" aria-labelledby="muni-risers-title">
        <header className="muni-section-head muni-section-head--compact muni-section-head--centered">
          <div className="muni-section-head-copy">
            <p className="muni-section-kicker">Barangay ranking</p>
            <h3 id="muni-risers-title">Velocity table</h3>
          </div>
        </header>

        <div className="muni-dash-table-wrap">
          <table className="muni-dash-table">
            <thead>
              <tr>
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("rank")}>
                    Rank{sortIndicator("rank")}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("barangay")}>
                    Barangay{sortIndicator("barangay")}
                  </button>
                </th>
                {showDiseaseColumn ? <th scope="col">Disease</th> : null}
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("current")}>
                    Current{sortIndicator("current")}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("prior")}>
                    Prior{sortIndicator("prior")}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("delta")}>
                    Δ{sortIndicator("delta")}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="muni-sort-btn" onClick={() => toggleSort("pctChange")}>
                    % change{sortIndicator("pctChange")}
                  </button>
                </th>
                {showDiseaseColumn ? null : (
                  <th scope="col">
                    <button type="button" className="muni-sort-btn" onClick={() => toggleSort("riskScore")}>
                      Risk{sortIndicator("riskScore")}
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muni-dash-table-empty">
                    No barangay data for this municipality.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const rowSeverity = alertSeverityByBarangay.get(row.barangayKey);
                  return (
                  <tr
                    key={row.barangayKey}
                    className={[
                      row.delta > 0 ? "muni-row--rising" : "",
                      rowSeverity ? `muni-row--alert-${rowSeverity}` : "",
                      selectedBarangayKey === row.barangayKey ? "muni-row--selected" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectBarangay(row.barangayKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectBarangay(row.barangayKey);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedBarangayKey === row.barangayKey}
                  >
                    <td>{row.rank}</td>
                    <td>
                      <span className="muni-row-barangay">
                        {row.barangay}
                        {rowSeverity ? (
                          <span
                            className={`muni-row-alert-tag muni-row-alert-tag--${rowSeverity}`}
                            title={`${SEVERITY_LABEL[rowSeverity]} early-warning alert`}
                          >
                            {SEVERITY_LABEL[rowSeverity]}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    {showDiseaseColumn ? <td>{row.disease}</td> : null}
                    <td>{row.current}</td>
                    <td>{row.prior}</td>
                    <td className={deltaClass(row.delta)}>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                    <td className={deltaClass(row.delta)}>{fmtPct(row.pctChange)}</td>
                    {showDiseaseColumn ? null : (
                      <td>
                        {row.riskScore != null ? (
                          <span className={`muni-risk-chip muni-risk-chip--${RISK_SEVERITY_CLASS[row.riskSeverity] ?? "normal"}`}>
                            {row.riskScore}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MunicipalDashboard;
