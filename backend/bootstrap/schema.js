import { pool } from "../config/db.js";

/** Zero-padded incremental patient number when the form field is left blank. */
export function formatAutoPatientNumber(id) {
  return String(id).padStart(6, "0");
}

/** Ensure patient_number exists (idempotent; matches database/migrations/09_patients_patient_number.sql). */
export async function ensurePatientNumberColumn() {
  try {
    await pool.query(
      `ALTER TABLE patients ADD COLUMN patient_number VARCHAR(40) NULL DEFAULT NULL AFTER name`
    );
    await pool.query(
      `UPDATE patients SET patient_number = LPAD(id, 6, '0')
       WHERE patient_number IS NULL OR patient_number = ''`
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") {
      console.warn("[ALERTO API] patient_number column check:", err.message);
    }
  }
}

export async function persistPatientNumber(patientId, patientNumber) {
  try {
    await pool.query(`UPDATE patients SET patient_number = ? WHERE id = ?`, [patientNumber, patientId]);
    return true;
  } catch (err) {
    if (err?.code === "ER_BAD_FIELD_ERROR") return false;
    throw err;
  }
}

/** Normalize Report Case caseClass to Suspect | Probable | Confirmed. */
export function normalizeCaseClassification(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "suspect") return "Suspect";
  if (s === "probable") return "Probable";
  if (s === "confirmed") return "Confirmed";
  const t = String(raw ?? "").trim();
  return t ? t.slice(0, 40) : null;
}

/** Ensure case_classification exists (idempotent; matches database/migrations/08_patients_case_fields.sql). */
export async function ensureCaseClassificationColumn() {
  try {
    await pool.query(
      `ALTER TABLE patients ADD COLUMN case_classification VARCHAR(40) NULL DEFAULT NULL AFTER disease_type`
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") {
      console.warn("[ALERTO API] case_classification column check:", err.message);
    }
  }
  try {
    await pool.query(
      `ALTER TABLE patients ADD COLUMN case_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER case_classification`
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") {
      console.warn("[ALERTO API] case_status column check:", err.message);
    }
  }
}

export async function persistCaseClassification(patientId, caseClassification) {
  if (!caseClassification) return false;
  try {
    await pool.query(`UPDATE patients SET case_classification = ? WHERE id = ?`, [
      caseClassification,
      patientId
    ]);
    return true;
  } catch (err) {
    if (err?.code === "ER_BAD_FIELD_ERROR") return false;
    throw err;
  }
}

const CASE_ENVIRONMENTAL_CREATE_SQL = `
  CREATE TABLE case_environmental (
    patient_id INT UNSIGNED NOT NULL,
    stagnant_water TINYINT(1) NOT NULL DEFAULT 0,
    recent_heavy_rain TINYINT(1) NOT NULL DEFAULT 0,
    indoor_crowding TINYINT(1) NOT NULL DEFAULT 0,
    wash_water_source VARCHAR(20) NULL DEFAULT NULL,
    wash_sanitation   VARCHAR(20) NULL DEFAULT NULL,
    flood_history_4wk TINYINT(1) NOT NULL DEFAULT 0,
    drought_water_shortage TINYINT(1) NOT NULL DEFAULT 0,
    exposure_notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (patient_id),
    CONSTRAINT fk_case_env_patient
      FOREIGN KEY (patient_id) REFERENCES patients (id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/** Idempotent case_environmental table (matches migration 14). Stores per-case
 *  WASH / environmental factors that feed the LSTM environmental features. */
export async function ensureCaseEnvironmentalTable() {
  try {
    await pool.query(CASE_ENVIRONMENTAL_CREATE_SQL);
  } catch (err) {
    if (err?.code !== "ER_TABLE_EXISTS_ERROR") {
      console.warn("[ALERTO API] case_environmental bootstrap:", err.message);
    }
  }
}

/** Form values accepted: piped|shared|unimproved|none / flush|pit|open|none. */
const WATER_SOURCE_VALUES = new Set(["piped", "shared", "unimproved", "none"]);
const SANITATION_VALUES = new Set(["flush", "pit", "open", "none"]);

function normalizeEnumValue(raw, allowed) {
  const v = String(raw ?? "").trim().toLowerCase();
  return allowed.has(v) ? v : null;
}

/** Upsert per-case environmental fields. Silently no-ops if `case_environmental`
 *  table is missing (e.g. older schema). */
export async function persistCaseEnvironment(patientId, env) {
  if (!patientId || !env || typeof env !== "object") return false;
  const row = {
    stagnant_water: env.stagnantWater ? 1 : 0,
    recent_heavy_rain: env.recentRain ? 1 : 0,
    indoor_crowding: env.crowding ? 1 : 0,
    wash_water_source: normalizeEnumValue(env.washWater, WATER_SOURCE_VALUES),
    wash_sanitation: normalizeEnumValue(env.washSanitation, SANITATION_VALUES),
    flood_history_4wk: env.floodHistory ? 1 : 0,
    drought_water_shortage: env.droughtHistory ? 1 : 0,
    exposure_notes: typeof env.exposureNotes === "string"
      ? env.exposureNotes.trim().slice(0, 2000) || null
      : null
  };
  try {
    await pool.query(
      `INSERT INTO case_environmental (
         patient_id, stagnant_water, recent_heavy_rain, indoor_crowding,
         wash_water_source, wash_sanitation, flood_history_4wk,
         drought_water_shortage, exposure_notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stagnant_water = VALUES(stagnant_water),
         recent_heavy_rain = VALUES(recent_heavy_rain),
         indoor_crowding = VALUES(indoor_crowding),
         wash_water_source = VALUES(wash_water_source),
         wash_sanitation = VALUES(wash_sanitation),
         flood_history_4wk = VALUES(flood_history_4wk),
         drought_water_shortage = VALUES(drought_water_shortage),
         exposure_notes = VALUES(exposure_notes)`,
      [
        patientId,
        row.stagnant_water,
        row.recent_heavy_rain,
        row.indoor_crowding,
        row.wash_water_source,
        row.wash_sanitation,
        row.flood_history_4wk,
        row.drought_water_shortage,
        row.exposure_notes
      ]
    );
    return true;
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE" || err?.code === "ER_BAD_FIELD_ERROR") {
      console.warn(
        "[ALERTO API] case_environmental write skipped (run migration 14):",
        err.message
      );
      return false;
    }
    throw err;
  }
}

export async function bootstrapSchema() {
  await Promise.all([
    ensurePatientNumberColumn(),
    ensureCaseClassificationColumn(),
    ensureCaseEnvironmentalTable()
  ]);
}
