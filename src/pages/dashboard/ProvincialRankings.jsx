import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import ProvincialVelocityTable from "@/components/provincial/ProvincialVelocityTable";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

function exportCsv(rows, mode) {
  const headers =
    mode === "barangay"
      ? ["rank", "municipality", "barangay", "current", "prior", "delta", "pctChange"]
      : ["rank", "municipality", "current", "prior", "delta", "pctChange"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const cells =
        mode === "barangay"
          ? [r.rank, r.municipality, r.barangay, r.current, r.prior, r.delta, r.pctChange?.toFixed?.(1) ?? r.pctChange]
          : [r.rank, r.municipality, r.current, r.prior, r.delta, r.pctChange?.toFixed?.(1) ?? r.pctChange];
      return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
    })
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alerto-province-${mode}-rankings.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProvincialRankings() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    windows,
    periodCaption,
    municipalities,
    municipalityRows,
    barangayRows,
    topBarangaysHeadline
  } = useProvincialSurveillance();

  return (
    <ProvincialPageShell
      title="Fastest rising rankings"
      subline="Province-wide velocity by municipality or barangay"
      lastSyncedAt={lastSyncedAt}
      loading={loading}
    >
      {loading ? <p className="prov-status">Loading…</p> : null}
      {error ? <p className="prov-status prov-status--error">{error}</p> : null}

      {!loading && !error ? (
        <div className="prov-dash">
          <ProvincialFilters
            filters={filters}
            patchFilters={patchFilters}
            periodCaption={periodCaption}
            windows={windows}
            municipalities={municipalities}
            showGeoToggle
            showMunicipalityFilter
          />

          <section className="prov-panel prov-headline" aria-live="polite">
            <h3>
              Top {topBarangaysHeadline.top.length} barangays rising fastest for{" "}
              {topBarangaysHeadline.label} · last {topBarangaysHeadline.windowWeeks} weeks (
              {topBarangaysHeadline.scope})
            </h3>
            <ol className="prov-top-list">
              {topBarangaysHeadline.top.map((r) => (
                <li key={r.barangayKey}>
                  <strong>{r.barangay}</strong>, {r.municipality} — {r.current} cases (Δ{" "}
                  {r.delta > 0 ? `+${r.delta}` : r.delta})
                </li>
              ))}
            </ol>
          </section>

          <section className="prov-panel" aria-labelledby="prov-table-a-title">
            <h3 id="prov-table-a-title">
              Table A — Municipalities by velocity ({filters.diseaseFilter})
            </h3>
            <ProvincialVelocityTable
              rows={municipalityRows}
              mode="municipality"
              onExport={() => exportCsv(municipalityRows, "municipality")}
            />
          </section>

          <section className="prov-panel" aria-labelledby="prov-table-b-title">
            <h3 id="prov-table-b-title">
              Table B — Barangays {filters.municipalityFilter ? `in ${filters.municipalityFilter}` : "province-wide"}
            </h3>
            <ProvincialVelocityTable
              rows={barangayRows}
              mode="barangay"
              onExport={() => exportCsv(barangayRows, "barangay")}
            />
          </section>

          {filters.geoView === "municipality" ? (
            <section className="prov-panel" aria-label="Primary ranking view">
              <p className="prov-note">
                Switch to <strong>By barangay</strong> above for province-wide barangay rankings (237 areas).
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
