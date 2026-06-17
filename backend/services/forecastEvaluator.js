/**
 * Forecast-driven outbreak-risk evaluation.
 *
 * Bridges the LSTM inference service (ml/serve/main.py via ML_SERVICE_URL) into
 * the Early-Warning module. The DB schema already supports
 * `trigger_type = 'forecast'` (migration 15) but the count/velocity evaluator
 * in alertEvaluator.js does not call the model — this module adds that.
 *
 * A forecast signal fires when the projected 4-week case sum for a municipality
 * reaches `FORECAST_ALERT_THRESHOLD_MULTIPLIER × COUNT_THRESHOLDS[disease]`.
 * Forecasts are municipality-grained (the LSTM has no barangay model), so these
 * candidates carry a municipalityId but no barangayId and are surfaced as
 * municipality-level outlook rather than persisted per-barangay alerts.
 */

import {
  DISEASES,
  FORECAST_ALERT_THRESHOLD_MULTIPLIER,
  thresholdForDisease
} from "../lib/riskConfig.js";

const ML_SERVICE_URL = String(process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000").replace(/\/+$/, "");
const ML_TIMEOUT_MS = Math.max(1000, Number(process.env.ML_TIMEOUT_MS ?? 8000) || 8000);

/** Call the ML service /predict endpoint; resolves to null on any failure. */
async function fetchForecast(municipalityId, disease) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ municipality_id: municipalityId, disease })
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Summarize a /predict response into { sum, peak, asOfWeek, steps }. */
export function summarizeForecast(prediction) {
  const steps = Array.isArray(prediction?.forecast) ? prediction.forecast : [];
  let sum = 0;
  let peak = 0;
  for (const s of steps) {
    const v = Number(s?.predicted_cases) || 0;
    sum += v;
    if (v > peak) peak = v;
  }
  return { sum, peak, asOfWeek: prediction?.as_of_week ?? null, steps };
}

/**
 * Evaluate one (municipality, disease) against its LSTM forecast.
 * @returns {Promise<null | {
 *   municipalityId, disease, forecastSum, forecastPeak, threshold,
 *   exceedance: boolean, asOfWeek, forecast
 * }>}
 */
export async function evaluateForecastTrigger(municipalityId, disease) {
  const id = Number(municipalityId);
  const code = String(disease).toUpperCase();
  if (!Number.isFinite(id) || id < 1 || !DISEASES.includes(code)) return null;

  const prediction = await fetchForecast(id, code);
  if (!prediction) return null;

  const { sum, peak, asOfWeek, steps } = summarizeForecast(prediction);
  const threshold = thresholdForDisease(code);
  const escalateAt = threshold * FORECAST_ALERT_THRESHOLD_MULTIPLIER;

  return {
    municipalityId: id,
    disease: code,
    forecastSum: sum,
    forecastPeak: peak,
    threshold,
    escalateAt,
    exceedance: sum >= escalateAt,
    asOfWeek,
    forecast: steps
  };
}

/**
 * Evaluate all diseases for a municipality. Returns a map keyed by disease code
 * (so the risk-scoring / declaration layers can fold forecast into the score).
 * Failures (ML offline) yield an empty map — callers degrade gracefully.
 */
export async function evaluateMunicipalityForecasts(municipalityId, options = {}) {
  const diseases = options.diseases ?? DISEASES;
  const out = {};
  await Promise.all(
    diseases.map(async (d) => {
      const result = await evaluateForecastTrigger(municipalityId, d);
      if (result) out[d] = result;
    })
  );
  return out;
}
