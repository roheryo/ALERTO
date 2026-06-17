import { severityMeta } from "@/lib/alertSeverity";

function AlertSeverityBadge({ severity }) {
  const meta = severityMeta(severity);
  return <span className={`pill ${meta.className}`}>{meta.label}</span>;
}

export default AlertSeverityBadge;
