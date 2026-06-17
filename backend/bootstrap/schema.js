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

const EARLY_WARNING_ALERTS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS early_warning_alerts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    alert_uuid CHAR(36) NOT NULL,
    municipality_id SMALLINT UNSIGNED NOT NULL,
    barangay_id INT UNSIGNED NOT NULL,
    disease ENUM('DENGUE', 'ILI', 'AWD') NOT NULL,
    severity ENUM('watch', 'elevated', 'high') NOT NULL,
    trigger_type ENUM('velocity', 'count', 'forecast', 'combined') NOT NULL,
    trigger_snapshot JSON NULL DEFAULT NULL,
    status ENUM('active', 'acknowledged', 'dismissed', 'expired') NOT NULL DEFAULT 'active',
    acknowledged_by INT UNSIGNED NULL DEFAULT NULL,
    acknowledged_at TIMESTAMP NULL DEFAULT NULL,
    dismissed_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_alerts_uuid (alert_uuid),
    KEY idx_alerts_municipality_status (municipality_id, status),
    KEY idx_alerts_barangay (barangay_id),
    KEY idx_alerts_dedup (barangay_id, disease, severity, status, created_at),
    CONSTRAINT fk_alerts_municipality
      FOREIGN KEY (municipality_id) REFERENCES municipalities (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerts_barangay
      FOREIGN KEY (barangay_id) REFERENCES barangays (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alerts_ack_user
      FOREIGN KEY (acknowledged_by) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const EARLY_WARNING_ALERT_EVENTS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS early_warning_alert_events (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    alert_id INT UNSIGNED NOT NULL,
    event_type ENUM('created', 'updated', 'acknowledged', 'dismissed', 'expired', 'reescalated') NOT NULL,
    actor_user_id INT UNSIGNED NULL DEFAULT NULL,
    payload JSON NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_alert_events_alert (alert_id, created_at),
    CONSTRAINT fk_alert_events_alert
      FOREIGN KEY (alert_id) REFERENCES early_warning_alerts (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alert_events_actor
      FOREIGN KEY (actor_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/** Idempotent Early-Warning alert tables (matches migration 15). Persists
 *  server-generated outbreak-risk alerts and their lifecycle audit log. */
export async function ensureEarlyWarningAlertTables() {
  try {
    await pool.query(EARLY_WARNING_ALERTS_CREATE_SQL);
    await pool.query(EARLY_WARNING_ALERT_EVENTS_CREATE_SQL);
  } catch (err) {
    if (err?.code !== "ER_TABLE_EXISTS_ERROR") {
      console.warn("[ALERTO API] early_warning_alerts bootstrap:", err.message);
    }
  }
}

const OUTBREAK_DECLARATIONS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS outbreak_declarations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    declaration_uuid CHAR(36) NOT NULL,
    scope_type ENUM('barangay', 'municipality') NOT NULL,
    scope_id INT UNSIGNED NOT NULL,
    municipality_id SMALLINT UNSIGNED NOT NULL,
    barangay_id INT UNSIGNED NULL DEFAULT NULL,
    disease ENUM('DENGUE', 'ILI', 'AWD') NOT NULL,
    status ENUM('draft', 'recommended', 'declared', 'lifted', 'cancelled') NOT NULL DEFAULT 'draft',
    risk_score DECIMAL(5, 2) NULL DEFAULT NULL,
    risk_severity ENUM('normal', 'watch', 'elevated', 'high') NULL DEFAULT NULL,
    risk_snapshot JSON NULL DEFAULT NULL,
    forecast_snapshot JSON NULL DEFAULT NULL,
    supporting_alert_ids JSON NULL DEFAULT NULL,
    notes TEXT NULL,
    created_by INT UNSIGNED NULL DEFAULT NULL,
    declared_by INT UNSIGNED NULL DEFAULT NULL,
    declared_at TIMESTAMP NULL DEFAULT NULL,
    lifted_by INT UNSIGNED NULL DEFAULT NULL,
    lifted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_declarations_uuid (declaration_uuid),
    KEY idx_declarations_municipality_status (municipality_id, status),
    KEY idx_declarations_scope (scope_type, scope_id, disease),
    KEY idx_declarations_barangay (barangay_id),
    CONSTRAINT fk_declarations_municipality
      FOREIGN KEY (municipality_id) REFERENCES municipalities (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_declarations_barangay
      FOREIGN KEY (barangay_id) REFERENCES barangays (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_declarations_created_by
      FOREIGN KEY (created_by) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_declarations_declared_by
      FOREIGN KEY (declared_by) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_declarations_lifted_by
      FOREIGN KEY (lifted_by) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const OUTBREAK_DECLARATION_EVENTS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS outbreak_declaration_events (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    declaration_id INT UNSIGNED NOT NULL,
    event_type ENUM('created', 'updated', 'recommended', 'declared', 'lifted', 'cancelled') NOT NULL,
    actor_user_id INT UNSIGNED NULL DEFAULT NULL,
    payload JSON NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_declaration_events_declaration (declaration_id, created_at),
    CONSTRAINT fk_declaration_events_declaration
      FOREIGN KEY (declaration_id) REFERENCES outbreak_declarations (id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_declaration_events_actor
      FOREIGN KEY (actor_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/** Idempotent outbreak-declaration tables (matches migration 16). Persists
 *  human-authored declaration decisions + their audit trail. */
export async function ensureOutbreakDeclarationTables() {
  try {
    await pool.query(OUTBREAK_DECLARATIONS_CREATE_SQL);
    await pool.query(OUTBREAK_DECLARATION_EVENTS_CREATE_SQL);
  } catch (err) {
    if (err?.code !== "ER_TABLE_EXISTS_ERROR") {
      console.warn("[ALERTO API] outbreak_declarations bootstrap:", err.message);
    }
  }
}

export async function bootstrapSchema() {
  await Promise.all([
    ensurePatientNumberColumn(),
    ensureCaseClassificationColumn(),
    ensureCaseEnvironmentalTable(),
    ensureEarlyWarningAlertTables()
  ]);
  // Declarations FK-reference early_warning_alerts/users, so create after the
  // above batch settles to avoid racing table creation.
  await ensureOutbreakDeclarationTables();
}
