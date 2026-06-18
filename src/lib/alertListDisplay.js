/**
 * Display time + sort helpers for municipal alert lists.
 * Active rows use createdAt; acknowledged rows use acknowledgedAt.
 */

/** Title-case enum-like API values for display (velocity → Velocity). */
export function formatAlertToken(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  if (raw === "—") return raw;
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Timestamp shown in muni-priority-alert-time (and for acknowledged sort). */
export function alertDisplayTime(alert) {
  if (alert?.status === "acknowledged" && alert?.acknowledgedAt) {
    return alert.acknowledgedAt;
  }
  return alert?.createdAt ?? null;
}

function timeValue(value) {
  const t = new Date(value ?? "").getTime();
  return Number.isNaN(t) ? null : t;
}

/** Newest acknowledgment first; ties fall back to createdAt then id. */
export function sortAcknowledgedAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const tb = timeValue(alertDisplayTime(b));
    const ta = timeValue(alertDisplayTime(a));
    if (tb != null && ta != null && tb !== ta) return tb - ta;
    if (tb != null && ta == null) return -1;
    if (tb == null && ta != null) return 1;
    const cb = timeValue(b.createdAt) ?? 0;
    const ca = timeValue(a.createdAt) ?? 0;
    if (cb !== ca) return cb - ca;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
