import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { useForecasts } from "@/hooks/useForecasts";

const DISEASE_COLORS = {
  DENGUE: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.85)" },
  ILI: { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.85)" },
  AWD: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.85)" }
};

const DISEASE_LABEL = {
  DENGUE: "Dengue",
  ILI: "Influenza-Like Illness",
  AWD: "Acute Watery Diarrhea"
};

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="muni-chart-tooltip" role="status">
      <div className="muni-chart-tooltip-label">{row.label}</div>
      <div className="muni-chart-tooltip-row">
        Predicted cases: {Number(row.predicted_cases ?? 0).toLocaleString()}
      </div>
      <div className="muni-chart-tooltip-row" style={{ opacity: 0.7 }}>
        Week starts {row.week_start}
      </div>
    </div>
  );
}

/**
 * 1–4 week LSTM forecast for the current MHO's municipality.
 * Hidden gracefully when the disease filter is ALL (LSTM is per-disease) or
 * when the ML service is offline.
 */
export default function MunicipalForecastCard({ diseaseFilter = "DENGUE" }) {
  const skip = String(diseaseFilter).toUpperCase() === "ALL";
  const { forecast, asOfWeek, loading, error, refetch } = useForecasts({
    disease: skip ? null : diseaseFilter,
    enabled: !skip
  });

  const chartData = useMemo(
    () =>
      (forecast ?? []).map((row) => ({
        ...row,
        label: `+${row.step}w`
      })),
    [forecast]
  );

  const total = chartData.reduce((sum, r) => sum + (Number(r.predicted_cases) || 0), 0);
  const peak = chartData.reduce((m, r) => Math.max(m, Number(r.predicted_cases) || 0), 0);
  const colors = DISEASE_COLORS[String(diseaseFilter).toUpperCase()] ?? DISEASE_COLORS.DENGUE;
  const niceDisease = DISEASE_LABEL[String(diseaseFilter).toUpperCase()] ?? diseaseFilter;

  if (skip) {
    return (
      <section className="muni-panel muni-forecast" aria-label="LSTM forecast">
        <header className="dash-panel-head muni-forecast-head">
          <div className="dash-panel-head-copy">
            <p className="muni-section-kicker">LSTM forecast · 4-week horizon</p>
            <h3>Outbreak forecast</h3>
            <p>Pick a single disease (Dengue, ILI, or AWD) to see its predicted weekly case counts.</p>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="muni-panel muni-forecast" aria-label="LSTM forecast">
      <header className="dash-panel-head dash-panel-head--split muni-forecast-head">
        <div className="dash-panel-head-copy">
          <p className="muni-section-kicker">LSTM forecast · 4-week horizon</p>
          <h3>{niceDisease} outlook</h3>
          {asOfWeek ? <p className="muni-forecast-asof">As of week of {asOfWeek}</p> : null}
        </div>
        <button
          type="button"
          className="muni-forecast-refresh"
          onClick={() => refetch()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error ? (
        <div className="muni-forecast-empty" role="alert">
          Forecast unavailable — {error.replace(/^Error:\s*/i, "")}.{" "}
          <span className="muni-forecast-empty-hint">
            Start the LSTM service: <code>uvicorn serve.main:app --port 5000</code>
          </span>
        </div>
      ) : loading && chartData.length === 0 ? (
        <div className="muni-forecast-empty">Loading forecast…</div>
      ) : chartData.length === 0 ? (
        <div className="muni-forecast-empty">
          No forecast yet. Train the {String(diseaseFilter).toUpperCase()} model with{" "}
          <code>python ml/train.py --disease {String(diseaseFilter).toUpperCase()}</code>.
        </div>
      ) : (
        <>
          <div className="muni-forecast-stats">
            <div className="muni-forecast-stat">
              <span className="muni-forecast-stat-label">Sum (4 weeks)</span>
              <span className="muni-forecast-stat-value">{total.toLocaleString()}</span>
            </div>
            <div className="muni-forecast-stat">
              <span className="muni-forecast-stat-label">Peak week</span>
              <span className="muni-forecast-stat-value">{peak.toLocaleString()}</span>
            </div>
            <div className="muni-forecast-stat">
              <span className="muni-forecast-stat-label">Horizon</span>
              <span className="muni-forecast-stat-value">+1 → +4 weeks</span>
            </div>
          </div>

          <div className="muni-forecast-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(15, 23, 42, 0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<ForecastTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
                <Bar dataKey="predicted_cases" radius={[6, 6, 0, 0]}>
                  {chartData.map((row) => (
                    <Cell key={row.step} fill={colors.fill} />
                  ))}
                  <LabelList
                    dataKey="predicted_cases"
                    position="top"
                    style={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="muni-forecast-table-wrap">
            <table className="muni-forecast-table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Week starting</th>
                <th scope="col">Predicted cases</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.step}>
                  <td>+{row.step} wk</td>
                  <td>{row.week_start}</td>
                  <td>{Number(row.predicted_cases ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
