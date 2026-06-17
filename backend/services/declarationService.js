/**
 * Outbreak-declaration decision-support service.
 *
 * Assembles the "decision brief" (case trend + active alerts + LSTM forecast +
 * composite risk score + environmental context) for a locality, and persists
 * human-authored declaration decisions with an audit trail.
 *
 * Separation of concerns mirrors the Early-Warning module:
 *   - HTTP + RBAC          → backend/routes/declarations.js
 *   - detection / scoring  → backend/lib/riskScoring.js, services/forecastEvaluator.js
 *   - persistence (here)   → outbreak_declarations + outbreak_declaration_events
 */

import { randomUUID } from "crypto";

import { pool } from "../config/db.js";
import { WINDOW_WEEKS } from "../lib/riskConfig.js";
import { computeRiskScore } from "../lib/riskScoring.js";
import {
  getComparisonWindows,
  isConfirmedCase,
  normalizeDisease,
  computePctChange
} from "./alertEvaluator.js";
import { evaluateForecastTrigger } from "./forecastEvaluator.js";

const VALID_DISEASE = new Set(["DENGUE", "ILI", "AWD"]);
const VALID_SCOPE = new Set(["barangay", "municipality"]);
const VALID_STATUS = new Set(["draft", "recommended", "declared", "lifted", "cancelled"]);

// Boolean environmental flags whose positive rate feeds the risk score, per disease.
const ENV_FLAGS_BY_DISEASE = {
  DENGUE: ["stagnant_water", "recent_heavy_rain", "flood_history_4wk"],
  AWD: ["flood_history_4wk", "drought_water_shortage"],
  ILI: ["indoor_crowding", "recent_heavy_rain"]
};

function parseCaseDate(row) {
  const raw = row?.dateStarted ?? row?.createdAt ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// --- RBAC scope --------------------------------------------------------------

/**
 * SQL scope fragment for declaration reads, keyed off the authenticated caller.
 * @returns {{ where: string, params: any[] } | { error: { status, body } }}
 */
export function resolveDeclarationScope(auth) {
  const { role, provinceId, municipalityId, barangayId } = auth ?? {};
  if (role === "barangay") {
    if (!barangayId) return { error: { status: 403, body: { error: "Barangay scope missing" } } };
    return { where: "d.barangay_id = ?", params: [barangayId] };
  }
  if (role === "municipality") {
    if (!municipalityId) return { error: { status: 403, body: { error: "Municipality scope missing" } } };
    return { where: "d.municipality_id = ?", params: [municipalityId] };
  }
  if (role === "province") {
    if (!provinceId) return { error: { status: 403, body: { error: "Province scope missing" } } };
    return { where: "m.province_id = ?", params: [provinceId] };
  }
  return { error: { status: 403, body: { error: "Forbidden" } } };
}

/** Verify a (scopeType, scopeId) is inside the caller's jurisdiction and
 *  resolve its municipality_id / barangay_id / province_id. */
export async function resolveScopeTarget(auth, scopeType, scopeId) {
  const id = Number(scopeId);
  if (!VALID_SCOPE.has(scopeType) || !Number.isFinite(id) || id < 1) {
    return { error: { status: 400, body: { error: "Invalid scope" } } };
  }

  if (scopeType === "barangay") {
    const [rows] = await pool.query(
      `SELECT b.id AS barangayId, b.name AS barangay, m.id AS municipalityId,
              m.name AS municipality, m.province_id AS provinceId
       FROM barangays b JOIN municipalities m ON m.id = b.municipality_id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return { error: { status: 404, body: { error: "Barangay not found" } } };
    if (!withinScope(auth, row)) return { error: { status: 403, body: { error: "Out-of-scope locality" } } };
    return {
      scopeType,
      scopeId: id,
      municipalityId: row.municipalityId,
      barangayId: row.barangayId,
      municipality: row.municipality,
      barangay: row.barangay,
      provinceId: row.provinceId
    };
  }

  const [rows] = await pool.query(
    `SELECT m.id AS municipalityId, m.name AS municipality, m.province_id AS provinceId
     FROM municipalities m WHERE m.id = ? LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return { error: { status: 404, body: { error: "Municipality not found" } } };
  if (!withinScope(auth, row)) return { error: { status: 403, body: { error: "Out-of-scope locality" } } };
  return {
    scopeType,
    scopeId: id,
    municipalityId: row.municipalityId,
    barangayId: null,
    municipality: row.municipality,
    barangay: null,
    provinceId: row.provinceId
  };
}

function withinScope(auth, target) {
  const { role, provinceId, municipalityId, barangayId } = auth ?? {};
  if (role === "province") return target.provinceId === provinceId;
  if (role === "municipality") return target.municipalityId === municipalityId;
  if (role === "barangay") return target.barangayId === barangayId;
  return false;
}

// --- Decision brief ----------------------------------------------------------

/** Load confirmed cases (+ environmental flags) for a scope covering the
 *  current and prior comparison windows for one disease. */
async function fetchScopeCases(target, disease, windows) {
  const since = new Date(windows.prior.start);
  since.setDate(since.getDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);

  const whereScope =
    target.scopeType === "barangay" ? "p.barangay_id = ?" : "p.municipality_id = ?";
  const scopeId = target.scopeType === "barangay" ? target.barangayId : target.municipalityId;

  const [rows] = await pool.query(
    `SELECT
        p.disease_type        AS diseaseType,
        p.case_classification AS caseClassification,
        DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
        p.created_at          AS createdAt,
        e.stagnant_water        AS stagnant_water,
        e.recent_heavy_rain     AS recent_heavy_rain,
        e.indoor_crowding       AS indoor_crowding,
        e.flood_history_4wk     AS flood_history_4wk,
        e.drought_water_shortage AS drought_water_shortage,
        e.wash_water_source     AS wash_water_source,
        e.wash_sanitation       AS wash_sanitation
      FROM patients p
      LEFT JOIN case_environmental e ON e.patient_id = p.id
      WHERE ${whereScope}
        AND p.case_classification = 'Confirmed'
        AND COALESCE(p.date_started, DATE(p.created_at)) >= ?`,
    [scopeId, sinceStr]
  );

  return rows.filter((r) => normalizeDisease(r.diseaseType) === disease);
}

/** Tally current/prior counts + environmental positive-rate for a disease. */
function tallyCases(rows, disease, windows) {
  const cur = { start: windows.current.start.getTime(), end: windows.current.end.getTime() };
  const pri = { start: windows.prior.start.getTime(), end: windows.prior.end.getTime() };

  let current = 0;
  let prior = 0;
  const flags = ENV_FLAGS_BY_DISEASE[disease] ?? [];
  let positiveFlags = 0;
  let totalFlags = 0;

  for (const r of rows) {
    if (!isConfirmedCase(r)) continue;
    const dt = parseCaseDate(r);
    if (!dt) continue;
    const t = dt.getTime();
    const inCurrent = t >= cur.start && t <= cur.end;
    if (inCurrent) current += 1;
    else if (t >= pri.start && t <= pri.end) prior += 1;

    if (inCurrent) {
      for (const flag of flags) {
        totalFlags += 1;
        if (Number(r[flag]) === 1) positiveFlags += 1;
      }
      if (disease === "AWD") {
        totalFlags += 2;
        if (["unimproved", "none"].includes(String(r.wash_water_source))) positiveFlags += 1;
        if (["open", "none"].includes(String(r.wash_sanitation))) positiveFlags += 1;
      }
    }
  }

  return {
    current,
    prior,
    delta: current - prior,
    pctChange: Number(computePctChange(current, prior).toFixed(1)),
    environmental: totalFlags > 0 ? { positiveFlags, totalFlags } : null
  };
}

/** Active early-warning alerts supporting a declaration for the scope+disease. */
async function fetchSupportingAlerts(target, disease) {
  const whereScope =
    target.scopeType === "barangay" ? "a.barangay_id = ?" : "a.municipality_id = ?";
  const scopeId = target.scopeType === "barangay" ? target.barangayId : target.municipalityId;
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.alert_uuid AS alertUuid, a.barangay_id AS barangayId, b.name AS barangay,
              a.severity, a.trigger_type AS triggerType, a.created_at AS createdAt
       FROM early_warning_alerts a JOIN barangays b ON b.id = a.barangay_id
       WHERE ${whereScope} AND a.disease = ? AND a.status = 'active'
       ORDER BY FIELD(a.severity,'high','elevated','watch'), a.created_at DESC`,
      [scopeId, disease]
    );
    return rows;
  } catch {
    return [];
  }
}

/**
 * Build the decision brief for a locality + disease: trend snapshot, active
 * alerts, LSTM forecast, environmental context, and the composite risk score.
 */
export async function buildDecisionBrief(auth, { scopeType, scopeId, disease, windowWeeks } = {}) {
  const code = String(disease ?? "").toUpperCase();
  if (!VALID_DISEASE.has(code)) {
    return { error: { status: 400, body: { error: "disease must be DENGUE, ILI, or AWD" } } };
  }

  const target = await resolveScopeTarget(auth, scopeType, scopeId);
  if (target.error) return target;

  const weeks = Number(windowWeeks) > 0 ? Number(windowWeeks) : WINDOW_WEEKS;
  const windows = getComparisonWindows(weeks);

  const rows = await fetchScopeCases(target, code, windows);
  const tally = tallyCases(rows, code, windows);

  // Forecast is municipality-grained; reuse it for barangay scope as outlook.
  const forecast = await evaluateForecastTrigger(target.municipalityId, code).catch(() => null);
  const supportingAlerts = await fetchSupportingAlerts(target, code);

  const risk = computeRiskScore({
    disease: code,
    current: tally.current,
    prior: tally.prior,
    delta: tally.delta,
    pctChange: tally.pctChange,
    forecastSum: forecast?.forecastSum,
    forecastPeak: forecast?.forecastPeak,
    environmental: tally.environmental
  });

  return {
    brief: {
      scope: {
        type: target.scopeType,
        id: target.scopeId,
        municipalityId: target.municipalityId,
        barangayId: target.barangayId,
        municipality: target.municipality,
        barangay: target.barangay
      },
      disease: code,
      windowWeeks: weeks,
      window: {
        currentStart: windows.current.start.toISOString(),
        currentEnd: windows.current.end.toISOString(),
        priorStart: windows.prior.start.toISOString(),
        priorEnd: windows.prior.end.toISOString()
      },
      trend: {
        current: tally.current,
        prior: tally.prior,
        delta: tally.delta,
        pctChange: tally.pctChange
      },
      environmental: tally.environmental,
      forecast: forecast
        ? {
            sum: forecast.forecastSum,
            peak: forecast.forecastPeak,
            threshold: forecast.threshold,
            escalateAt: forecast.escalateAt,
            exceedance: forecast.exceedance,
            asOfWeek: forecast.asOfWeek,
            steps: forecast.forecast
          }
        : null,
      supportingAlerts,
      risk
    }
  };
}

// --- CRUD --------------------------------------------------------------------

const SELECT_COLUMNS = `
  d.id,
  d.declaration_uuid     AS declarationUuid,
  d.scope_type           AS scopeType,
  d.scope_id             AS scopeId,
  d.municipality_id      AS municipalityId,
  m.name                 AS municipality,
  d.barangay_id          AS barangayId,
  b.name                 AS barangay,
  d.disease,
  d.status,
  d.risk_score           AS riskScore,
  d.risk_severity        AS riskSeverity,
  d.risk_snapshot        AS riskSnapshot,
  d.forecast_snapshot    AS forecastSnapshot,
  d.supporting_alert_ids AS supportingAlertIds,
  d.notes,
  d.created_by           AS createdBy,
  d.declared_by          AS declaredBy,
  d.declared_at          AS declaredAt,
  d.lifted_by            AS liftedBy,
  d.lifted_at            AS liftedAt,
  d.created_at           AS createdAt,
  d.updated_at           AS updatedAt
`;

const BASE_FROM = `
  FROM outbreak_declarations d
  JOIN municipalities m ON m.id = d.municipality_id
  LEFT JOIN barangays b ON b.id = d.barangay_id
`;

function mapRow(row) {
  return {
    ...row,
    riskSnapshot: parseJson(row.riskSnapshot),
    forecastSnapshot: parseJson(row.forecastSnapshot),
    supportingAlertIds: parseJson(row.supportingAlertIds)
  };
}

async function logEvent(declarationId, eventType, actorUserId, payload) {
  await pool.query(
    `INSERT INTO outbreak_declaration_events (declaration_id, event_type, actor_user_id, payload)
     VALUES (?, ?, ?, ?)`,
    [declarationId, eventType, actorUserId ?? null, payload ? JSON.stringify(payload) : null]
  );
}

export async function listDeclarations(scope, filters = {}) {
  const clauses = [scope.where];
  const params = [...scope.params];

  if (filters.status) {
    const status = String(filters.status).toLowerCase();
    if (status !== "all") {
      if (!VALID_STATUS.has(status)) {
        return { error: { status: 400, body: { error: "Invalid status filter" } } };
      }
      clauses.push("d.status = ?");
      params.push(status);
    }
  }
  if (filters.disease) {
    const disease = String(filters.disease).toUpperCase();
    if (!VALID_DISEASE.has(disease)) {
      return { error: { status: 400, body: { error: "disease must be DENGUE, ILI, or AWD" } } };
    }
    clauses.push("d.disease = ?");
    params.push(disease);
  }

  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM}
     WHERE ${clauses.join(" AND ")}
     ORDER BY FIELD(d.status,'declared','recommended','draft','lifted','cancelled'),
              d.updated_at DESC, d.id DESC
     LIMIT 500`,
    params
  );
  return { declarations: rows.map(mapRow) };
}

async function findScopedDeclaration(scope, id) {
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE ${scope.where} AND d.id = ? LIMIT 1`,
    [...scope.params, id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getDeclaration(scope, id) {
  const declaration = await findScopedDeclaration(scope, id);
  if (!declaration) return { error: { status: 404, body: { error: "Declaration not found" } } };
  const [events] = await pool.query(
    `SELECT id, event_type AS eventType, actor_user_id AS actorUserId, payload, created_at AS createdAt
     FROM outbreak_declaration_events WHERE declaration_id = ? ORDER BY created_at ASC, id ASC`,
    [id]
  );
  return { declaration: { ...declaration, events: events.map((e) => ({ ...e, payload: parseJson(e.payload) })) } };
}

/**
 * Create a declaration record from a freshly-built brief. Status starts as
 * 'draft' (MHO) or 'recommended' (explicit recommendation).
 */
export async function createDeclaration(auth, body = {}) {
  const status = String(body.status ?? "draft").toLowerCase();
  if (!["draft", "recommended"].includes(status)) {
    return { error: { status: 400, body: { error: "New declarations start as draft or recommended" } } };
  }

  const target = await resolveScopeTarget(auth, body.scopeType, body.scopeId);
  if (target.error) return target;

  const built = await buildDecisionBrief(auth, {
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    disease: body.disease
  });
  if (built.error) return built;
  const brief = built.brief;

  const supportingAlertIds = brief.supportingAlerts.map((a) => a.id);
  const uuid = randomUUID();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) || null : null;

  const [ins] = await pool.query(
    `INSERT INTO outbreak_declarations (
       declaration_uuid, scope_type, scope_id, municipality_id, barangay_id, disease,
       status, risk_score, risk_severity, risk_snapshot, forecast_snapshot,
       supporting_alert_ids, notes, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid,
      target.scopeType,
      target.scopeId,
      target.municipalityId,
      target.barangayId,
      brief.disease,
      status,
      brief.risk.score,
      brief.risk.severity,
      JSON.stringify(brief.risk),
      brief.forecast ? JSON.stringify(brief.forecast) : null,
      JSON.stringify(supportingAlertIds),
      notes,
      auth?.sub ?? null
    ]
  );

  await logEvent(ins.insertId, status === "recommended" ? "recommended" : "created", auth?.sub, {
    riskScore: brief.risk.score,
    severity: brief.risk.severity
  });

  const scope = resolveDeclarationScope(auth);
  return getDeclaration(scope, ins.insertId);
}

/** Allowed status transitions for the declaration lifecycle. */
const TRANSITIONS = {
  draft: ["recommended", "declared", "cancelled"],
  recommended: ["declared", "cancelled", "draft"],
  declared: ["lifted"],
  lifted: [],
  cancelled: []
};

/**
 * Update a declaration: change status (with transition + RBAC checks) and/or
 * append notes. Only municipality (own municipality) and province (own province)
 * may mutate; barangay is read-only.
 */
export async function updateDeclaration(auth, scope, id, body = {}) {
  if (!["municipality", "province"].includes(auth?.role)) {
    return { error: { status: 403, body: { error: "Only MHO or PHO accounts can update declarations" } } };
  }
  const current = await findScopedDeclaration(scope, id);
  if (!current) return { error: { status: 404, body: { error: "Declaration not found" } } };

  const updates = [];
  const params = [];
  const events = [];

  if (typeof body.notes === "string") {
    updates.push("notes = ?");
    params.push(body.notes.trim().slice(0, 4000) || null);
  }

  if (body.status) {
    const next = String(body.status).toLowerCase();
    if (!VALID_STATUS.has(next)) {
      return { error: { status: 400, body: { error: "Invalid status" } } };
    }
    if (next !== current.status) {
      const allowed = TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(next)) {
        return {
          error: { status: 409, body: { error: `Cannot move from ${current.status} to ${next}` } }
        };
      }
      updates.push("status = ?");
      params.push(next);
      if (next === "declared") {
        updates.push("declared_by = ?", "declared_at = CURRENT_TIMESTAMP");
        params.push(auth.sub ?? null);
        events.push("declared");
      } else if (next === "lifted") {
        updates.push("lifted_by = ?", "lifted_at = CURRENT_TIMESTAMP");
        params.push(auth.sub ?? null);
        events.push("lifted");
      } else if (next === "recommended") {
        events.push("recommended");
      } else if (next === "cancelled") {
        events.push("cancelled");
      } else {
        events.push("updated");
      }
    }
  }

  if (updates.length === 0) {
    return { error: { status: 400, body: { error: "Nothing to update" } } };
  }

  await pool.query(`UPDATE outbreak_declarations SET ${updates.join(", ")} WHERE id = ?`, [...params, id]);
  for (const evt of events.length ? events : ["updated"]) {
    await logEvent(id, evt, auth.sub, body.status ? { status: body.status } : null);
  }

  return getDeclaration(scope, id);
}
