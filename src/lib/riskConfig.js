/**
 * ALERTO shared risk-indicator configuration (frontend mirror).
 *
 * Mirrors backend/lib/riskConfig.js. Keep the literal values in sync. These are
 * the static defaults; UI may hydrate the live server config from
 * `GET /api/risk-config` (see src/hooks/useRiskConfig.js) when exact parity with
 * a tuned backend is required.
 */

export const COUNT_THRESHOLDS = { DENGUE: 10, ILI: 14, AWD: 8 };
export const VELOCITY_MIN_DELTA = 2;
export const VELOCITY_MIN_PCT = 40;
export const WINDOW_WEEKS = 4;
export const DISEASES = ["DENGUE", "ILI", "AWD"];
export const FORECAST_ALERT_THRESHOLD_MULTIPLIER = 1.2;

export const RISK_WEIGHTS = {
  count: 0.35,
  velocity: 0.25,
  forecast: 0.25,
  environmental: 0.15
};

export const RISK_SCORE_BANDS = { watch: 25, elevated: 50, high: 70 };

export const SEVERITY_RANK = { normal: 0, watch: 1, elevated: 2, high: 3 };

export function thresholdForDisease(disease) {
  return COUNT_THRESHOLDS[String(disease).toUpperCase()] ?? COUNT_THRESHOLDS.DENGUE;
}
