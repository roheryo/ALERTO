-- ALERTO Outbreak Declaration decision-support (run after 15_early_warning_alerts.sql)
-- Persists human-authored outbreak declaration decisions (draft → recommended →
-- declared → lifted) with the risk/forecast snapshot that supported them, plus an
-- append-only audit trail. This is decision-support: records are created by
-- explicit MHO/PHO action, never automatically.

USE ALERTO;

-- ---------------------------------------------------------------------------
-- outbreak_declarations: one row per declaration decision for a locality x disease
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outbreak_declarations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  declaration_uuid CHAR(36) NOT NULL,
  scope_type ENUM('barangay', 'municipality') NOT NULL,
  -- scope_id references barangays.id when scope_type='barangay',
  -- municipalities.id when scope_type='municipality' (enforced in app layer).
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- outbreak_declaration_events: append-only audit log per declaration
-- ---------------------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
