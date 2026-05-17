import { useMemo, useState } from "react";
import { resolveMunicipalityCoords } from "@/lib/provincialSurveillance";

const SVG_W = 720;
const SVG_H = 420;
const PAD = 40;

function colorForValue(value, max, metric) {
  if (max <= 0 || value <= 0) return "rgba(148, 163, 184, 0.45)";
  const t = Math.min(1, Math.abs(value) / max);
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
    minLat -= 0.05;
    maxLat += 0.05;
  }
  if (minLon === maxLon) {
    minLon -= 0.05;
    maxLon += 0.05;
  }

  return withCoords.map((n) => {
    const metricVal = n.metricValue ?? 0;
    return {
      ...n,
      x: padding + ((n.lon - minLon) / (maxLon - minLon)) * (width - padding * 2),
      y: padding + (1 - (n.lat - minLat) / (maxLat - minLat)) * (height - padding * 2),
      r: Math.max(12, Math.min(32, 10 + Math.sqrt(Math.max(0, Math.abs(metricVal))) * 5))
    };
  });
}

export default function ProvinceMunicipalityMap({
  municipalityRows = [],
  mapMetric = "velocity",
  selectedMunicipalityKey = null,
  onSelectMunicipality
}) {
  const [hoverKey, setHoverKey] = useState(null);

  const nodes = useMemo(() => {
    return municipalityRows
      .map((row) => {
        const coords = resolveMunicipalityCoords(row.municipality);
        if (!coords) return null;
        return {
          ...row,
          lat: coords.lat,
          lon: coords.lon,
          metricValue: mapMetric === "velocity" ? row.delta : row.current
        };
      })
      .filter(Boolean);
  }, [municipalityRows, mapMetric]);

  const projected = useMemo(() => projectNodes(nodes, SVG_W, SVG_H, PAD), [nodes]);
  const maxMetric = useMemo(
    () => Math.max(1, ...projected.map((n) => Math.abs(n.metricValue ?? 0))),
    [projected]
  );

  const hoverNode =
    projected.find((n) => n.municipalityKey === hoverKey) ??
    projected.find((n) => n.municipalityKey === selectedMunicipalityKey) ??
    null;

  if (!projected.length) {
    return <p className="prov-empty">No municipality coordinates available for mapping.</p>;
  }

  return (
    <div className="prov-map-wrap">
      <svg
        className="prov-map-svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label="Province municipality surveillance map"
      >
        <rect className="prov-map-bg" width={SVG_W} height={SVG_H} />
        {projected.map((node) => (
          <g
            key={node.municipalityKey}
            className={`prov-map-node${selectedMunicipalityKey === node.municipalityKey ? " is-active" : ""}`}
            onMouseEnter={() => setHoverKey(node.municipalityKey)}
            onMouseLeave={() => setHoverKey(null)}
            onClick={() => onSelectMunicipality?.(node.municipalityKey, node.municipality)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectMunicipality?.(node.municipalityKey, node.municipality);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${node.municipality}, ${node.current} cases`}
          >
            <circle
              className="prov-map-bubble"
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={colorForValue(node.metricValue, maxMetric, mapMetric)}
            />
            <text className="prov-map-label" x={node.x} y={node.y + node.r + 12} textAnchor="middle">
              {node.municipality.length > 12 ? `${node.municipality.slice(0, 10)}…` : node.municipality}
            </text>
          </g>
        ))}
      </svg>
      {hoverNode ? (
        <div className="prov-map-tooltip" role="status">
          <strong>{hoverNode.municipality}</strong>
          <div>
            Current: {hoverNode.current} · Prior: {hoverNode.prior} · Δ {hoverNode.delta > 0 ? `+${hoverNode.delta}` : hoverNode.delta}
          </div>
        </div>
      ) : null}
      <div className="prov-map-legend">
        <span>Low</span>
        <span className="prov-map-legend-bar" />
        <span>High {mapMetric === "velocity" ? "velocity" : "count"}</span>
      </div>
    </div>
  );
}
