import { useMemo, useState } from "react";
import { resolveBarangayCoords } from "@/data/barangayCoords";

const SVG_W = 720;
const SVG_H = 420;
const PAD = 44;

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
      r: Math.max(8, Math.min(28, 7 + Math.sqrt(Math.max(0, metricVal)) * 4))
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
      <div className="muni-map-empty-state">
        <p className="muni-map-empty-title">No map data</p>
        <p className="muni-map-empty">
          No coordinates available for barangays in {municipalityName || "this municipality"}.
        </p>
      </div>
    );
  }

  return (
    <div className="muni-map-wrap">
      <div className="muni-map-frame">
        <svg
          className="muni-map-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          role="img"
          aria-label={`Barangay case map for ${municipalityName}`}
        >
          <defs>
            <pattern id="muni-map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="rgba(100, 116, 139, 0.18)" />
            </pattern>
            <linearGradient id="muni-map-surface" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="55%" stopColor="#eef2ff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="muni-map-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
          </defs>

          <rect x={0} y={0} width={SVG_W} height={SVG_H} className="muni-map-bg" rx={14} fill="url(#muni-map-surface)" />
          <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={14} fill="url(#muni-map-grid)" opacity="0.85" />

          <text x={PAD} y={24} className="muni-map-watermark">
            {municipalityName || "Municipality"}
          </text>
          <text x={SVG_W - PAD} y={24} textAnchor="end" className="muni-map-watermark-sub">
            {projected.length} barangays
          </text>

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
                {active ? <circle r={node.r + 7} className="muni-map-halo" fill="none" /> : null}
                <circle
                  r={node.r}
                  fill={fill}
                  className="muni-map-bubble"
                  filter={active ? "url(#muni-map-shadow)" : undefined}
                />
                {active ? <circle r={node.r + 4} className="muni-map-ring" fill="none" /> : null}
                <text y={node.r + 15} textAnchor="middle" className="muni-map-label">
                  {node.barangay.length > 16 ? `${node.barangay.slice(0, 14)}…` : node.barangay}
                </text>
              </g>
            );
          })}
        </svg>

        {hoverNode ? (
          <div className="muni-map-tooltip" role="status">
            <p className="muni-map-tooltip-title">{hoverNode.barangay}</p>
            <div className="muni-map-tooltip-grid">
              <div>
                <span>Current</span>
                <strong>{hoverNode.current}</strong>
              </div>
              <div>
                <span>Prior</span>
                <strong>{hoverNode.prior}</strong>
              </div>
              <div>
                <span>Change</span>
                <strong>
                  {hoverNode.delta > 0 ? "+" : ""}
                  {hoverNode.delta} ({fmtPct(hoverNode.pctChange)})
                </strong>
              </div>
            </div>
          </div>
        ) : null}

        <div className="muni-map-legend-card" aria-hidden="true">
          <span className="muni-map-legend-title">
            {mapMetric === "velocity" ? "Period change" : "Case intensity"}
          </span>
          <div className="muni-map-legend-row">
            <span className="muni-map-legend-low">
              {mapMetric === "velocity" ? "Declining" : "Low"}
            </span>
            <span
              className={`muni-map-legend-bar${
                mapMetric === "velocity" ? " muni-map-legend-bar--velocity" : ""
              }`}
            />
            <span className="muni-map-legend-high">
              {mapMetric === "velocity" ? "Rising" : "High"}
            </span>
          </div>
          <span className="muni-map-legend-note">Bubble size = case volume</span>
        </div>
      </div>
    </div>
  );
}
