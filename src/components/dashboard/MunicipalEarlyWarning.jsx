import { useMemo } from "react";
import { computeBarangayAlerts } from "@/lib/municipalAlerts";

function alertBadgeClass(alertType) {
  if (alertType === "velocity") return "muni-alert-badge muni-alert-badge--velocity";
  if (alertType === "both") return "muni-alert-badge muni-alert-badge--both";
  return "muni-alert-badge muni-alert-badge--count";
}

/**
 * Threshold alerts with inline MHO workflow (Investigate / Acknowledged).
 */
export default function MunicipalEarlyWarning({
  velocityRows = [],
  diseaseFilter = "DENGUE",
  watchStatus = {},
  onWatchStatusChange,
  onSelectBarangay,
  selectedBarangayKey = null
}) {
  const alerts = useMemo(
    () => computeBarangayAlerts(velocityRows, diseaseFilter),
    [velocityRows, diseaseFilter]
  );

  function setStatus(barangayKey, status) {
    onWatchStatusChange?.({ ...watchStatus, [barangayKey]: status });
  }

  return (
    <section className="muni-panel muni-ew-panel" aria-labelledby="muni-ew-title">
      <header className="muni-section-head">
        <div>
          <h3 id="muni-ew-title">Early warning &amp; outbreak watch</h3>
          <p className="muni-section-sub">
            Barangays above thresholds — select a row for declaration workspace or update MHO status.
          </p>
        </div>
        {alerts.length > 0 ? (
          <span className="muni-section-badge muni-section-badge--alert">{alerts.length} alert(s)</span>
        ) : (
          <span className="muni-section-badge">Clear</span>
        )}
      </header>

      {alerts.length === 0 ? (
        <p className="muni-ew-empty">No barangays crossed alert thresholds for this period.</p>
      ) : (
        <ul className="muni-ew-alert-list muni-ew-alert-list--single">
          {alerts.map((a) => {
            const status = watchStatus[a.barangayKey] ?? "investigate";
            return (
              <li key={a.barangayKey}>
                <article
                  className={`muni-ew-alert-item${selectedBarangayKey === a.barangayKey ? " is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="muni-ew-alert-main"
                    onClick={() => onSelectBarangay?.(a.barangayKey)}
                  >
                    <span className="muni-ew-alert-top">
                      <strong>{a.barangay}</strong>
                      <span className={alertBadgeClass(a.alertType)}>
                        {a.alertType === "both" ? "Count + velocity" : a.alertType}
                      </span>
                    </span>
                    <span className="muni-ew-alert-meta">
                      {a.current} cases · Δ {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </span>
                    <span className="muni-ew-alert-reasons">{a.reasons.join(" · ")}</span>
                  </button>
                  <div className="muni-ew-watch-actions">
                    <button
                      type="button"
                      className={`muni-ew-status-btn${status === "investigate" ? " is-active" : ""}`}
                      onClick={() => setStatus(a.barangayKey, "investigate")}
                    >
                      Investigate
                    </button>
                    <button
                      type="button"
                      className={`muni-ew-status-btn muni-ew-status-btn--ack${status === "acknowledged" ? " is-active" : ""}`}
                      onClick={() => setStatus(a.barangayKey, "acknowledged")}
                    >
                      Acknowledged
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
