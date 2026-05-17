-- ALERTO MySQL: create database (run first in SQLyog as root or admin)
-- Charset utf8mb4 supports all names used in the ALERTO UI (e.g. "Doña", "Niño").
--
-- Suggested run order (files in database/migrations/):
--   1) 00_create_database.sql
--   2) 01_schema.sql
--   3) 02_seed_geography.sql
--   4) 03_seed_users.sql
--   5) 04_seed_sample_patients.sql   (optional)
--   6) 05_example_queries_for_api.sql (optional; mostly comments)
--   7) 06_fix_password_hash_bcryptjs.sql (existing DBs only)
--   8) 07_patch_barangays_geography.sql (optional)
--   9) 08_patients_case_fields.sql / 09_patients_patient_number.sql (existing DBs)
--      After 07, re-run 03_seed_users.sql for new barangay accounts only

CREATE DATABASE IF NOT EXISTS ALERTO
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ALERTO;
