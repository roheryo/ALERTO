import { severityMeta } from "@/lib/alertSeverity";

function AlertSeverityBadge({ severity }) {
  const meta = severityMeta(severity);
  const severityKey = String(severity ?? "").toLowerCase();
  return (
    <span className={`alert-severity-pill alert-severity-pill--${severityKey}`}>
      {meta.label}
    </span>
  );
}

export default AlertSeverityBadge;
