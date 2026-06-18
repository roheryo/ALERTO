/**
 * Early-Warning alert API.
 *
 *   GET   /api/alerts                 List alerts (RBAC-scoped, filterable)
 *   GET   /api/alerts/summary         Active-alert counts for badges
 *   PATCH /api/alerts/:id/acknowledge Acknowledge an active alert (MHO)
 *   PATCH /api/alerts/:id/dismiss     Dismiss an alert with optional reason (MHO)
 *   POST  /api/alerts/evaluate        Run the evaluator + persist (admin/internal)
 *
 * Detection logic lives in services/alertEvaluator.js; persistence + dedup live
 * in services/alertStore.js. This router only handles HTTP + RBAC.
 */

import { Router } from "express";

import { pool } from "../config/db.js";
import { evaluateMunicipalityAlerts } from "../services/alertEvaluator.js";
import {
  acknowledgeAlert,
  dismissAlert,
  getAlertSummary,
  listAlerts,
  persistMunicipalityAlerts,
  resolveAlertScope
} from "../services/alertStore.js";

/** Constant-time-ish check for the internal automation token (Phase 4 job). */
function hasInternalToken(req) {
  const configured = process.env.INTERNAL_ALERT_TOKEN;
  if (!configured) return false;
  const provided = req.headers["x-internal-token"];
  return typeof provided === "string" && provided.length > 0 && provided === configured;
}

export function createAlertsRouter(authMiddleware) {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const scope = resolveAlertScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);

      const result = await listAlerts(scope, {
        status: req.query?.status,
        disease: req.query?.disease,
        severity: req.query?.severity
      });
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json(result);
    } catch (err) {
      console.error("[alerts] list", err);
      if (err?.code === "ER_NO_SUCH_TABLE") {
        return res.status(503).json({ error: "Early-Warning tables not installed (run migration 15)." });
      }
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.get("/summary", authMiddleware, async (req, res) => {
    try {
      const scope = resolveAlertScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);
      const summary = await getAlertSummary(scope);
      return res.json(summary);
    } catch (err) {
      console.error("[alerts] summary", err);
      if (err?.code === "ER_NO_SUCH_TABLE") {
        return res.json({ total: 0, active: 0, bySeverity: { high: 0, elevated: 0, watch: 0 } });
      }
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.patch("/:id/acknowledge", authMiddleware, async (req, res) => {
    try {
      if (req.auth.role !== "municipality") {
        return res.status(403).json({ error: "Only Municipal Health Office accounts can acknowledge alerts" });
      }
      const alertId = Number(req.params.id);
      if (!Number.isFinite(alertId) || alertId < 1) {
        return res.status(400).json({ error: "Invalid alert id" });
      }
      const scope = resolveAlertScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);

      const result = await acknowledgeAlert(scope, alertId, req.auth.sub);
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json({ ok: true, alert: result.alert });
    } catch (err) {
      console.error("[alerts] acknowledge", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.patch("/:id/dismiss", authMiddleware, async (req, res) => {
    try {
      if (req.auth.role !== "municipality") {
        return res.status(403).json({ error: "Only Municipal Health Office accounts can dismiss alerts" });
      }
      const alertId = Number(req.params.id);
      if (!Number.isFinite(alertId) || alertId < 1) {
        return res.status(400).json({ error: "Invalid alert id" });
      }
      const scope = resolveAlertScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);

      const result = await dismissAlert(scope, alertId, req.auth.sub, req.body?.reason);
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json({ ok: true, alert: result.alert });
    } catch (err) {
      console.error("[alerts] dismiss", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * Manual / internal evaluation trigger. Persists candidate alerts with dedup.
   * Authorized for: the internal automation token, or province accounts acting
   * as administrators (scoped to municipalities in their province).
   */
  router.post("/evaluate", authMiddleware, async (req, res) => {
    try {
      const internal = hasInternalToken(req);
      const role = req.auth?.role;
      if (!internal && role !== "province") {
        return res.status(403).json({ error: "Evaluation is restricted to administrators" });
      }

      const requestedId = Number(req.body?.municipalityId);
      const validRequested = Number.isFinite(requestedId) && requestedId > 0 ? requestedId : null;

      let municipalityIds = [];
      if (internal && !req.auth) {
        const [rows] = await pool.query(`SELECT id FROM municipalities ORDER BY id`);
        municipalityIds = rows.map((r) => r.id);
      } else if (role === "province" || internal) {
        const provinceId = req.auth?.provinceId;
        if (validRequested) {
          const [rows] = await pool.query(
            `SELECT id FROM municipalities WHERE id = ?${provinceId ? " AND province_id = ?" : ""} LIMIT 1`,
            provinceId ? [validRequested, provinceId] : [validRequested]
          );
          if (!rows[0]) return res.status(404).json({ error: "Municipality not in your province" });
          municipalityIds = [rows[0].id];
        } else {
          const [rows] = await pool.query(
            provinceId
              ? `SELECT id FROM municipalities WHERE province_id = ? ORDER BY id`
              : `SELECT id FROM municipalities ORDER BY id`,
            provinceId ? [provinceId] : []
          );
          municipalityIds = rows.map((r) => r.id);
        }
      }

      const actorUserId = req.auth?.sub ?? null;
      const totals = { created: 0, updated: 0, expired: 0, municipalities: municipalityIds.length };
      for (const id of municipalityIds) {
        const candidates = await evaluateMunicipalityAlerts(id, { withForecast: false });
        const summary = await persistMunicipalityAlerts(id, candidates, { actorUserId });
        totals.created += summary.created;
        totals.updated += summary.updated;
        totals.expired += summary.expired;
      }

      return res.json({ ok: true, ...totals });
    } catch (err) {
      console.error("[alerts] evaluate", err);
      if (err?.code === "ER_NO_SUCH_TABLE") {
        return res.status(503).json({ error: "Early-Warning tables not installed (run migration 15)." });
      }
      return res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}
