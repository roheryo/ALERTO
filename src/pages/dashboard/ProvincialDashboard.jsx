import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialKpiCards from "@/components/provincial/ProvincialKpiCards";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import ProvincialProvinceTrend from "@/components/provincial/ProvincialProvinceTrend";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

export default function ProvincialDashboard() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    windows,
    periodCaption,
    kpis,
    syncHealth,
    provinceTrend
  } = useProvincialSurveillance();

  return (
    <ProvincialPageShell
      title="Provincial surveillance"
      subline="Province-wide overview — use sidebar for rankings, map, and coordination"
      lastSyncedAt={lastSyncedAt}
      loading={loading}
    >
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
            periodCaption={periodCaption}
            windows={windows}
            showMunicipalityFilter={false}
          />

          <ProvincialKpiCards kpis={kpis} />

          <section className="prov-panel prov-sync" aria-label="Data integration health">
            <h3>Surveillance integration</h3>
            <p className="prov-sub">
              Data flows from barangay BHU encoding across the province — sync health for PHO oversight.
            </p>
            <div className="prov-sync-grid">
              <article className="prov-sync-card">
                <span className="prov-sync-label">Barangays reporting</span>
                <strong>
                  {syncHealth.reportingBarangays} / {syncHealth.totalBarangays}
                </strong>
              </article>
              <article className="prov-sync-card">
                <span className="prov-sync-label">Last encode</span>
                <strong>
                  {syncHealth.lastEncode
                    ? `${syncHealth.lastEncode.barangay}, ${syncHealth.lastEncode.municipality}`
                    : "—"}
                </strong>
                {syncHealth.lastEncode?.at ? (
                  <span className="prov-sync-meta">
                    {syncHealth.lastEncode.at.toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                ) : null}
              </article>
            </div>
          </section>

          <ProvincialProvinceTrend provinceTrend={provinceTrend} diseaseFilter={filters.diseaseFilter} />
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
