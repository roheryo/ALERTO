/** Case-count thresholds (aligned with provincial alert heuristics). */
export const COUNT_THRESHOLDS = {
  DENGUE: 10,
  ILI: 14,
  AWD: 8
};

export const VELOCITY_MIN_DELTA = 2;
export const VELOCITY_MIN_PCT = 40;
export const TOP_BARANGAY_CHART = 10;

export function watchStorageKey(municipalityName) {
  const m = String(municipalityName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return `alerto-muni-watch-${m || "default"}`;
}

/** Barangays crossing count or velocity thresholds for the active disease filter. */
export function computeBarangayAlerts(rows, diseaseFilter = "DENGUE") {
  if (!Array.isArray(rows)) return [];

  const threshold =
    diseaseFilter === "ALL"
      ? Math.min(COUNT_THRESHOLDS.DENGUE, COUNT_THRESHOLDS.ILI, COUNT_THRESHOLDS.AWD)
      : COUNT_THRESHOLDS[String(diseaseFilter).toUpperCase()] ?? 10;

  const alerts = [];

  for (const row of rows) {
    const reasons = [];
    let alertType = null;

    if (row.current >= threshold) {
      reasons.push(`Cases in window: ${row.current} (threshold ≥${threshold})`);
      alertType = "count";
    }
    if (row.delta >= VELOCITY_MIN_DELTA && row.current >= 2) {
      reasons.push(`Increase of +${row.delta} vs prior window`);
      alertType = alertType === "count" ? "both" : "velocity";
    } else if (row.pctChange >= VELOCITY_MIN_PCT && row.current >= 2 && row.delta > 0) {
      reasons.push(`+${Math.round(row.pctChange)}% vs prior window`);
      alertType = alertType === "count" ? "both" : "velocity";
    }

    if (reasons.length) {
      alerts.push({ ...row, reasons, alertType: alertType ?? "count" });
    }
  }

  return alerts.sort((a, b) => b.current - a.current || b.delta - a.delta);
}

export function loadWatchStatus(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWatchStatus(storageKey, statusMap) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(statusMap));
  } catch {
    /* ignore quota errors */
  }
}
