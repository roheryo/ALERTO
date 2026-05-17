import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

/**
 * Declaration workspace — barangay case snapshot when selected from the velocity table.
 */
export default function MunicipalDeclarationWorkspace({
  row = null,
  weeklyTrend = [],
  diseaseFilter = "DENGUE",
  periodCaption = "",
  onClose
}) {
  if (!row) return null;

  return (
    <section className="muni-panel muni-declare" aria-labelledby="muni-declare-title">
      <header className="muni-declare-head">
        <div>
          <p className="muni-section-kicker">Meeting snapshot</p>
          <h3 id="muni-declare-title">Declaration workspace · {row.barangay}</h3>
          <p className="muni-section-sub">
            {periodCaption} · filter: {diseaseFilter}
          </p>
        </div>
        <button type="button" className="muni-declare-close" onClick={onClose} aria-label="Close workspace">
          ×
        </button>
      </header>

      <article className="muni-declare-card muni-declare-card--solo">
        <h4>Case trend</h4>
        <p className="muni-declare-stat">
          Current window: <strong>{row.current}</strong> · Prior: <strong>{row.prior}</strong> · Δ{" "}
          <strong>{row.delta > 0 ? `+${row.delta}` : row.delta}</strong>
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} width={24} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="muni-chart-tooltip muni-chart-tooltip--compact" role="status">
                    <div className="muni-chart-tooltip-label">{label}</div>
                    <div>{Number(payload[0]?.value ?? 0)} cases</div>
                  </div>
                ) : null
              }
            />
            <Line type="monotone" dataKey="cases" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="muni-declare-note muni-declare-note--muted">
          Environmental context is shown above. Use Surveillance Map for geographic distribution.
        </p>
      </article>
    </section>
  );
}
