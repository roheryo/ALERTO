import { useMemo, useState, useDeferredValue, startTransition } from "react";

import MunicipalDeclarationWorkspace from "@/components/dashboard/MunicipalDeclarationWorkspace";
import MunicipalForecastCard from "@/components/dashboard/MunicipalForecastCard";
import MunicipalTrendCharts from "@/components/dashboard/MunicipalTrendCharts";
import MunicipalWeatherContext from "@/components/dashboard/MunicipalWeatherContext";
import { barangaysForMunicipality } from "@/data/davaoDeOroGeography";
import {
  buildSurveillanceIndex,
  computeAllDiseaseKpis,
  computeBarangayVelocityRows,
  computeBarangayWeeklyTrend,
  computeMunicipalityWeeklyTrend,
  formatDeltaLabel,
  formatPeriodCaption,
  resolveSurveillanceWindows
} from "@/lib/surveillance";
import "./MunicipalDashboard.css";

const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "ILI" },
  { value: "AWD", label: "AWD" },
  { value: "ALL", label: "All diseases" }
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
    () =>
      formatPeriodCaption(windows, {
        windowMode: "weeks",
        windowWeeks: FIXED_WINDOW_WEEKS,
        periodOffset: 0
      }),
    [windows]
  );

  const kpis = useMemo(
    () => computeAllDiseaseKpis(patients, FIXED_WINDOW_WEEKS, { ...timeOptions, windows }),
    [patients, timeOptions, windows]
  );

  const velocityRows = useMemo(
    () =>
      computeBarangayVelocityRows(patients, barangayNames, FIXED_WINDOW_WEEKS, deferredDiseaseFilter, {
        ...timeOptions,
        windows,
        diseaseFilter: deferredDiseaseFilter
      }),
    [patients, barangayNames, deferredDiseaseFilter, timeOptions, windows]
  );

  const selectedRow = useMemo(
    () => velocityRows.find((r) => r.barangayKey === selectedBarangayKey) ?? null,
    [velocityRows, selectedBarangayKey]
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
      <MunicipalWeatherContext weather={weather} municipalityName={municipalityName} />

      <section className="muni-panel muni-dash-time" aria-label="Time and disease filters">
        <header className="muni-section-head muni-section-head--stacked">
          <div className="muni-dash-time-copy">
            <p className="muni-section-kicker">Filters</p>
            <h3>Surveillance period</h3>
            <p className="muni-dash-period-caption">{periodCaption}</p>
            <p className="muni-dash-raw-note">
              Fixed 4-week window · raw case counts until barangay population data is available.
            </p>
          </div>
        </header>
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
        </div>
      </section>

      <section className="card-container muni-dash-kpis" aria-label="Disease summary">
        <KpiCard title="Acute Watery Diarrhea" kpi={kpis.awd} variant="blue" />
        <KpiCard title="Influenza-Like-Illness" kpi={kpis.ili} variant="red" />
        <KpiCard title="Dengue" kpi={kpis.dengue} variant="orange" />
      </section>

      <MunicipalDeclarationWorkspace
        row={selectedRow}
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
        <header className="muni-section-head muni-section-head--compact">
          <div>
            <p className="muni-section-kicker">Barangay ranking</p>
            <h3 id="muni-risers-title">Velocity table</h3>
            <p className="muni-section-sub">
              Sortable counts and change · click a row to open the declaration workspace.
            </p>
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
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={showDiseaseColumn ? 7 : 6} className="muni-dash-table-empty">
                    No barangay data for this municipality.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.barangayKey}
                    className={[
                      row.delta > 0 ? "muni-row--rising" : "",
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
                    <td>{row.barangay}</td>
                    {showDiseaseColumn ? <td>{row.disease}</td> : null}
                    <td>{row.current}</td>
                    <td>{row.prior}</td>
                    <td className={deltaClass(row.delta)}>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                    <td className={deltaClass(row.delta)}>{fmtPct(row.pctChange)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MunicipalDashboard;
