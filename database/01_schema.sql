-- ALERTO MySQL schema (run after 00_create_database.sql)
-- RBAC: province > municipality > barangay (managed_by_user_id chain).

USE ALERTO;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS barangays;
DROP TABLE IF EXISTS municipalities;
DROP TABLE IF EXISTS provinces;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------

CREATE TABLE provinces (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(32) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_provinces_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE municipalities (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  province_id SMALLINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_municipalities_province_name (province_id, name),
  CONSTRAINT fk_municipalities_province
    FOREIGN KEY (province_id) REFERENCES provinces (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE barangays (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  municipality_id SMALLINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barangays_municipality_name (municipality_id, name),
  KEY idx_barangays_municipality (municipality_id),
  CONSTRAINT fk_barangays_municipality
    FOREIGN KEY (municipality_id) REFERENCES municipalities (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Users (no self-registration; accounts are seeded / maintained by hierarchy)
-- role: province | municipality | barangay
-- managed_by_user_id: province NULL; municipality -> province user; barangay -> municipality user
-- One login account per barangay (barangay_id unique where used).
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('province', 'municipality', 'barangay') NOT NULL,
  managed_by_user_id INT UNSIGNED NULL DEFAULT NULL,
  province_id SMALLINT UNSIGNED NULL DEFAULT NULL,
  municipality_id SMALLINT UNSIGNED NULL DEFAULT NULL,
  barangay_id INT UNSIGNED NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_barangay_account (barangay_id),
  KEY idx_users_role (role),
  KEY idx_users_municipality (municipality_id),
  KEY idx_users_province (province_id),
  KEY idx_users_managed_by (managed_by_user_id),
  CONSTRAINT fk_users_managed_by
    FOREIGN KEY (managed_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_users_province
    FOREIGN KEY (province_id) REFERENCES provinces (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_users_municipality
    FOREIGN KEY (municipality_id) REFERENCES municipalities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_users_barangay
    FOREIGN KEY (barangay_id) REFERENCES barangays (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Case logs / patients
-- ---------------------------------------------------------------------------

CREATE TABLE patients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  patient_number VARCHAR(40) NULL DEFAULT NULL,
  age VARCHAR(10) NULL DEFAULT NULL,
  sex VARCHAR(20) NULL DEFAULT NULL,
  birthdate DATE NULL DEFAULT NULL,
  civil_status VARCHAR(50) NULL DEFAULT NULL,
  province VARCHAR(100) NOT NULL DEFAULT 'Davao de Oro',
  municipality_id SMALLINT UNSIGNED NOT NULL,
  barangay_id INT UNSIGNED NOT NULL,
  purok VARCHAR(100) NULL DEFAULT NULL,
  birthplace VARCHAR(200) NULL DEFAULT NULL,
  disease_type VARCHAR(150) NULL DEFAULT NULL,
  case_classification VARCHAR(40) NULL DEFAULT NULL,
  case_status VARCHAR(20) NOT NULL DEFAULT 'active',
  date_started DATE NULL DEFAULT NULL,
  created_by INT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patients_municipality_created (municipality_id, created_at),
  KEY idx_patients_barangay_created (barangay_id, created_at),
  KEY idx_patients_disease (disease_type),
  CONSTRAINT fk_patients_municipality
    FOREIGN KEY (municipality_id) REFERENCES municipalities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_patients_barangay
    FOREIGN KEY (barangay_id) REFERENCES barangays (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_patients_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
