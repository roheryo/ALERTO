import { useMemo } from "react";
import Chart from "react-apexcharts";

import {
  filterConfirmedPatients,
  getLastFourWeekBuckets,
  normalizeDisease,
  syntheticWeeklyFromTotals,
  weeklyDiseaseCounts
} from "../../lib/disease";
import "./BarangayDashboard.css";

function countByDisease(patients) {
  let dengue = 0;
  let ili = 0;
  let awd = 0;
  if (!Array.isArray(patients)) return { dengue, ili, awd };
  for (const p of patients) {
    const d = normalizeDisease(p?.diseaseType);
    if (d === "DENGUE") dengue += 1;
    else if (d === "ILI") ili += 1;
    else if (d === "AWD") awd += 1;
  }
  return { dengue, ili, awd };
}

/**
 * Barangay-scoped dashboard: KPI totals and 4-week disease trend.
 * Only confirmed cases are counted (Suspect/Probable excluded for surveillance accuracy).
 */
function BarangayDashboard({ patients = [], barangayName = "", municipalityName = "" }) {
  const confirmedPatients = useMemo(() => filterConfirmedPatients(patients), [patients]);
  const kpis = useMemo(() => countByDisease(confirmedPatients), [confirmedPatients]);

  const weekBuckets = useMemo(() => getLastFourWeekBuckets(), []);
  const weekLabels = useMemo(() => weekBuckets.map((b) => b.label), [weekBuckets]);

  const weeklySeries = useMemo(() => {
    const dated = weeklyDiseaseCounts(confirmedPatients, weekBuckets);
    const hasDated =
      dated.dengue.some((n) => n > 0) ||
      dated.ili.some((n) => n > 0) ||
      dated.awd.some((n) => n > 0);
    if (hasDated) return dated;
    return syntheticWeeklyFromTotals(kpis.dengue, kpis.ili, kpis.awd, weekBuckets.length);
  }, [confirmedPatients, weekBuckets, kpis.dengue, kpis.ili, kpis.awd]);

  const chartSeries = useMemo(
    () => [
      { name: "Dengue", data: weeklySeries.dengue },
      { name: "ILI", data: weeklySeries.ili },
      { name: "AWD", data: weeklySeries.awd }
    ],
    [weeklySeries]
  );

  const chartOptions = useMemo(
    () => ({
      chart: {
        type: "area",
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        animations: { enabled: true, speed: 450 }
      },
      stroke: {
        curve: "smooth",
        width: 2
      },
      dataLabels: { enabled: false },
      grid: {
        show: false,
        padding: { top: 12, right: 12, bottom: 8, left: 8 }
      },
      xaxis: {
        categories: weekLabels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: {
            colors: "#64748b",
            fontWeight: 600,
            fontSize: "12px"
          }
        }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: {
            colors: "#64748b",
            fontWeight: 600,
            fontSize: "12px"
          },
          formatter: (val) => (Number.isFinite(val) ? String(Math.round(val)) : "0")
        }
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: "light",
        x: { show: true },
        y: {
          formatter: (val) => {
            const n = Number(val);
            return `${Number.isFinite(n) ? n : 0} case${n === 1 ? "" : "s"}`;
          }
        }
      },
      legend: {
        position: "top",
        horizontalAlign: "end",
        fontWeight: 600,
        fontSize: "13px",
        markers: { width: 10, height: 10, radius: 10 }
      },
      colors: ["#d97706", "#e11d48", "#2563eb"],
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.45,
          opacityFrom: 0.38,
          opacityTo: 0.02,
          stops: [0, 92, 100]
        }
      },
      markers: {
        size: 0,
        hover: { size: 5, sizeOffset: 1 }
      }
    }),
    [weekLabels]
  );

  const scopeLine = [municipalityName, barangayName].filter(Boolean).join(" · ");

  return (
    <section className="barangay-dash" aria-labelledby="barangay-dash-title">
      <div className="barangay-dash-intro">
        <h2 id="barangay-dash-title" className="barangay-dash-title">
          Barangay overview
        </h2>
        {scopeLine ? (
          <p className="barangay-dash-scope">
            {scopeLine} · Confirmed cases only
          </p>
        ) : (
          <p className="barangay-dash-scope">Confirmed cases only · real-time surveillance</p>
        )}
      </div>

      <div className="barangay-dash-kpis" role="list">
        <article className="barangay-kpi barangay-kpi--dengue" role="listitem">
          <p className="barangay-kpi-label">Dengue</p>
          <p className="barangay-kpi-value">{kpis.dengue.toLocaleString()}</p>
          <p className="barangay-kpi-hint">Confirmed cases</p>
        </article>
        <article className="barangay-kpi barangay-kpi--ili" role="listitem">
          <p className="barangay-kpi-label">ILI</p>
          <p className="barangay-kpi-value">{kpis.ili.toLocaleString()}</p>
          <p className="barangay-kpi-hint">Confirmed cases</p>
        </article>
        <article className="barangay-kpi barangay-kpi--awd" role="listitem">
          <p className="barangay-kpi-label">AWD</p>
          <p className="barangay-kpi-value">{kpis.awd.toLocaleString()}</p>
          <p className="barangay-kpi-hint">Confirmed cases</p>
        </article>
      </div>

      <div className="barangay-dash-chart-wrap">
        <div className="barangay-dash-chart-head">
          <h3 className="barangay-dash-chart-title">Weekly case trend</h3>
          <p className="barangay-dash-chart-sub">Last four weeks · confirmed cases only</p>
        </div>
        <div className="barangay-dash-chart" role="img" aria-label="Weekly case trend chart">
          <Chart options={chartOptions} series={chartSeries} type="area" height={320} />
        </div>
      </div>
    </section>
  );
}

export default BarangayDashboard;
