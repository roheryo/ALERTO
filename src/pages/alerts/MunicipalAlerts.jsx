import { useEffect, useMemo, useRef, useState } from "react";

import AlertSeverityBadge from "@/components/alerts/AlertSeverityBadge";
import { alertDisplayTime, formatAlertToken, sortAcknowledgedAlerts } from "@/lib/alertListDisplay";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import "@/styles/dashboard-shell.css";
import "../dashboard/MunicipalDashboard.css";
import "./MunicipalAlerts.css";

const DISEASE_LABEL = {
  DENGUE: "Dengue",
  ILI: "Influenza-like Illness",
  AWD: "Acute Watery Diarrhea"
};

function formatRelativeTime(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** One-line reason for list rows. */
function shortReason(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "Threshold crossed";
  const { current, pctChange, windowWeeks, prior } = snapshot;
  const weeks = windowWeeks ?? 4;
  const count = current ?? 0;
  const before = prior ?? 0;
  if (Number.isFinite(pctChange) && pctChange > 0) {
    return `${count} cases in ${weeks} wks (was ${before}, +${pctChange}%)`;
  }
  return `${count} case${count === 1 ? "" : "s"} in ${weeks} weeks`;
}

/** Short plain-language summary for the modal reason block. */
function plainReason(snapshot, severity, status) {
  if (status === "acknowledged") {
    return "Response recorded. Continue routine monitoring unless cases rise again.";
  }

  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  const weeks = s.windowWeeks ?? 4;
  const current = s.current ?? 0;
  const prior = s.prior ?? 0;
  const pct = s.pctChange;
  const sev = String(severity ?? "").toLowerCase();

  if (sev === "high") {
    if (Number.isFinite(pct) && pct > 0) {
      return `Urgent: ${current} cases in ${weeks} weeks — up ${pct}% from ${prior}. Deploy response now.`;
    }
    return `Urgent: ${current} cases in ${weeks} weeks. Deploy barangay response now.`;
  }

  if (sev === "elevated") {
    if (Number.isFinite(pct) && pct > 0) {
      return `Cases rising: ${current} in ${weeks} weeks (${prior} before, +${pct}%). Step up surveillance.`;
    }
    return `Cases rising: ${current} in ${weeks} weeks (${prior} before). Step up surveillance.`;
  }

  if (Number.isFinite(pct) && pct > 0) {
    return `Watch: ${current} cases in ${weeks} weeks (+${pct}% vs prior). Monitor closely.`;
  }
  return `Watch: ${current} case${current === 1 ? "" : "s"} in ${weeks} weeks. Monitor closely.`;
}

function reasonToneClass(alert) {
  if (alert.status === "acknowledged") return "muni-alerts-reason--resolved";
  const sev = String(alert.severity ?? "").toLowerCase();
  if (sev === "high" || sev === "elevated" || sev === "watch") {
    return `muni-alerts-reason--${sev}`;
  }
  return "muni-alerts-reason--watch";
}

function AlertListRow({ alert, selected, onSelect }) {
  const diseaseLabel = DISEASE_LABEL[alert.disease] ?? alert.disease;
  const isAcknowledged = alert.status === "acknowledged";
  const severityKey = String(alert.severity ?? "").toLowerCase();
  const itemClass = [
    "muni-priority-alert-item",
    severityKey ? `muni-priority-alert-item--${severityKey}` : null,
    isAcknowledged ? "is-acknowledged" : null,
    selected ? "is-selected" : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={itemClass} data-alert-id={alert.id}>
      <button
        type="button"
        className="muni-priority-alert-btn"
        onClick={() => onSelect(alert)}
        aria-pressed={selected}
      >
        <span className="muni-priority-alert-dot" aria-hidden="true" />
        <div className="muni-priority-alert-body">
          <span className="muni-priority-alert-title">{diseaseLabel}</span>
          <span className="muni-priority-alert-meta">
            {alert.barangay || "Unknown barangay"} · {shortReason(alert.triggerSnapshot)}
          </span>
        </div>
        <div className="muni-priority-alert-end">
          <span className="muni-priority-alert-time">{formatRelativeTime(alertDisplayTime(alert))}</span>
          <AlertSeverityBadge severity={alert.severity} />
        </div>
      </button>
    </li>
  );
}

function AlertDetailModal({ alert, canMutate, onAcknowledge, onClose }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const panelRef = useRef(null);
  const titleId = "muni-alert-modal-title";

  useEffect(() => {
    if (!alert) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [alert]);

  useEffect(() => {
    if (!alert) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector(".muni-alerts-modal-close")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [alert]);

  useEffect(() => {
    if (!alert) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alert, onClose]);

  if (!alert) return null;

  const diseaseLabel = DISEASE_LABEL[alert.disease] ?? alert.disease;
  const isActive = alert.status === "active";

  const handleAcknowledge = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await onAcknowledge(alert.id);
    } catch (e) {
      setActionError(e?.message ?? "Acknowledge failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="muni-alerts-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="muni-alerts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="muni-alerts-modal-head">
          <div>
            <AlertSeverityBadge severity={alert.severity} />
            <h3 id={titleId} className="muni-alerts-modal-title">
              {diseaseLabel} — {alert.barangay}
            </h3>
            <p className="muni-ew-alert-meta">
              Raised {formatRelativeTime(alert.createdAt)}
              {alert.status === "acknowledged" && alert.acknowledgedAt
                ? ` · Acknowledged ${formatRelativeTime(alert.acknowledgedAt)}`
                : null}
            </p>
          </div>
          <button
            type="button"
            className="muni-alerts-modal-close"
            onClick={onClose}
            aria-label="Close alert details"
          >
            ×
          </button>
        </header>

        <div className="muni-alerts-modal-body">
          <div
            className={`muni-declare-card muni-declare-card--solo muni-alerts-reason ${reasonToneClass(alert)}`}
          >
            <h4>Why this alert fired</h4>
            <p className="muni-declare-stat">
              {plainReason(alert.triggerSnapshot, alert.severity, alert.status)}
            </p>
            <dl className="muni-declare-dl">
              <dt>Trigger type</dt>
              <dd>{formatAlertToken(alert.triggerType)}</dd>
              <dt>Status</dt>
              <dd>{formatAlertToken(alert.status)}</dd>
              <dt>Municipality</dt>
              <dd>{alert.municipality ?? "—"}</dd>
            </dl>
          </div>

          {canMutate && isActive ? (
            <div className="muni-alerts-modal-actions">
              <button
                type="button"
                className="muni-ew-status-btn muni-ew-status-btn--ack is-active"
                disabled={busy}
                onClick={handleAcknowledge}
              >
                {busy ? "Working…" : "Acknowledge intervention"}
              </button>
            </div>
          ) : null}

          {actionError ? (
            <p className="muni-alerts-error" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AlertSection({ title, alerts, selectedId, onSelect, emptyMessage }) {
  return (
    <section className="muni-alerts-section">
      <h3 className="muni-alerts-section-title">
        {title}
        <span className="muni-alerts-section-count">{alerts.length}</span>
      </h3>
      {alerts.length === 0 ? (
        <p className="muni-ew-empty">{emptyMessage}</p>
      ) : (
        <ul className="muni-priority-alert-list">
          {alerts.map((alert) => (
            <AlertListRow
              key={alert.id}
              alert={alert}
              selected={selectedId === alert.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MunicipalAlerts() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);

  const { alerts, loading, error, canMutate, acknowledge, summary } = useAlerts({
    status: "all"
  });

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  );
  const acknowledgedAlerts = useMemo(
    () => sortAcknowledgedAlerts(alerts.filter((a) => a.status === "acknowledged")),
    [alerts]
  );

  const selectedAlert = useMemo(
    () => alerts.find((a) => a.id === selectedId) ?? null,
    [alerts, selectedId]
  );

  const subtitle = user?.municipalityName
    ? `${user.municipalityName} Municipal Health Office`
    : "Municipal Health Office";

  const handleSelect = (alert) => {
    setSelectedId(alert.id);
  };

  const handleAcknowledge = async (alertId) => {
    await acknowledge(alertId);
    setSelectedId(alertId);
  };

  return (
    <div className="muni-alerts-page">
      <DashboardPageHeader
        pageTitle="Early-Warning Alerts"
        subline={`${subtitle} — ${summary.active} active alert${summary.active === 1 ? "" : "s"}`}
      />

      {error ? (
        <p className="muni-alerts-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="muni-ew-empty" role="status">
          Loading alerts…
        </p>
      ) : (
        <div className="muni-alerts-layout">
          <div className="muni-alerts-list-pane">
            <AlertSection
              title="Active / Ongoing"
              alerts={activeAlerts}
              selectedId={selectedId}
              onSelect={handleSelect}
              emptyMessage="No active outbreak-risk patterns right now."
            />
            <AlertSection
              title="Acknowledged"
              alerts={acknowledgedAlerts}
              selectedId={selectedId}
              onSelect={handleSelect}
              emptyMessage="No acknowledged alerts yet."
            />
          </div>
          <AlertDetailModal
            alert={selectedAlert}
            canMutate={canMutate}
            onAcknowledge={handleAcknowledge}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}

export default MunicipalAlerts;
