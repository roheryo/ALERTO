-- ALERTO: drop Early-Warning alerts and outbreak-declaration tables (run after 16)
-- Reverses migrations 15_early_warning_alerts.sql and 16_outbreak_declarations.sql.

USE ALERTO;

DROP TABLE IF EXISTS outbreak_declaration_events;
DROP TABLE IF EXISTS outbreak_declarations;
DROP TABLE IF EXISTS early_warning_alert_events;
DROP TABLE IF EXISTS early_warning_alerts;
