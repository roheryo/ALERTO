-- Add case classification & status for case logs filters (run once on existing DB).

USE ALERTO;

ALTER TABLE patients
  ADD COLUMN case_classification VARCHAR(40) NULL DEFAULT NULL AFTER disease_type,
  ADD COLUMN case_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER case_classification;

UPDATE patients SET case_classification = 'Probable' WHERE case_classification IS NULL;
