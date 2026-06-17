/**
 * Server-side outbreak-risk evaluator for the ALERTO Early-Warning module.
 *
 * This is the authoritative, server-generated mirror of the client-side
 * surveillance math. Keep the thresholds and level semantics here in sync with:
 *   - src/lib/provincialSurveillance.js  (COUNT_THRESHOLDS, VELOCITY_MIN_DELTA,
 *                                         VELOCITY_MIN_PCT, alertLevelForRow)
 *   - src/lib/surveillance.js            (getComparisonWindows, computeBarangayVelocityRows,
 *                                         computePctChange)
 *   - src/lib/disease.js                 (isConfirmedCase, normalizeDisease, parseCaseDate)
 *
 * The pure `evaluateBarangayAlerts()` function has no DB dependency so it can be
 * unit-tested with plain patient objects. The DB-backed helpers below load
 * confirmed cases from MySQL and feed them into the same pure function.
 */

import { pool } from "../config/db.js";
import {
  COUNT_THRESHOLDS,
  DISEASES,
  VELOCITY_MIN_DELTA,
  VELOCITY_MIN_PCT,
  WINDOW_WEEKS
} from "../lib/riskConfig.js";

// Thresholds now live in backend/lib/riskConfig.js (single source of truth,
// mirrored by src/lib/riskConfig.js). Re-exported here for backwards-compat
// with existing importers.
export { COUNT_THRESHOLDS, VELOCITY_MIN_DELTA, VELOCITY_MIN_PCT, WINDOW_WEEKS, DISEASES };

// --- Pure helpers (mirrors of src/lib) ---------------------------------------

/** Mirror of src/lib/disease.js normalizeDisease. */
export function normalizeDisease(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) {
    return "AWD";
  }
  if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) {
    return "ILI";
  }
  if (v.includes("dengue")) {
    return "DENGUE";
  }
  return v.toUpperCase();
}

/** Mirror of src/lib/disease.js isConfirmedCase. */
export function isConfirmedCase(patient) {
  return String(patient?.caseClassification ?? "").trim().toLowerCase() === "confirmed";
}

/** Mirror of src/lib/disease.js parseCaseDate. */
function parseCaseDate(patient) {
  const raw =
    patient?.dateStarted ??
    patient?.dateReported ??
    patient?.reportDate ??
    patient?.createdAt ??
    patient?.date;
  if (raw == null || raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mirror of src/lib/surveillance.js computePctChange. */
export function computePctChange(current, prior) {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Mirror of src/lib/surveillance.js getComparisonWindows. */
export function getComparisonWindows(weekCount = WINDOW_WEEKS, referenceDate = new Date()) {
  const weeks = Math.max(1, Number(weekCount) || WINDOW_WEEKS);
  const spanDays = weeks * 7;
  const ref = new Date(referenceDate);

  const currentEnd = endOfDay(ref);
  const currentStart = startOfDay(ref);
  currentStart.setDate(currentStart.getDate() - (spanDays - 1));

  const priorEnd = new Date(currentStart);
  priorEnd.setDate(priorEnd.getDate() - 1);
  priorEnd.setHours(23, 59, 59, 999);

  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (spanDays - 1));
  priorStart.setHours(0, 0, 0, 0);

  return {
    weeks,
    current: { start: currentStart, end: currentEnd },
    prior: { start: priorStart, end: priorEnd }
  };
}

/**
 * Classify an outbreak-risk level from a per-locality count snapshot.
 * Mirror of alertLevelForRow in src/lib/provincialSurveillance.js, but resolves
 * the threshold per concrete disease (the evaluator never runs on "ALL").
 *
 * @returns {{ severity: "watch"|"elevated"|"high"|"normal", triggerType: string }}
 */
export function classifyAlertLevel({ current, delta, pctChange }, disease) {
  const threshold = COUNT_THRESHOLDS[String(disease).toUpperCase()] ?? 10;

  if (current >= threshold && delta >= VELOCITY_MIN_DELTA) {
    return { severity: "high", triggerType: "combined" };
  }
  if (current >= threshold) {
    return { severity: "elevated", triggerType: "count" };
  }
  if (delta >= VELOCITY_MIN_DELTA) {
    return { severity: "elevated", triggerType: "velocity" };
  }
  if (pctChange >= VELOCITY_MIN_PCT && delta > 0 && current >= 2) {
    return { severity: "watch", triggerType: "velocity" };
  }
  return { severity: "normal", triggerType: null };
}

/**
 * Evaluate outbreak-risk alerts for one locality grain (barangay × disease).
 *
 * Pure and DB-free: pass in confirmed (or raw) case rows and it returns the
 * candidate alerts that breach watch/elevated/high. Suspect / probable cases
 * are ignored (confirmed-only, matching the dashboards).
 *
 * @param {object[]} patients  Case rows. Recognized fields per row:
 *   { barangayId, barangay, municipalityId, municipality, diseaseType,
 *     caseClassification, dateStarted|dateReported|createdAt|date }
 * @param {object} [options]
 * @param {number} [options.windowWeeks=4]
 * @param {Date}   [options.referenceDate=new Date()]
 * @param {string[]} [options.diseases=DISEASES]
 * @param {boolean} [options.requireConfirmed=true]
 * @returns {Array<{
 *   municipalityId: number|null, barangayId: number|null,
 *   barangay: string, municipality: string,
 *   disease: string, severity: string, triggerType: string,
 *   snapshot: { current, prior, delta, pctChange, threshold, windowWeeks }
 * }>}
 */
export function evaluateBarangayAlerts(patients, options = {}) {
  const {
    windowWeeks = WINDOW_WEEKS,
    referenceDate = new Date(),
    diseases = DISEASES,
    requireConfirmed = true
  } = options;

  if (!Array.isArray(patients) || patients.length === 0) return [];

  const diseaseSet = new Set(diseases.map((d) => String(d).toUpperCase()));
  const windows = getComparisonWindows(windowWeeks, referenceDate);
  const currentStart = windows.current.start.getTime();
  const currentEnd = windows.current.end.getTime();
  const priorStart = windows.prior.start.getTime();
  const priorEnd = windows.prior.end.getTime();

  // Tally current / prior counts keyed by (barangayId|disease), carrying labels.
  const tallies = new Map();

  for (const p of patients) {
    if (requireConfirmed && !isConfirmedCase(p)) continue;

    const disease = normalizeDisease(p?.diseaseType);
    if (!diseaseSet.has(disease)) continue;

    const dt = parseCaseDate(p);
    if (!dt) continue;
    const time = dt.getTime();

    const inCurrent = time >= currentStart && time <= currentEnd;
    const inPrior = time >= priorStart && time <= priorEnd;
    if (!inCurrent && !inPrior) continue;

    const barangayId = p?.barangayId ?? null;
    const key = `${barangayId ?? p?.barangay ?? ""}|${disease}`;

    let row = tallies.get(key);
    if (!row) {
      row = {
        barangayId,
        barangay: String(p?.barangay ?? "").trim(),
        municipalityId: p?.municipalityId ?? null,
        municipality: String(p?.municipality ?? "").trim(),
        disease,
        current: 0,
        prior: 0
      };
      tallies.set(key, row);
    }
    if (inCurrent) row.current += 1;
    else row.prior += 1;
  }

  const alerts = [];
  for (const row of tallies.values()) {
    const delta = row.current - row.prior;
    const pctChange = computePctChange(row.current, row.prior);
    const { severity, triggerType } = classifyAlertLevel(
      { current: row.current, delta, pctChange },
      row.disease
    );
    if (severity === "normal") continue;

    alerts.push({
      municipalityId: row.municipalityId,
      barangayId: row.barangayId,
      barangay: row.barangay,
      municipality: row.municipality,
      disease: row.disease,
      severity,
      triggerType,
      snapshot: {
        current: row.current,
        prior: row.prior,
        delta,
        pctChange: Number(pctChange.toFixed(1)),
        threshold: COUNT_THRESHOLDS[row.disease] ?? null,
        windowWeeks
      }
    });
  }

  // Most urgent first: high → elevated → watch, then by current count.
  const severityRank = { high: 3, elevated: 2, watch: 1 };
  alerts.sort(
    (a, b) =>
      (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) ||
      b.snapshot.current - a.snapshot.current
  );

  return alerts;
}

// --- DB-backed helpers -------------------------------------------------------

/**
 * Load confirmed cases for a municipality covering the comparison window plus
 * its prior window (windowWeeks * 2), with a small buffer for date skew.
 */
async function fetchConfirmedCasesForMunicipality(municipalityId, options = {}) {
  const windowWeeks = options.windowWeeks ?? WINDOW_WEEKS;
  const referenceDate = options.referenceDate ?? new Date();
  const windows = getComparisonWindows(windowWeeks, referenceDate);

  // Pad the lower bound by one extra week so boundary cases are never missed.
  const since = new Date(windows.prior.start);
  since.setDate(since.getDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);

  const [rows] = await pool.query(
    `SELECT
        p.barangay_id        AS barangayId,
        b.name               AS barangay,
        p.municipality_id    AS municipalityId,
        m.name               AS municipality,
        p.disease_type       AS diseaseType,
        p.case_classification AS caseClassification,
        DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
        p.created_at         AS createdAt
      FROM patients p
      JOIN municipalities m ON m.id = p.municipality_id
      JOIN barangays b      ON b.id = p.barangay_id
      WHERE p.municipality_id = ?
        AND p.case_classification = 'Confirmed'
        AND COALESCE(p.date_started, DATE(p.created_at)) >= ?`,
    [municipalityId, sinceStr]
  );
  return rows;
}

// Severity bump applied when a disease is also in LSTM forecast exceedance.
const SEVERITY_ESCALATION = { watch: "elevated", elevated: "high", high: "high" };

/**
 * Fold municipality-level LSTM forecasts into per-barangay candidates.
 * Forecasts are municipality-grained, so every barangay candidate of a disease
 * in exceedance has its snapshot enriched, its trigger_type promoted to
 * 'combined', and (for exceedance) its severity escalated one level.
 */
export function applyForecastToCandidates(candidates, forecastsByDisease) {
  if (!forecastsByDisease || Object.keys(forecastsByDisease).length === 0) return candidates;
  return candidates.map((c) => {
    const fc = forecastsByDisease[c.disease];
    if (!fc) return c;
    const snapshot = {
      ...c.snapshot,
      forecastSum: fc.forecastSum,
      forecastPeak: fc.forecastPeak,
      forecastAsOf: fc.asOfWeek,
      forecastExceedance: fc.exceedance
    };
    if (!fc.exceedance) return { ...c, snapshot };
    return {
      ...c,
      severity: SEVERITY_ESCALATION[c.severity] ?? c.severity,
      triggerType: "combined",
      snapshot
    };
  });
}

/**
 * Evaluate one municipality against the DB and return candidate alerts.
 * Candidates are not persisted here — that is the job/persistence layer.
 *
 * When `options.withForecast !== false` and the ML service is reachable, the
 * candidates are enriched with the LSTM 4-week forecast (trigger_type may become
 * 'combined' and severity may escalate). ML failures degrade silently.
 */
export async function evaluateMunicipalityAlerts(municipalityId, options = {}) {
  const id = Number(municipalityId);
  if (!Number.isFinite(id) || id < 1) return [];
  const cases = await fetchConfirmedCasesForMunicipality(id, options);
  const candidates = evaluateBarangayAlerts(cases, { ...options, requireConfirmed: false });
  if (options.withForecast === false) return candidates;
  try {
    const { evaluateMunicipalityForecasts } = await import("./forecastEvaluator.js");
    const forecasts = await evaluateMunicipalityForecasts(id, options);
    return applyForecastToCandidates(candidates, forecasts);
  } catch {
    return candidates;
  }
}

/** Evaluate every municipality in the database. */
export async function evaluateAllMunicipalities(options = {}) {
  const [munis] = await pool.query(`SELECT id FROM municipalities ORDER BY id`);
  const results = [];
  for (const { id } of munis) {
    const alerts = await evaluateMunicipalityAlerts(id, options);
    results.push(...alerts);
  }
  return results;
}
