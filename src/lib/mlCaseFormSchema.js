/**
 * Report-case fields that feed the LSTM training pipeline
 * (see ml/config.yaml + backend/scripts/build-ml-datasets.mjs).
 *
 * Weekly model features are aggregated from per-case rows — not every
 * collected field is a direct LSTM column, but each maps to training data.
 */

/** Disease codes trained by the LSTM (normalized uppercase). */
export const ML_DISEASE_CODES = ["DENGUE", "ILI", "AWD"];

/** Per-case → weekly surveillance aggregation (case_count, barangay_count_reporting). */
export const ML_SURVEILLANCE_FIELDS = [
  { formKey: "disease", pipeline: "disease_code / case_count" },
  { formKey: "dOnset", pipeline: "date_onset → ISO week" },
  { formKey: "caseClass", pipeline: "case_classification (Confirmed for training)" }
];

/** Geography → barangay_count_reporting per municipality-week. */
export const ML_GEOGRAPHY_FIELDS = [
  { formKey: "municipality", pipeline: "municipality_id" },
  { formKey: "barangay", pipeline: "barangay_id" }
];

/**
 * Environmental factors → case_environmental → pct_*_4wk features
 * (pct_stagnant_water_4wk, pct_recent_heavy_rain_4wk, etc.).
 */
export const ML_ENVIRONMENT_FIELDS = [
  { formKey: "stagnantWater", pipeline: "pct_stagnant_water_4wk" },
  { formKey: "recentRain", pipeline: "pct_recent_heavy_rain_4wk" },
  { formKey: "crowding", pipeline: "pct_indoor_crowding_4wk" },
  { formKey: "washWater", pipeline: "pct_unimproved_water_4wk" },
  { formKey: "washSanitation", pipeline: "pct_open_defecation_4wk" },
  { formKey: "floodHistory", pipeline: "pct_flood_history_4wk" },
  { formKey: "droughtHistory", pipeline: "pct_drought_history_4wk" }
];

/** Non-model fields kept for operations / audit (not LSTM columns). */
export const CASE_AUDIT_FIELDS = [
  { formKey: "patientNum", purpose: "Facility case ID (patient_number)" },
  { formKey: "reporterLabel", purpose: "Optional display label for the API name field" },
  { formKey: "dEntry", purpose: "Report date (server also stores created_at)" }
];

export const FORM_STEP_LABELS = ["Surveillance", "Location", "Environment", "Review"];
