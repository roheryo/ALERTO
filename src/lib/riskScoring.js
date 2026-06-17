/**
 * Composite outbreak-risk scoring (frontend mirror of backend/lib/riskScoring.js).
 *
 * Keep this logic identical to the backend module. Used by the municipal
 * declaration workspace and dashboard risk indicators so the UI shows the same
 * score the server persists on a declaration.
 */

import {
  RISK_SCORE_BANDS,
  RISK_WEIGHTS,
  VELOCITY_MIN_DELTA,
  VELOCITY_MIN_PCT,
  thresholdForDisease
} from "./riskConfig";

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function countSubScore(current, threshold) {
  if (!Number.isFinite(current) || current <= 0 || !threshold) return 0;
  return clamp01(current / threshold);
}

export function velocitySubScore(delta, pctChange) {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const absComponent = clamp01(delta / (VELOCITY_MIN_DELTA * 2));
  const pctComponent = clamp01(pctChange / (VELOCITY_MIN_PCT * 2));
  return clamp01(0.6 * absComponent + 0.4 * pctComponent);
}

export function forecastSubScore(forecastSum, threshold) {
  if (!Number.isFinite(forecastSum) || forecastSum <= 0 || !threshold) return 0;
  return clamp01(forecastSum / threshold);
}

export function environmentalSubScore(environmental) {
  if (environmental == null) return 0;
  if (typeof environmental === "number") return clamp01(environmental);
  const { positiveFlags, totalFlags } = environmental;
  if (!Number.isFinite(totalFlags) || totalFlags <= 0) return 0;
  return clamp01((Number(positiveFlags) || 0) / totalFlags);
}

export function severityFromScore(score) {
  if (score >= RISK_SCORE_BANDS.high) return "high";
  if (score >= RISK_SCORE_BANDS.elevated) return "elevated";
  if (score >= RISK_SCORE_BANDS.watch) return "watch";
  return "normal";
}

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
