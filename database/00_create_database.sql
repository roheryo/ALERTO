-- ALERTO MySQL: create database (run first in SQLyog as root or admin)
-- Charset utf8mb4 supports all names used in the ALERTO UI (e.g. "Doña", "Niño").
--
-- Suggested run order in SQLyog (same connection):
--   1) 00_create_database.sql
--   2) 01_schema.sql
--   3) 02_seed_geography.sql
--   4) 03_seed_users.sql
--   5) 04_seed_sample_patients.sql   (optional)
--   6) 05_example_queries_for_api.sql (optional; mostly comments)

CREATE DATABASE IF NOT EXISTS ALERTO
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ALERTO;
