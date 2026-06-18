import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="prov-chart-tooltip" role="status">
      <div className="prov-chart-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey}>
          {p.name}: {Number(p.value ?? 0).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function ProvincialProvinceTrend({
  provinceTrend = [],
  diseaseFilter = "DENGUE",
  hideTitle = false
}) {
  const showAll = diseaseFilter === "ALL";
  const series = useMemo(() => {
    if (showAll) {
      return [
        { key: "DENGUE", name: "Dengue", color: "#f59e0b", fill: "rgba(245, 158, 11, 0.2)" },
        { key: "ILI", name: "ILI", color: "#f43f5e", fill: "rgba(244, 63, 94, 0.18)" },
        { key: "AWD", name: "AWD", color: "#3b82f6", fill: "rgba(59, 130, 246, 0.18)" }
      ];
    }
    const key = String(diseaseFilter).toUpperCase();
    const colors = {
      DENGUE: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.25)" },
      ILI: { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.22)" },
      AWD: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.22)" }
    };
    const c = colors[key] ?? colors.DENGUE;
    return [{ key, name: key === "ILI" ? "ILI" : key === "AWD" ? "AWD" : "Dengue", color: c.stroke, fill: c.fill }];
  }, [showAll, diseaseFilter]);

  return (
    <section className={hideTitle ? "prov-trend-chart" : "prov-panel"} aria-labelledby="prov-trend-title">
      {hideTitle ? null : (
        <>
          <h3 id="prov-trend-title">Province-wide weekly trends</h3>
          <p className="prov-sub">Total confirmed cases · Davao de Oro</p>
        </>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={provinceTrend}>
          <CartesianGrid stroke="rgba(15, 23, 42, 0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} />
          <Tooltip content={<TrendTooltip />} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              fill={s.fill}
              strokeWidth={2}
              stackId={showAll ? "cases" : undefined}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
