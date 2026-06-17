/**
 * Outbreak-declaration decision-support API.
 *
 *   GET   /api/declarations                         List (RBAC-scoped, filterable)
 *   GET   /api/declarations/brief/:scopeType/:scopeId?disease=  Live decision brief
 *   GET   /api/declarations/:id                     Detail + audit trail
 *   POST  /api/declarations                         Create draft / recommendation (MHO/PHO)
 *   PATCH /api/declarations/:id                     Update status / notes (MHO/PHO)
 *
 * Brief assembly + persistence live in services/declarationService.js; this
 * router only handles HTTP + RBAC.
 */

import { Router } from "express";

import {
  buildDecisionBrief,
  createDeclaration,
  getDeclaration,
  listDeclarations,
  resolveDeclarationScope,
  updateDeclaration
} from "../services/declarationService.js";

function tableMissing(res, err) {
  if (err?.code === "ER_NO_SUCH_TABLE") {
    res.status(503).json({ error: "Declaration tables not installed (run migration 16)." });
    return true;
  }
  return false;
}

export function createDeclarationsRouter(authMiddleware) {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const scope = resolveDeclarationScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);
      const result = await listDeclarations(scope, {
        status: req.query?.status,
        disease: req.query?.disease
      });
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json(result);
    } catch (err) {
      console.error("[declarations] list", err);
      if (tableMissing(res, err)) return undefined;
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.get("/brief/:scopeType/:scopeId", authMiddleware, async (req, res) => {
    try {
      const result = await buildDecisionBrief(req.auth, {
        scopeType: req.params.scopeType,
        scopeId: req.params.scopeId,
        disease: req.query?.disease,
        windowWeeks: req.query?.windowWeeks
      });
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json(result);
    } catch (err) {
      console.error("[declarations] brief", err);
      if (tableMissing(res, err)) return undefined;
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const scope = resolveDeclarationScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);
      const result = await getDeclaration(scope, id);
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json(result);
    } catch (err) {
      console.error("[declarations] get", err);
      if (tableMissing(res, err)) return undefined;
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.post("/", authMiddleware, async (req, res) => {
    try {
      if (!["municipality", "province"].includes(req.auth?.role)) {
        return res.status(403).json({ error: "Only MHO or PHO accounts can create declarations" });
      }
      const result = await createDeclaration(req.auth, req.body ?? {});
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.status(201).json(result);
    } catch (err) {
      console.error("[declarations] create", err);
      if (tableMissing(res, err)) return undefined;
      return res.status(500).json({ error: "Server error" });
    }
  });

  router.patch("/:id", authMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid id" });
      const scope = resolveDeclarationScope(req.auth);
      if (scope.error) return res.status(scope.error.status).json(scope.error.body);
      const result = await updateDeclaration(req.auth, scope, id, req.body ?? {});
      if (result.error) return res.status(result.error.status).json(result.error.body);
      return res.json(result);
    } catch (err) {
      console.error("[declarations] update", err);
      if (tableMissing(res, err)) return undefined;
      return res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}
