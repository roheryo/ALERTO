import { useMemo, useState } from "react";

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function deltaClass(delta) {
  if (delta > 0) return "prov-delta--up";
  if (delta < 0) return "prov-delta--down";
  return "prov-delta--flat";
}

const DEFAULT_LABELS = {
  current: "Current",
  prior: "Prior",
  delta: "Δ",
  pctChange: "% change",
  empty: "No data for this filter."
};

const PLAIN_LABELS = {
  current: "Recent cases",
  prior: "Previous period",
  delta: "Change",
  pctChange: "Percent change",
  empty: "No cases match these filters."
};

export default function ProvincialVelocityTable({
  rows = [],
  mode = "municipality",
  onExport,
  onRowClick,
  plainLabels = false,
  showToolbar = true
}) {
  const labels = plainLabels ? PLAIN_LABELS : DEFAULT_LABELS;
  const [sortKey, setSortKey] = useState("delta");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    const list = [...rows];
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
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "barangay" || key === "municipality" ? "asc" : "desc");
    }
  }

  function indicator(key) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="prov-table-wrap">
      {showToolbar && onExport ? (
        <div className="prov-table-toolbar">
          <button type="button" className="prov-btn prov-btn--ghost" onClick={onExport}>
            Download CSV
          </button>
        </div>
      ) : null}
      <table className="prov-table">
        <thead>
          <tr>
            <th>
              <button type="button" className="prov-sort-btn" onClick={() => toggleSort("rank")}>
                Rank{indicator("rank")}
              </button>
            </th>
            {mode === "barangay" ? (
              <th>
                <button type="button" className="prov-sort-btn" onClick={() => toggleSort("municipality")}>
                  Municipality{indicator("municipality")}
                </button>
              </th>
            ) : null}
            <th>
              <button
                type="button"
                className="prov-sort-btn"
                onClick={() => toggleSort(mode === "barangay" ? "barangay" : "municipality")}
              >
                {mode === "barangay" ? "Barangay" : "Municipality"}
                {indicator(mode === "barangay" ? "barangay" : "municipality")}
              </button>
            </th>
            <th>
              <button type="button" className="prov-sort-btn" onClick={() => toggleSort("current")}>
                {labels.current}
                {indicator("current")}
              </button>
            </th>
            <th>
              <button type="button" className="prov-sort-btn" onClick={() => toggleSort("prior")}>
                {labels.prior}
                {indicator("prior")}
              </button>
            </th>
            <th>
              <button type="button" className="prov-sort-btn" onClick={() => toggleSort("delta")}>
                {labels.delta}
                {indicator("delta")}
              </button>
            </th>
            <th>
              <button type="button" className="prov-sort-btn" onClick={() => toggleSort("pctChange")}>
                {labels.pctChange}
                {indicator("pctChange")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={mode === "barangay" ? 7 : 6} className="prov-table-empty">
                {labels.empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={
                  row.barangayKey ??
                  row.municipalityKey ??
                  `${row.municipality ?? ""}-${row.barangay ?? ""}-${row.rank}`
                }
                className={row.delta > 0 ? "prov-row--rising" : ""}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
              >
                <td>{row.rank}</td>
                {mode === "barangay" ? <td>{row.municipality}</td> : null}
                <td>{mode === "barangay" ? row.barangay : row.municipality}</td>
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
  );
}
