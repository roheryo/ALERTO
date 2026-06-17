/**
 * Composite outbreak-risk scoring for the ALERTO decision-support system.
 *
 * Pure and dependency-free so it can be unit-tested and reused by the alert
 * evaluator, declaration service, and (mirrored) the frontend workspace.
 *
 * The score (0–100) blends four explainable components:
 *   1. Count       — confirmed cases in window vs the per-disease threshold
 *   2. Velocity    — week-over-window acceleration (delta + pct change)
 *   3. Forecast    — LSTM 4-week projected sum vs the threshold (optional)
 *   4. Environmental — WASH / climate risk-flag rate from case_environmental (optional)
 *
 * Keep this logic identical to the frontend mirror src/lib/riskScoring.js.
 */

import {
  RISK_SCORE_BANDS,
  RISK_WEIGHTS,
  VELOCITY_MIN_DELTA,
  VELOCITY_MIN_PCT,
  thresholdForDisease
} from "./riskConfig.js";

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Count sub-score: linear ramp to the disease threshold, capped at 1.0. */
export function countSubScore(current, threshold) {
  if (!Number.isFinite(current) || current <= 0 || !threshold) return 0;
  return clamp01(current / threshold);
}

/**
 * Velocity sub-score: blends absolute acceleration (delta) and relative
 * acceleration (pctChange). Reaches ~1.0 at 2× the configured delta minimum
 * with a strong percent rise.
 */
export function velocitySubScore(delta, pctChange) {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const absComponent = clamp01(delta / (VELOCITY_MIN_DELTA * 2));
  const pctComponent = clamp01(pctChange / (VELOCITY_MIN_PCT * 2));
  return clamp01(0.6 * absComponent + 0.4 * pctComponent);
}

/** Forecast sub-score: projected 4-week sum vs the disease threshold. */
export function forecastSubScore(forecastSum, threshold) {
  if (!Number.isFinite(forecastSum) || forecastSum <= 0 || !threshold) return 0;
  return clamp01(forecastSum / threshold);
}

/**
 * Environmental sub-score: rate of risk-positive WASH/climate factors among
 * cases in the window (0–1). Accepts either a precomputed rate or a tally.
 */
export function environmentalSubScore(environmental) {
  if (environmental == null) return 0;
  if (typeof environmental === "number") return clamp01(environmental);
  const { positiveFlags, totalFlags } = environmental;
  if (!Number.isFinite(totalFlags) || totalFlags <= 0) return 0;
  return clamp01((Number(positiveFlags) || 0) / totalFlags);
}

/** Map a 0–100 composite score to an ALERTO severity band. */
export function severityFromScore(score) {
  if (score >= RISK_SCORE_BANDS.high) return "high";
  if (score >= RISK_SCORE_BANDS.elevated) return "elevated";
  if (score >= RISK_SCORE_BANDS.watch) return "watch";
  return "normal";
}

/**
 * Compute the composite risk score and its explainable factor breakdown.
 *
 * @param {object} input
 * @param {string} input.disease                DENGUE | ILI | AWD
 * @param {number} input.current                Confirmed cases in current window
 * @param {number} [input.prior]                Confirmed cases in prior window
 * @param {number} [input.delta]                current - prior (derived if omitted)
 * @param {number} [input.pctChange]            Percent change (derived if omitted)
 * @param {number} [input.forecastSum]          LSTM 4-week projected total
 * @param {number} [input.forecastPeak]         LSTM peak weekly value (metadata)
 * @param {number|object} [input.environmental] Rate (0–1) or { positiveFlags, totalFlags }
 * @returns {{
 *   score: number, severity: string, threshold: number,
 *   components: object, factors: Array<{ key, label, points, weight, detail }>
 * }}
 */
export function computeRiskScore(input = {}) {
  const disease = String(input.disease ?? "DENGUE").toUpperCase();
  const threshold = thresholdForDisease(disease);

  const current = Number(input.current) || 0;
  const prior = Number(input.prior) || 0;
  const delta = Number.isFinite(input.delta) ? input.delta : current - prior;
  const pctChange = Number.isFinite(input.pctChange)
    ? input.pctChange
    : prior === 0
      ? current > 0
        ? 100
        : 0
      : ((current - prior) / prior) * 100;

  const subScores = {
    count: countSubScore(current, threshold),
    velocity: velocitySubScore(delta, pctChange),
    forecast: forecastSubScore(Number(input.forecastSum), threshold),
    environmental: environmentalSubScore(input.environmental)
  };

  const hasForecast = Number.isFinite(input.forecastSum);
  const hasEnvironmental = input.environmental != null;

  // Redistribute weight from absent components so a locality without forecast
  // or environmental data is not unfairly capped at a low score.
  const activeWeights = { ...RISK_WEIGHTS };
  if (!hasForecast) activeWeights.forecast = 0;
  if (!hasEnvironmental) activeWeights.environmental = 0;
  const weightSum =
    activeWeights.count + activeWeights.velocity + activeWeights.forecast + activeWeights.environmental;
  const norm = weightSum > 0 ? 1 / weightSum : 0;

  const points = {
    count: subScores.count * activeWeights.count * norm * 100,
    velocity: subScores.velocity * activeWeights.velocity * norm * 100,
    forecast: subScores.forecast * activeWeights.forecast * norm * 100,
    environmental: subScores.environmental * activeWeights.environmental * norm * 100
  };

  const score = Math.round(points.count + points.velocity + points.forecast + points.environmental);

  const factors = [
    {
      key: "count",
      label: "Case count vs threshold",
      points: Math.round(points.count),
      weight: RISK_WEIGHTS.count,
      detail: `${current} confirmed in window (threshold ${threshold})`
    },
    {
      key: "velocity",
      label: "Case velocity",
      points: Math.round(points.velocity),
      weight: RISK_WEIGHTS.velocity,
      detail: `Δ ${delta >= 0 ? "+" : ""}${delta} vs prior (${pctChange >= 0 ? "+" : ""}${Number(
        pctChange
      ).toFixed(0)}%)`
    },
    {
      key: "forecast",
      label: "4-week forecast",
      points: Math.round(points.forecast),
      weight: RISK_WEIGHTS.forecast,
      detail: hasForecast
        ? `Projected ${Math.round(Number(input.forecastSum))} cases (threshold ${threshold})`
        : "No forecast available"
    },
    {
      key: "environmental",
      label: "Environmental factors",
      points: Math.round(points.environmental),
      weight: RISK_WEIGHTS.environmental,
      detail: hasEnvironmental
        ? `${Math.round(subScores.environmental * 100)}% of WASH/climate flags positive`
        : "No environmental data"
    }
  ];

  return {
    score,
    severity: severityFromScore(score),
    threshold,
    current,
    prior,
    delta,
    pctChange: Number(Number(pctChange).toFixed(1)),
    forecastSum: hasForecast ? Math.round(Number(input.forecastSum)) : null,
    forecastPeak: Number.isFinite(input.forecastPeak) ? Math.round(input.forecastPeak) : null,
    components: subScores,
    factors
  };
}
