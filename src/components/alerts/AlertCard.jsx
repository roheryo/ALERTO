import { useState } from "react";
import { Link } from "react-router-dom";

import { severityClass } from "@/lib/alertSeverity";
import { normalizePlaceKey } from "@/lib/surveillance";

import AlertSeverityBadge from "./AlertSeverityBadge";

const DISEASE_LABEL = {
  DENGUE: "Dengue",
  ILI: "Influenza-like Illness",
  AWD: "Acute Watery Diarrhea"
};

const STATUS_LABEL = {
  active: "Active",
  acknowledged: "Acknowledged",
  dismissed: "Dismissed",
  expired: "Expired"
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

/** "12 cases this 4-week window, +5 vs the prior 4 weeks (140%)". */
function triggerSummary(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "Pattern threshold reached.";
  const { current, delta, pctChange, windowWeeks } = snapshot;
  const weeks = windowWeeks ?? 4;
  const parts = [`${current ?? 0} case${current === 1 ? "" : "s"} in the last ${weeks} weeks`];
  if (Number.isFinite(delta)) {
    const sign = delta > 0 ? "+" : "";
    parts.push(`${sign}${delta} vs the prior ${weeks} weeks`);
  }
  if (Number.isFinite(pctChange) && pctChange !== 0) {
    const sign = pctChange > 0 ? "+" : "";
    parts.push(`${sign}${pctChange}%`);
  }
  return parts.join(" · ");
}

function AlertCard({ alert, canMutate, onAcknowledge, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isActive = alert.status === "active";
  const diseaseLabel = DISEASE_LABEL[alert.disease] ?? alert.disease;

  const handle = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`alert-card ${severityClass(alert.severity)}`}>
      <div className="alert-top">
        <AlertSeverityBadge severity={alert.severity} />
        <span className="alert-time">{formatRelativeTime(alert.createdAt)}</span>
      </div>

      <h3>
        {alert.barangay || "Unknown barangay"} — {diseaseLabel}
      </h3>
      <p className="desc">{triggerSummary(alert.triggerSnapshot)}</p>

      <div className="alert-meta">
        <span>
          <strong>Municipality:</strong> {alert.municipality || "—"}
        </span>
        <span>
          <strong>Status:</strong> {STATUS_LABEL[alert.status] ?? alert.status}
        </span>
        <span>
          <strong>Trigger:</strong> {alert.triggerType ?? "—"}
        </span>
        <span>
          <strong>Threshold:</strong> {alert.triggerSnapshot?.threshold ?? "—"}
        </span>
      </div>

      {alert.status === "acknowledged" && alert.acknowledgedAt ? (
        <div className="action-box">
          <span>Acknowledged {formatRelativeTime(alert.acknowledgedAt)}</span>
        </div>
      ) : null}

      {canMutate && isActive ? (
        <div className="alert-actions">
          <button
            type="button"
            className="alert-btn alert-btn--ack"
            disabled={busy}
            onClick={() => handle(() => onAcknowledge(alert.id))}
          >
            {busy ? "Working…" : "Acknowledge"}
          </button>
          <button
            type="button"
            className="alert-btn alert-btn--dismiss"
            disabled={busy}
            onClick={() => handle(() => onDismiss(alert.id))}
          >
            Dismiss
          </button>
          <Link
            className="alert-btn alert-btn--declare"
            to={`/dashboard?barangay=${encodeURIComponent(
              normalizePlaceKey(alert.barangay)
            )}&disease=${encodeURIComponent(alert.disease)}`}
            title="Open the declaration workspace for this barangay"
          >
            Open declaration workspace →
          </Link>
        </div>
      ) : null}

      {actionError ? (
        <p className="alert-action-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </article>
  );
}

export default AlertCard;
