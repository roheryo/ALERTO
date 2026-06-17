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
    statusBoard,
    crossAlerts
  } = useProvincialSurveillance();

  const watchList = statusBoard.filter((r) => r.alertLevel !== "normal");
  const escalation = statusBoard.filter((r) => r.alertLevel === "high" || r.alertLevel === "elevated");

  return (
    <ProvincialPageShell
      title="PHO coordination"
      subline="Municipality status, cross-LGU alerts, escalation (decision-support)"
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

          <section className="prov-panel" aria-labelledby="prov-cross-title">
            <h3 id="prov-cross-title">Cross-municipality alerts</h3>
            <p className="prov-sub">Areas needing PHO coordination for disease {filters.diseaseFilter}</p>
            {crossAlerts.length === 0 ? (
              <p className="prov-empty">No municipalities above coordination thresholds for this window.</p>
            ) : (
              <ul className="prov-coord-list">
                {crossAlerts.map((r) => (
                  <li key={r.municipalityKey}>
                    <strong>{r.municipality}</strong>
                    <span className={`prov-alert-pill prov-alert-pill--${r.alertLevel}`}>{r.alertLevel}</span>
                    <span>
                      {r.current} cases · Δ {r.delta > 0 ? `+${r.delta}` : r.delta} · last encode{" "}
                      {r.lastBarangay ? `${r.lastBarangay} (${fmtMinutesAgo(r.minutesAgo)})` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="prov-panel" aria-labelledby="prov-board-title">
            <h3 id="prov-board-title">Municipality status board</h3>
            <p className="prov-sub">All LGUs · cases in window, velocity, alert level, last case encoded</p>
            <div className="prov-board-table-wrap">
              <table className="prov-table prov-board-table">
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th>Current</th>
                    <th>Prior</th>
                    <th>Δ</th>
                    <th>Alert</th>
                    <th>Last encode</th>
                  </tr>
                </thead>
                <tbody>
                  {statusBoard.map((r) => (
                    <tr key={r.municipalityKey} className={r.alertLevel !== "normal" ? "prov-row--rising" : ""}>
                      <td>{r.municipality}</td>
                      <td>{r.current}</td>
                      <td>{r.prior}</td>
                      <td>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                      <td>
                        <span className={`prov-alert-pill prov-alert-pill--${r.alertLevel}`}>{r.alertLevel}</span>
                      </td>
                      <td>
                        {r.lastBarangay ? `${r.lastBarangay} · ${fmtMinutesAgo(r.minutesAgo)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="prov-panel" aria-labelledby="prov-escalation-title">
            <h3 id="prov-escalation-title">Declaration / escalation watch</h3>
            <p className="prov-sub">Decision-support only — recommended PHO follow-up (not automated declarations)</p>
            {escalation.length === 0 ? (
              <p className="prov-empty">No municipalities in elevated or high alert for this period.</p>
            ) : (
              <ul className="prov-escalation-list">
                {escalation.map((r) => (
                  <li key={r.municipalityKey}>
                    <strong>{r.municipality}</strong> — recommend coordination / investigation
                    <span className="prov-escalation-meta">
                      {r.current} cases in window · velocity Δ {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {watchList.length > escalation.length ? (
              <p className="prov-note">
                {watchList.length - escalation.length} additional municipality/municipalities on watch status.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
