import { useMemo, useState } from "react";
import { resolveBarangayCoords } from "@/data/barangayCoords";

const SVG_W = 640;
const SVG_H = 380;
const PAD = 36;

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function colorForValue(value, max, metric) {
  if (max <= 0 || value <= 0) return "rgba(148, 163, 184, 0.45)";
  const t = Math.min(1, value / max);
  if (metric === "velocity") {
    if (value < 0) return `rgba(22, 163, 74, ${0.35 + t * 0.45})`;
    return `rgba(220, 38, 38, ${0.25 + t * 0.65})`;
  }
  const r = Math.round(59 + t * 180);
  const g = Math.round(130 - t * 90);
  const b = Math.round(246 - t * 170);
  return `rgb(${r}, ${g}, ${b})`;
}

function projectNodes(nodes, width, height, padding) {
  const withCoords = nodes.filter((n) => n.lat != null && n.lon != null);
  if (!withCoords.length) return [];

  const lats = withCoords.map((n) => n.lat);
  const lons = withCoords.map((n) => n.lon);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  if (minLat === maxLat) {
    minLat -= 0.02;
    maxLat += 0.02;
  }
  if (minLon === maxLon) {
    minLon -= 0.02;
    maxLon += 0.02;
  }

  return withCoords.map((n) => {
    const metricVal = n.metricValue ?? 0;
    return {
      ...n,
      x: padding + ((n.lon - minLon) / (maxLon - minLon)) * (width - padding * 2),
      y: padding + (1 - (n.lat - minLat) / (maxLat - minLat)) * (height - padding * 2),
      r: Math.max(7, Math.min(26, 6 + Math.sqrt(Math.max(0, metricVal)) * 4))
    };
  });
}

/**
 * Bubble map of barangay centroids — color/size reflect count or velocity.
 */
export default function MunicipalBarangayMap({
  rows = [],
  municipalityName = "",
  mapMetric = "count",
  selectedBarangayKey = null,
  onSelectBarangay
}) {
  const [hoverKey, setHoverKey] = useState(null);

  const nodes = useMemo(() => {
    return rows
      .map((row) => {
        const coords = resolveBarangayCoords(municipalityName, row.barangay);
        if (!coords) return null;
        const metricValue = mapMetric === "velocity" ? row.delta : row.current;
        return {
          ...row,
          lat: coords.lat,
          lon: coords.lon,
          metricValue
        };
      })
      .filter(Boolean);
  }, [rows, municipalityName, mapMetric]);

  const projected = useMemo(
    () => projectNodes(nodes, SVG_W, SVG_H, PAD),
    [nodes]
  );

  const maxMetric = useMemo(
    () => Math.max(1, ...projected.map((n) => Math.abs(n.metricValue ?? 0))),
    [projected]
  );

  const hoverNode =
    projected.find((n) => n.barangayKey === hoverKey) ??
    projected.find((n) => n.barangayKey === selectedBarangayKey) ??
    null;

  if (!projected.length) {
    return (
      <p className="muni-map-empty">
        No coordinates available for barangays in {municipalityName || "this municipality"}.
      </p>
    );
  }

  return (
    <div className="muni-map-wrap">
      <svg
        className="muni-map-svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label={`Barangay case map for ${municipalityName}`}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} className="muni-map-bg" rx={12} />
        {projected.map((node) => {
          const active =
            node.barangayKey === selectedBarangayKey || node.barangayKey === hoverKey;
          const fill = colorForValue(
            mapMetric === "velocity" ? node.delta : node.current,
            maxMetric,
            mapMetric
          );
          return (
            <g
              key={node.barangayKey}
              className={`muni-map-node${active ? " is-active" : ""}`}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoverKey(node.barangayKey)}
              onMouseLeave={() => setHoverKey(null)}
              onClick={() => onSelectBarangay?.(node.barangayKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectBarangay?.(node.barangayKey);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${node.barangay}, ${node.current} cases, ${fmtPct(node.pctChange)} change`}
            >
              <circle r={node.r} fill={fill} className="muni-map-bubble" />
              {active ? <circle r={node.r + 4} className="muni-map-ring" fill="none" /> : null}
              <text y={node.r + 14} textAnchor="middle" className="muni-map-label">
                {node.barangay.length > 14 ? `${node.barangay.slice(0, 12)}…` : node.barangay}
              </text>
            </g>
          );
        })}
      </svg>

      {hoverNode ? (
        <div className="muni-map-tooltip" role="status">
          <strong>{hoverNode.barangay}</strong>
          <span>
            Count: {hoverNode.current} · Prior: {hoverNode.prior} · Δ {hoverNode.delta > 0 ? "+" : ""}
            {hoverNode.delta} ({fmtPct(hoverNode.pctChange)})
          </span>
        </div>
      ) : null}

      <div className="muni-map-legend" aria-hidden="true">
        <span className="muni-map-legend-low">Low</span>
        <span className="muni-map-legend-bar" />
        <span className="muni-map-legend-high">
          {mapMetric === "velocity" ? "Rising" : "High count"}
        </span>
      </div>
    </div>
  );
}
