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
        <div className="prov-dash prov-dash-grid">
          <ProvincialKpiCards kpis={kpis} />

          <div className="prov-dash-row-main">
            <section className="prov-panel prov-dash-trend-panel" aria-label="Province trends">
              <header className="dash-panel-head dash-panel-head--split prov-dash-trend-head">
                <div className="dash-panel-head-copy">
                  <h3>Province-wide weekly trends</h3>
                  <p>{shortPeriodLabel(windowLabel)} · Total confirmed cases</p>
                </div>
                <ProvincialFilters
                  filters={filters}
                  patchFilters={patchFilters}
                  diseaseControl="buttons"
                  inline
                />
              </header>
              <ProvincialProvinceTrend
                provinceTrend={provinceTrend}
                diseaseFilter={filters.diseaseFilter}
                hideTitle
              />
            </section>

            <section className="prov-panel prov-sync" aria-label="Barangay reporting status">
              <header className="dash-panel-head">
                <div className="dash-panel-head-copy">
                  <h3>Barangay reporting</h3>
                  <p>Encoding sync across the province</p>
                </div>
              </header>
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
          </div>
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
