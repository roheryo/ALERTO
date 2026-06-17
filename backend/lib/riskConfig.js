/**
 * ALERTO shared risk-indicator configuration (authoritative copy).
 *
 * Single source of truth for outbreak-risk thresholds, forecast escalation,
 * and composite risk-score weighting used by the decision-support system.
 *
 * IMPORTANT: keep the literal values in sync with the frontend mirror
 * `src/lib/riskConfig.js`. The frontend can also hydrate these at runtime from
 * `GET /api/risk-config` (served from this module) to guarantee consistency.
 *
 * Historical thresholds previously duplicated in:
 *   - backend/services/alertEvaluator.js
 *   - src/lib/provincialSurveillance.js
 *   - src/pages/dashboard/MunicipalDashboard.jsx (FIXED_WINDOW_WEEKS)
 * now derive from here.
 */

/** Confirmed-case count over the rolling window that signals concern, per disease. */
export const COUNT_THRESHOLDS = { DENGUE: 10, ILI: 14, AWD: 8 };

/** Minimum absolute increase (current - prior window) for a velocity signal. */
export const VELOCITY_MIN_DELTA = 2;

/** Minimum percent increase for a watch-level velocity signal. */
export const VELOCITY_MIN_PCT = 40;

/** Rolling comparison window length, in weeks (current vs prior window). */
export const WINDOW_WEEKS = 4;

/** Diseases ALERTO models end-to-end. */
export const DISEASES = ["DENGUE", "ILI", "AWD"];

/**
 * Forecast escalation: when the LSTM 4-week forecast sum for a municipality
 * reaches `multiplier × COUNT_THRESHOLDS[disease]`, raise a forecast-driven
 * signal. Tunable via env FORECAST_ALERT_THRESHOLD_MULTIPLIER.
 */
export const FORECAST_ALERT_THRESHOLD_MULTIPLIER = Math.max(
  0.5,
  Number(process.env.FORECAST_ALERT_THRESHOLD_MULTIPLIER ?? 1.2) || 1.2
);

/**
 * Composite risk-score weights (must sum to 1.0). Each component contributes a
 * normalized 0–1 sub-score scaled by its weight, then multiplied by 100.
 */
export const RISK_WEIGHTS = {
  count: 0.35,
  velocity: 0.25,
  forecast: 0.25,
  environmental: 0.15
};

/**
 * Composite-score → severity bands. A score below `watch` is "normal".
 * Chosen so a locality exactly at its count threshold (count sub-score = 1.0,
 * 35 pts) lands in "watch", and threshold + sustained velocity reaches
 * "elevated"/"high".
 */
export const RISK_SCORE_BANDS = { watch: 25, elevated: 50, high: 70 };

/** Severity ranking helper shared across modules. */
export const SEVERITY_RANK = { normal: 0, watch: 1, elevated: 2, high: 3 };

/** Resolve the count threshold for a disease, defaulting to DENGUE's. */
export function thresholdForDisease(disease) {
  return COUNT_THRESHOLDS[String(disease).toUpperCase()] ?? COUNT_THRESHOLDS.DENGUE;
}

/** Serializable snapshot of the active config (for GET /api/risk-config). */
export function riskConfigPayload() {
  return {
    countThresholds: COUNT_THRESHOLDS,
    velocityMinDelta: VELOCITY_MIN_DELTA,
    velocityMinPct: VELOCITY_MIN_PCT,
    windowWeeks: WINDOW_WEEKS,
    diseases: DISEASES,
    forecastThresholdMultiplier: FORECAST_ALERT_THRESHOLD_MULTIPLIER,
    riskWeights: RISK_WEIGHTS,
    riskScoreBands: RISK_SCORE_BANDS
  };
}
