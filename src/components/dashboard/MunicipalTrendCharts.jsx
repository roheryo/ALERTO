import { memo, useMemo } from "react";
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
    <div className="muni-chart-tooltip" role="status">
      <div className="muni-chart-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="muni-chart-tooltip-row">
          {p.name}: {Number(p.value ?? 0).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

/** Municipality-wide weekly trend (disease filter applied). */
function MunicipalTrendCharts({ municipalityTrend = [], diseaseFilter = "DENGUE" }) {
  const showAllDiseases = diseaseFilter === "ALL";

  const chartSeries = useMemo(() => {
    if (showAllDiseases) {
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
  }, [showAllDiseases, diseaseFilter]);

  return (
    <div className="muni-trends">
      <section className="muni-trends-main" aria-labelledby="muni-trend-muni-title">
        <h3 id="muni-trend-muni-title">Municipality trends</h3>
        <p className="muni-trends-sub">Weekly confirmed cases · raw counts (no population adjustment)</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={municipalityTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(15, 23, 42, 0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<TrendTooltip />} />
            {chartSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={s.fill}
                strokeWidth={2}
                stackId={showAllDiseases ? "cases" : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

export default memo(MunicipalTrendCharts);
