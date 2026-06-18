import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

function fmtMinutesAgo(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h} hr ago`;
}

export default function ProvincialCoordination() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    windows,
    periodCaption,
    municipalities,
    statusBoard
  } = useProvincialSurveillance();

  return (
    <ProvincialPageShell
      title="PHO coordination"
      subline="Municipality status and last case encoded"
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
            showMunicipalityFilter
          />

          <section className="prov-panel" aria-labelledby="prov-board-title">
            <h3 id="prov-board-title">Municipality status board</h3>
            <p className="prov-sub">All LGUs · cases in window, velocity, last case encoded</p>
            <div className="prov-board-table-wrap">
              <table className="prov-table prov-board-table">
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th>Current</th>
                    <th>Prior</th>
                    <th>Δ</th>
                    <th>Last encode</th>
                  </tr>
                </thead>
                <tbody>
                  {statusBoard.map((r) => (
                    <tr key={r.municipalityKey} className={r.delta > 0 ? "prov-row--rising" : ""}>
                      <td>{r.municipality}</td>
                      <td>{r.current}</td>
                      <td>{r.prior}</td>
                      <td>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                      <td>
                        {r.lastBarangay ? `${r.lastBarangay} · ${fmtMinutesAgo(r.minutesAgo)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
