/**
 * Automated Early-Warning evaluation job.
 *
 * Closes the detect → persist loop on top of:
 *   - services/alertEvaluator.js  (detection)
 *   - services/alertStore.js      (dedup + persistence + expiry)
 *
 * Three entry points:
 *   1. Scheduled        — startAlertScheduler() runs runEvaluationForAll() on an
 *                         interval (wired in server.js, env-gated).
 *   2. On case ingest   — scheduleMunicipalityEvaluation() debounces a per-
 *                         municipality re-evaluation after POST /api/patients.
 *   3. Manual / CI      — `node jobs/evaluateAlerts.js [--municipality=ID]`
 *                         (npm run evaluate:alerts).
 */

import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

import { pool } from "../config/db.js";
import { evaluateMunicipalityAlerts } from "../services/alertEvaluator.js";
import { persistMunicipalityAlerts } from "../services/alertStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const DEFAULT_INTERVAL_MIN = Number(process.env.ALERT_EVAL_INTERVAL_MIN ?? 30);
const INGEST_DEBOUNCE_MS = Math.max(1000, Number(process.env.ALERT_INGEST_DEBOUNCE_MS ?? 10000) || 10000);

/** Pattern-only evaluation — never use LSTM forecast signals for alerts. */
const EVAL_OPTS = { withForecast: false };

/** Evaluate one municipality and persist the resulting candidate alerts. */
export async function runEvaluationForMunicipality(municipalityId, options = {}) {
  const id = Number(municipalityId);
  if (!Number.isFinite(id) || id < 1) {
    return { created: 0, updated: 0, expired: 0 };
  }
  const candidates = await evaluateMunicipalityAlerts(id, { ...EVAL_OPTS, ...options });
  return persistMunicipalityAlerts(id, candidates, options);
}

/** Evaluate every municipality in the database (scheduled / manual full sweep). */
export async function runEvaluationForAll(options = {}) {
  const [munis] = await pool.query(`SELECT id FROM municipalities ORDER BY id`);
  const totals = { created: 0, updated: 0, expired: 0, municipalities: munis.length };
  for (const { id } of munis) {
    const summary = await runEvaluationForMunicipality(id, options);
    totals.created += summary.created;
    totals.updated += summary.updated;
    totals.expired += summary.expired;
  }
  return totals;
}

// --- On-ingest debounce ------------------------------------------------------

const pendingTimers = new Map();

/**
 * Debounced, fire-and-forget re-evaluation for a single municipality. Multiple
 * case submissions for the same municipality within the debounce window collapse
 * into one evaluation. Never throws into the caller (logs and swallows errors).
 */
export function scheduleMunicipalityEvaluation(municipalityId, options = {}) {
  const id = Number(municipalityId);
  if (!Number.isFinite(id) || id < 1) return;

  const existing = pendingTimers.get(id);
  if (existing) clearTimeout(existing);

  const delay = options.debounceMs ?? INGEST_DEBOUNCE_MS;
  const timer = setTimeout(() => {
    pendingTimers.delete(id);
    runEvaluationForMunicipality(id).catch((err) => {
      console.warn(`[alerts] ingest re-eval failed for municipality ${id}:`, err.message);
    });
  }, delay);

  // Don't keep the process alive solely for a pending re-evaluation.
  if (typeof timer.unref === "function") timer.unref();
  pendingTimers.set(id, timer);
}

// --- Scheduled sweep ---------------------------------------------------------

/**
 * Start the recurring full-sweep evaluator. Returns a stop() handle.
 * Disabled when intervalMinutes <= 0 (returns a no-op handle).
 */
export function startAlertScheduler(intervalMinutes = DEFAULT_INTERVAL_MIN) {
  const minutes = Number(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log("[alerts] scheduler disabled (ALERT_EVAL_INTERVAL_MIN <= 0).");
    return { stop: () => {} };
  }

  const intervalMs = minutes * 60 * 1000;
  let running = false;

  const tick = async () => {
    if (running) return; // skip overlap if a sweep is still in progress
    running = true;
    try {
      const totals = await runEvaluationForAll();
      console.log(
        `[alerts] scheduled sweep: +${totals.created} new, ~${totals.updated} refreshed, ` +
          `-${totals.expired} expired across ${totals.municipalities} municipalities.`
      );
    } catch (err) {
      console.warn("[alerts] scheduled sweep failed:", err.message);
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, intervalMs);
  if (typeof handle.unref === "function") handle.unref();
  console.log(`[alerts] scheduler started — full sweep every ${minutes} min.`);
  return { stop: () => clearInterval(handle) };
}

// --- CLI ---------------------------------------------------------------------

function parseCliMunicipality() {
  const arg = process.argv.find((a) => a.startsWith("--municipality="));
  if (!arg) return null;
  const id = Number(arg.split("=")[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function mainCli() {
  const municipalityId = parseCliMunicipality();
  if (municipalityId) {
    const summary = await runEvaluationForMunicipality(municipalityId);
    console.log(`[alerts] municipality ${municipalityId}:`, summary);
  } else {
    const totals = await runEvaluationForAll();
    console.log("[alerts] full sweep:", totals);
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  mainCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[alerts] evaluation job FATAL:", err);
      process.exit(1);
    });
}
