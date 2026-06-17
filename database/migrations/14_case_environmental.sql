-- Per-case environmental / WASH factors collected from the BHU report form.
-- One row per patient (1:1). Drives the new environmental features used by the
-- LSTM model (pct_stagnant_water, pct_unimproved_water, etc.).
--
-- Idempotent: safe to run on a database where the table already exists.
USE ALERTO;

CREATE TABLE IF NOT EXISTS case_environmental (
  patient_id INT UNSIGNED NOT NULL,
  -- Vector / dengue / ILI risk flags
  stagnant_water TINYINT(1) NOT NULL DEFAULT 0,
  recent_heavy_rain TINYINT(1) NOT NULL DEFAULT 0,
  indoor_crowding TINYINT(1) NOT NULL DEFAULT 0,
  -- WASH categorical (matches form values: piped|shared|unimproved|none / flush|pit|open|none)
  wash_water_source VARCHAR(20) NULL DEFAULT NULL,
  wash_sanitation   VARCHAR(20) NULL DEFAULT NULL,
  -- Hydrometeorological history flags
  flood_history_4wk TINYINT(1) NOT NULL DEFAULT 0,
  drought_water_shortage TINYINT(1) NOT NULL DEFAULT 0,
  -- Free-text exposure narrative (not used by LSTM but kept for outbreak investigation)
  exposure_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_id),
  CONSTRAINT fk_case_env_patient
    FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
