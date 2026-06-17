/**
 * Persistence + query layer for the ALERTO Early-Warning module.
 *
 * Separates SQL concerns from the HTTP routes (backend/routes/alerts.js) and the
 * evaluation logic (backend/services/alertEvaluator.js). The persist/dedup/expire
 * helpers here are reused by the scheduled job and on-ingest trigger in Phase 4.
 *
 * All reads are RBAC-scoped by the caller via `scope` (see resolveAlertScope).
 */

import { randomUUID } from "crypto";

import { pool } from "../config/db.js";

const ALERT_TTL_DAYS = Math.max(1, Number(process.env.ALERT_TTL_DAYS ?? 7) || 7);
const DEDUP_WINDOW_HOURS = 24;

const VALID_STATUS = new Set(["active", "acknowledged", "dismissed", "expired"]);
const VALID_SEVERITY = new Set(["watch", "elevated", "high"]);
const VALID_DISEASE = new Set(["DENGUE", "ILI", "AWD"]);

const SELECT_COLUMNS = `
  a.id,
  a.alert_uuid        AS alertUuid,
  a.municipality_id   AS municipalityId,
  m.name              AS municipality,
  a.barangay_id       AS barangayId,
  b.name              AS barangay,
  a.disease,
  a.severity,
  a.trigger_type      AS triggerType,
  a.trigger_snapshot  AS triggerSnapshot,
  a.status,
  a.acknowledged_by   AS acknowledgedBy,
  a.acknowledged_at   AS acknowledgedAt,
  a.dismissed_at      AS dismissedAt,
  a.expires_at        AS expiresAt,
  a.created_at        AS createdAt,
  a.updated_at        AS updatedAt
`;

const BASE_FROM = `
  FROM early_warning_alerts a
  JOIN municipalities m ON m.id = a.municipality_id
  JOIN barangays b      ON b.id = a.barangay_id
`;

/**
 * Translate the authenticated caller into a SQL scope fragment for alert reads.
 * @returns {{ where: string, params: any[] } | { error: { status: number, body: object } }}
 */
export function resolveAlertScope(auth) {
  const { role, provinceId, municipalityId, barangayId } = auth ?? {};
  if (role === "barangay") {
    if (!barangayId) return { error: { status: 403, body: { error: "Barangay scope missing" } } };
    return { where: "a.barangay_id = ?", params: [barangayId] };
  }
  if (role === "municipality") {
    if (!municipalityId) return { error: { status: 403, body: { error: "Municipality scope missing" } } };
    return { where: "a.municipality_id = ?", params: [municipalityId] };
  }
  if (role === "province") {
    if (!provinceId) return { error: { status: 403, body: { error: "Province scope missing" } } };
    return { where: "m.province_id = ?", params: [provinceId] };
  }
  return { error: { status: 403, body: { error: "Forbidden" } } };
}

function parseSnapshot(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapRow(row) {
  return { ...row, triggerSnapshot: parseSnapshot(row.triggerSnapshot) };
}

/**
 * List alerts in scope, optionally filtered by status / disease / severity.
 * @param {object} scope  Output of resolveAlertScope (must not contain `error`).
 * @param {object} [filters]
 */
export async function listAlerts(scope, filters = {}) {
  const clauses = [scope.where];
  const params = [...scope.params];

  const status = String(filters.status ?? "active").toLowerCase();
  if (status !== "all") {
    if (!VALID_STATUS.has(status)) {
      return { error: { status: 400, body: { error: "Invalid status filter" } } };
    }
    clauses.push("a.status = ?");
    params.push(status);
  }

  if (filters.disease) {
    const disease = String(filters.disease).toUpperCase();
    if (!VALID_DISEASE.has(disease)) {
      return { error: { status: 400, body: { error: "disease must be DENGUE, ILI, or AWD" } } };
    }
    clauses.push("a.disease = ?");
    params.push(disease);
  }

  if (filters.severity) {
    const severity = String(filters.severity).toLowerCase();
    if (!VALID_SEVERITY.has(severity)) {
      return { error: { status: 400, body: { error: "Invalid severity filter" } } };
    }
    clauses.push("a.severity = ?");
    params.push(severity);
  }

  const severityOrder = "FIELD(a.severity, 'high', 'elevated', 'watch')";
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE ${clauses.join(" AND ")}
     ORDER BY ${severityOrder}, a.created_at DESC, a.id DESC
     LIMIT 500`,
    params
  );
  return { alerts: rows.map(mapRow) };
}

/** Active-alert counts for the sidebar badge / dashboard indicator. */
export async function getAlertSummary(scope) {
  const [rows] = await pool.query(
    `SELECT a.severity AS severity, COUNT(*) AS count
     ${BASE_FROM}
     WHERE ${scope.where} AND a.status = 'active'
     GROUP BY a.severity`,
    [...scope.params]
  );

  const bySeverity = { high: 0, elevated: 0, watch: 0 };
  let total = 0;
  for (const row of rows) {
    const n = Number(row.count) || 0;
    if (row.severity in bySeverity) bySeverity[row.severity] = n;
    total += n;
  }
  return { total, active: total, bySeverity };
}

async function logEvent(alertId, eventType, actorUserId, payload) {
  await pool.query(
    `INSERT INTO early_warning_alert_events (alert_id, event_type, actor_user_id, payload)
     VALUES (?, ?, ?, ?)`,
    [alertId, eventType, actorUserId ?? null, payload ? JSON.stringify(payload) : null]
  );
}

/** Load a single alert constrained to the caller's scope (for mutations). */
async function findScopedAlert(scope, alertId) {
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE ${scope.where} AND a.id = ?
     LIMIT 1`,
    [...scope.params, alertId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Acknowledge an active alert (MHO action). */
export async function acknowledgeAlert(scope, alertId, actorUserId) {
  const alert = await findScopedAlert(scope, alertId);
  if (!alert) return { error: { status: 404, body: { error: "Alert not found" } } };
  if (alert.status !== "active") {
    return { error: { status: 409, body: { error: `Alert already ${alert.status}` } } };
  }

  await pool.query(
    `UPDATE early_warning_alerts
     SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [actorUserId ?? null, alertId]
  );
  await logEvent(alertId, "acknowledged", actorUserId, null);
  return { alert: await findScopedAlert(scope, alertId) };
}

/** Dismiss an alert with an optional free-text reason (MHO action). */
export async function dismissAlert(scope, alertId, actorUserId, reason) {
  const alert = await findScopedAlert(scope, alertId);
  if (!alert) return { error: { status: 404, body: { error: "Alert not found" } } };
  if (alert.status === "dismissed") {
    return { error: { status: 409, body: { error: "Alert already dismissed" } } };
  }

  await pool.query(
    `UPDATE early_warning_alerts
     SET status = 'dismissed', dismissed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [alertId]
  );
  const trimmedReason =
    typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null;
  await logEvent(alertId, "dismissed", actorUserId, trimmedReason ? { reason: trimmedReason } : null);
  return { alert: await findScopedAlert(scope, alertId) };
}

function dedupKey(barangayId, disease) {
  return `${barangayId}|${String(disease).toUpperCase()}`;
}

/**
 * Persist evaluator candidates for one municipality with 24h dedup and stale
 * expiry. Reused by POST /api/alerts/evaluate and the Phase 4 automation.
 *
 * Dedup: an active alert for the same (barangay, disease, severity) created
 * within the last 24h is refreshed (snapshot + trigger_type) rather than
 * duplicated. Stale: active alerts for a (barangay, disease) that no longer
 * breaches any threshold are expired.
 *
 * @param {number} municipalityId
 * @param {object[]} candidates  Output of evaluateBarangayAlerts (same municipality).
 * @param {object} [options]
 * @param {number|null} [options.actorUserId]
 * @param {boolean} [options.expireStale=true]
 * @returns {Promise<{ created: number, updated: number, expired: number }>}
 */
export async function persistMunicipalityAlerts(municipalityId, candidates, options = {}) {
  const { actorUserId = null, expireStale = true } = options;
  const summary = { created: 0, updated: 0, expired: 0 };
  const activeKeys = new Set();

  for (const candidate of candidates) {
    if (!candidate?.barangayId) continue; // can't persist a locality without a FK
    activeKeys.add(dedupKey(candidate.barangayId, candidate.disease));

    const [existing] = await pool.query(
      `SELECT id FROM early_warning_alerts
       WHERE barangay_id = ? AND disease = ? AND severity = ? AND status = 'active'
         AND created_at >= (NOW() - INTERVAL ? HOUR)
       ORDER BY id DESC
       LIMIT 1`,
      [candidate.barangayId, candidate.disease, candidate.severity, DEDUP_WINDOW_HOURS]
    );

    const snapshotJson = JSON.stringify(candidate.snapshot ?? {});

    if (existing[0]) {
      await pool.query(
        `UPDATE early_warning_alerts
         SET trigger_type = ?, trigger_snapshot = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [candidate.triggerType, snapshotJson, existing[0].id]
      );
      await logEvent(existing[0].id, "updated", actorUserId, candidate.snapshot ?? null);
      summary.updated += 1;
    } else {
      const alertUuid = randomUUID();
      const [ins] = await pool.query(
        `INSERT INTO early_warning_alerts (
           alert_uuid, municipality_id, barangay_id, disease, severity,
           trigger_type, trigger_snapshot, status, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', (NOW() + INTERVAL ? DAY))`,
        [
          alertUuid,
          candidate.municipalityId ?? municipalityId,
          candidate.barangayId,
          candidate.disease,
          candidate.severity,
          candidate.triggerType,
          snapshotJson,
          ALERT_TTL_DAYS
        ]
      );
      await logEvent(ins.insertId, "created", actorUserId, candidate.snapshot ?? null);
      summary.created += 1;
    }
  }

  if (expireStale) {
    const [activeRows] = await pool.query(
      `SELECT id, barangay_id AS barangayId, disease
       FROM early_warning_alerts
       WHERE municipality_id = ? AND status = 'active'`,
      [municipalityId]
    );
    for (const row of activeRows) {
      if (activeKeys.has(dedupKey(row.barangayId, row.disease))) continue;
      await pool.query(
        `UPDATE early_warning_alerts
         SET status = 'expired', expires_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [row.id]
      );
      await logEvent(row.id, "expired", actorUserId, { reason: "condition_resolved" });
      summary.expired += 1;
    }
  }

  return summary;
}
