-- Facility patient number / ID from report case form (PatientNumber field).
-- Run once on existing DB: mysql ... < database/migrations/09_patients_patient_number.sql

USE ALERTO;

ALTER TABLE patients
  ADD COLUMN patient_number VARCHAR(40) NULL DEFAULT NULL AFTER name;

-- Backfill existing rows with incremental IDs derived from primary key.
UPDATE patients SET patient_number = LPAD(id, 6, '0') WHERE patient_number IS NULL OR patient_number = '';
