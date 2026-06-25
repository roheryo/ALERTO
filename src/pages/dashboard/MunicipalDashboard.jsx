import { useMemo, useState, useDeferredValue, startTransition } from "react";
import { Link } from "react-router-dom";

import AlertSeverityBadge from "@/components/alerts/AlertSeverityBadge";
import MunicipalForecastCard from "@/components/dashboard/MunicipalForecastCard";
import MunicipalTrendCharts from "@/components/dashboard/MunicipalTrendCharts";
import MunicipalWeatherContext from "@/components/dashboard/MunicipalWeatherContext";
import { useAlerts } from "@/hooks/useAlerts";
import { formatAlertToken } from "@/lib/alertListDisplay";
import { barangaysForMunicipality } from "@/data/davaoDeOroGeography";
import {
  buildSurveillanceIndex,
  computeAllDiseaseKpis,
  computeBarangayVelocityRows,
  computeMunicipalityWeeklyTrend,
  formatDeltaLabel,
  formatWindowLabel,
  resolveSurveillanceWindows
} from "@/lib/surveillance";
import "./MunicipalDashboard.css";

const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue", buttonClass: "muni-disease-btn--dengue" },
  { value: "ILI", label: "Influenza-like Illness", buttonClass: "muni-disease-btn--ili" },
  { value: "AWD", label: "Acute Watery Diarrhea", buttonClass: "muni-disease-btn--awd" },
  { value: "ALL", label: "All diseases", buttonClass: "muni-disease-btn--all" }
];

const DISEASE_LABEL = {
  DENGUE: "Dengue",
  ILI: "Influenza-like Illness",
  AWD: "Acute Watery Diarrhea"
};

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

function formatRelativeTime(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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

function HeroKpiCard({ total, windowLabel, totalDelta }) {
  return (
    <article className="summary-card summary-card--hero muni-kpi-card">
      <h4>Total confirmed cases</h4>
      <h2>{total.toLocaleString()}</h2>
      <p className="muni-kpi-window">{windowLabel}</p>
      <span className="summary-card-delta-pill">{formatDeltaLabel(totalDelta)}</span>
    </article>
  );
}

function AlertPreviewItem({ alert }) {
  const diseaseLabel = DISEASE_LABEL[alert.disease] ?? alert.disease;
  const severityKey = String(alert.severity ?? "").toLowerCase();
  return (
    <li className={`muni-alert-preview-item muni-alert-preview-item--${severityKey}`}>
      <span className="muni-alert-preview-dot" aria-hidden="true" />
      <div className="muni-alert-preview-body">
        <span className="muni-alert-preview-title">{diseaseLabel}</span>
        <span className="muni-alert-preview-meta">
          {alert.barangay} · {formatAlertToken(alert.triggerType ?? "pattern")}
        </span>
      </div>
      <div className="muni-alert-preview-end">
        <span className="muni-alert-preview-time">{formatRelativeTime(alert.createdAt)}</span>
        <AlertSeverityBadge severity={alert.severity} />
      </div>
    </li>
  );
}

/** Municipal Health Office dashboard — surveillance, trends, and forecast. */
function MunicipalDashboard({ patients = [], municipalityName = "", weather = null }) {
  const [diseaseFilter, setDiseaseFilter] = useState("DENGUE");
  const deferredDiseaseFilter = useDeferredValue(diseaseFilter);
  const isFilterPending = deferredDiseaseFilter !== diseaseFilter;
  const [sortKey, setSortKey] = useState("delta");
  const [sortDir, setSortDir] = useState("desc");

  const { alerts, summary: alertSummary } = useAlerts({ status: "active" });
  const topAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);

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

  const totalCases = kpis.awd.windowCount + kpis.ili.windowCount + kpis.dengue.windowCount;
  const totalDelta = kpis.awd.wowDelta + kpis.ili.wowDelta + kpis.dengue.wowDelta;

  const velocityRows = useMemo(
    () =>
      computeBarangayVelocityRows(
        patients,
        barangayNames,
        FIXED_WINDOW_WEEKS,
        deferredDiseaseFilter,
        { ...timeOptions, windows, diseaseFilter: deferredDiseaseFilter }
      ),
    [patients, barangayNames, deferredDiseaseFilter, timeOptions, windows]
  );

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

  const trendPctBadge = useMemo(() => {
    if (!municipalityTrend.length) return null;
    const key =
      deferredDiseaseFilter === "ALL"
        ? null
        : String(deferredDiseaseFilter).toUpperCase();
    const mid = Math.floor(municipalityTrend.length / 2);
    const prior = municipalityTrend.slice(0, mid);
    const current = municipalityTrend.slice(mid);
    const sumSlice = (rows, k) =>
      rows.reduce((s, r) => {
        if (k) return s + (Number(r[k]) || 0);
        return s + (Number(r.DENGUE) || 0) + (Number(r.ILI) || 0) + (Number(r.AWD) || 0);
      }, 0);
    const priorSum = sumSlice(prior, key);
    const currentSum = sumSlice(current, key);
    if (priorSum === 0) return currentSum > 0 ? "+100%" : null;
    const pct = ((currentSum - priorSum) / priorSum) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% vs prior period`;
  }, [municipalityTrend, deferredDiseaseFilter]);

  const showDiseaseColumn = deferredDiseaseFilter === "ALL";

  function handleDiseaseChange(nextValue) {
    startTransition(() => {
      setDiseaseFilter(nextValue);
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

  return (
    <div className={`muni-dash muni-dash-grid${isFilterPending ? " muni-dash--pending" : ""}`}>
      <section className="muni-dash-row-kpis card-container muni-dash-kpis" aria-label="Disease summary">
        <HeroKpiCard
          total={totalCases}
          windowLabel={kpis.awd.windowLabel}
          totalDelta={totalDelta}
        />
        <KpiCard title="Acute Watery Diarrhea" kpi={kpis.awd} variant="blue" />
        <KpiCard title="Influenza-Like-Illness" kpi={kpis.ili} variant="red" />
        <KpiCard title="Dengue" kpi={kpis.dengue} variant="orange" />
      </section>

      <section className="muni-dash-row-filters" aria-label="Time and disease filters">
        <div className="muni-dash-period-info">
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

      <div className="muni-dash-row-main">
        <section className="muni-panel muni-dash-trends-card" aria-label="Trend charts">
          <header className="dash-panel-head">
            <div className="dash-panel-head-copy">
              <h3>Case trends</h3>
              <p>Confirmed cases over the last {TREND_WEEKS} weeks</p>
            </div>
            {trendPctBadge ? (
              <span
                className={`dash-panel-badge${trendPctBadge.startsWith("+") ? " dash-panel-badge--up" : ""}`}
              >
                {trendPctBadge}
              </span>
            ) : null}
          </header>
          <MunicipalTrendCharts municipalityTrend={municipalityTrend} diseaseFilter={deferredDiseaseFilter} />
        </section>

        <div className="muni-dash-side-stack">
          <MunicipalWeatherContext weather={weather} municipalityName={municipalityName} />
        </div>
      </div>

      <div className="muni-dash-row-bottom">
        <section className="muni-panel muni-dash-risers" aria-labelledby="muni-risers-title">
          <header className="dash-panel-head dash-panel-head--split">
            <div className="dash-panel-head-copy">
              <h3 id="muni-risers-title">Barangay velocity</h3>
              <p>Case change ranking by barangay</p>
            </div>
            <Link className="dash-panel-link" to="/dashboard/surveillance-map">
              View surveillance map →
            </Link>
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
                    <tr key={row.barangayKey} className={row.delta > 0 ? "muni-row--rising" : ""}>
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

        <div className="muni-dash-side-stack">
          <section className="muni-panel muni-alert-preview" aria-label="Priority alerts">
            <header className="dash-panel-head dash-panel-head--split">
              <div className="dash-panel-head-copy">
                <h3>Priority alerts</h3>
              </div>
              <span className="dash-panel-live">
                <span className="dash-panel-live-dot" aria-hidden="true" />
                {alertSummary.active} active
              </span>
            </header>
            {topAlerts.length === 0 ? (
              <p className="muni-empty-state">No active alerts</p>
            ) : (
              <ul className="muni-alert-preview-list">
                {topAlerts.map((alert) => (
                  <AlertPreviewItem key={alert.id} alert={alert} />
                ))}
              </ul>
            )}
            <Link className="dash-panel-link dash-panel-link--block" to="/dashboard/alerts">
              View all alerts →
            </Link>
          </section>

          <MunicipalForecastCard diseaseFilter={deferredDiseaseFilter} />
        </div>
      </div>
    </div>
  );
}

export default MunicipalDashboard;
