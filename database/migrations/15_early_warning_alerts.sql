-- ALERTO Early-Warning alerts (run after 14_case_environmental.sql)
-- Persists server-generated outbreak-risk alerts per barangay x disease and
-- an audit trail of lifecycle events (created / acknowledged / dismissed / expired).
--
-- Redesign of the retired migrations 11-13: adds dedup-friendly indexing,
-- a JSON trigger snapshot, an explicit status lifecycle, and an events log.

USE ALERTO;

-- ---------------------------------------------------------------------------
-- early_warning_alerts: one row per active outbreak-risk signal for a locality
-- ---------------------------------------------------------------------------

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
  -- Supports the 24h dedup lookup on (barangay, disease, severity, active).
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- early_warning_alert_events: append-only audit log per alert
-- ---------------------------------------------------------------------------

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
