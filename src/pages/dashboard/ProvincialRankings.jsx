import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import ProvincialVelocityTable from "@/components/provincial/ProvincialVelocityTable";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

const DISEASE_LABELS = {
  DENGUE: "Dengue",
  ILI: "ILI",
  AWD: "AWD",
  ALL: "All diseases"
};

function diseaseLabel(code) {
  return DISEASE_LABELS[String(code ?? "").toUpperCase()] ?? "Selected disease";
}

function shortPeriodLabel(windowLabel) {
  return windowLabel ? `Last 4 weeks (${windowLabel})` : "Last 4 weeks";
}

function formatCaseChange(delta) {
  if (delta > 0) return `up ${delta}`;
  if (delta < 0) return `down ${Math.abs(delta)}`;
  return "no change";
}

function exportCsv(rows, mode) {
  const headers =
    mode === "barangay"
      ? ["Rank", "Municipality", "Barangay", "Recent cases", "Previous period", "Change", "Percent change"]
      : ["Rank", "Municipality", "Recent cases", "Previous period", "Change", "Percent change"];
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
  a.download = `alerto-rankings-${mode}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RankingTableSection({ id, title, subtitle, rows, mode, onExport }) {
  return (
    <section className="prov-panel" aria-labelledby={id}>
      <div className="prov-panel-head">
        <div>
          <h3 id={id}>{title}</h3>
          {subtitle ? <p className="prov-sub prov-panel-head-sub">{subtitle}</p> : null}
        </div>
        <button type="button" className="prov-btn prov-btn--ghost" onClick={onExport}>
          Download CSV
        </button>
      </div>
      <ProvincialVelocityTable rows={rows} mode={mode} plainLabels showToolbar={false} />
    </section>
  );
}

export default function ProvincialRankings() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    windowLabel,
    municipalities,
    municipalityRows,
    barangayRows,
    topBarangaysHeadline
  } = useProvincialSurveillance();

  const disease = diseaseLabel(filters.diseaseFilter);
  const periodNote = shortPeriodLabel(windowLabel);
  const barangayScope = filters.municipalityFilter
    ? `${filters.municipalityFilter} only`
    : "Province-wide";

  return (
    <ProvincialPageShell title="Areas with rising cases" lastSyncedAt={lastSyncedAt} loading={loading}>
      {loading ? <p className="prov-status">Loading case data…</p> : null}
      {error ? (
        <p className="prov-status prov-status--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="prov-dash">
          <ProvincialFilters
            filters={filters}
            patchFilters={patchFilters}
            periodCaption={periodNote}
            municipalities={municipalities}
            showMunicipalityFilter
          />

          <section className="prov-panel prov-headline" aria-live="polite">
            <h3>Top barangays — {disease}</h3>
            <p className="prov-sub">
              {barangayScope} · compared to the previous 4 weeks
            </p>
            {topBarangaysHeadline.top.length === 0 ? (
              <p className="prov-note">No barangays with cases for this filter.</p>
            ) : (
              <ol className="prov-top-list">
                {topBarangaysHeadline.top.map((r) => (
                  <li key={r.barangayKey}>
                    <strong>{r.barangay}</strong>, {r.municipality} — {r.current}{" "}
                    {r.current === 1 ? "case" : "cases"} ({formatCaseChange(r.delta)})
                  </li>
                ))}
              </ol>
            )}
          </section>

          <RankingTableSection
            id="prov-muni-rankings-title"
            title="Municipalities"
            subtitle={`${disease} · ${periodNote}`}
            rows={municipalityRows}
            mode="municipality"
            onExport={() => exportCsv(municipalityRows, "municipality")}
          />

          <RankingTableSection
            id="prov-brgy-rankings-title"
            title="Barangays"
            subtitle={`${disease} · ${barangayScope} · ${periodNote}`}
            rows={barangayRows}
            mode="barangay"
            onExport={() => exportCsv(barangayRows, "barangay")}
          />
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
