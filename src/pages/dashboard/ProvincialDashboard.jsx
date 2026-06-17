import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialKpiCards from "@/components/provincial/ProvincialKpiCards";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import ProvincialProvinceTrend from "@/components/provincial/ProvincialProvinceTrend";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

function shortPeriodLabel(windowLabel) {
  return windowLabel ? `Last 4 weeks (${windowLabel})` : "Last 4 weeks";
}

export default function ProvincialDashboard() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    windowLabel,
    kpis,
    syncHealth,
    provinceTrend
  } = useProvincialSurveillance();

  return (
    <ProvincialPageShell title="Provincial overview" lastSyncedAt={lastSyncedAt} loading={loading}>
      {loading ? <p className="prov-status">Loading case data…</p> : null}
      {error ? (
        <p className="prov-status prov-status--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="prov-dash">
          <ProvincialKpiCards kpis={kpis} />

          <section className="prov-panel prov-sync" aria-label="Barangay reporting status">
            <h3>Barangay reporting</h3>
            <div className="prov-sync-grid">
              <article className="prov-sync-card">
                <span className="prov-sync-label">Barangays reporting</span>
                <strong>
                  {syncHealth.reportingBarangays} / {syncHealth.totalBarangays}
                </strong>
              </article>
              <article className="prov-sync-card">
                <span className="prov-sync-label">Last case report</span>
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

          <ProvincialFilters
            filters={filters}
            patchFilters={patchFilters}
            periodCaption={shortPeriodLabel(windowLabel)}
            showMunicipalityFilter={false}
          />

          <ProvincialProvinceTrend provinceTrend={provinceTrend} diseaseFilter={filters.diseaseFilter} />
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
