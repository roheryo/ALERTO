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

export async function bootstrapSchema() {
  await Promise.all([ensurePatientNumberColumn(), ensureCaseClassificationColumn()]);
}
