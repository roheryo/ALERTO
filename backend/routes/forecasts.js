import { Router } from "express";
import { pool } from "../config/db.js";

const ML_SERVICE_URL = String(process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000").replace(/\/+$/, "");
const ML_TIMEOUT_MS = Math.max(1000, Number(process.env.ML_TIMEOUT_MS ?? 8000) || 8000);
const VALID_DISEASES = new Set(["DENGUE", "ILI", "AWD"]);

function normalizeDisease(input) {
  const value = String(input ?? "").trim().toUpperCase();
  return VALID_DISEASES.has(value) ? value : null;
}

async function callMl(pathSuffix, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_SERVICE_URL}${pathSuffix}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, status: 504, data: { error: "ML service timed out" } };
    }
    return { ok: false, status: 503, data: { error: "ML service unavailable" } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the municipality the caller may forecast, then attach name metadata.
 */
async function resolveMunicipalityForRequest(req) {
  const { role, provinceId, municipalityId } = req.auth;
  const requested = Number(req.query?.municipalityId ?? req.body?.municipalityId);
  const validRequested = Number.isFinite(requested) && requested > 0 ? requested : null;

  let targetId = null;
  if (role === "municipality" || role === "barangay") {
    if (!municipalityId) return { error: { status: 403, body: { error: "Municipality scope missing" } } };
    if (validRequested && validRequested !== municipalityId) {
      return { error: { status: 403, body: { error: "Out-of-scope municipality" } } };
    }
    targetId = municipalityId;
  } else if (role === "province") {
    if (!provinceId) return { error: { status: 403, body: { error: "Province scope missing" } } };
    if (!validRequested) {
      return { error: { status: 400, body: { error: "municipalityId is required" } } };
    }
    const [rows] = await pool.query(
      `SELECT id, name FROM municipalities WHERE id = ? AND province_id = ? LIMIT 1`,
      [validRequested, provinceId]
    );
    if (!rows[0]) return { error: { status: 404, body: { error: "Municipality not in your province" } } };
    return { id: rows[0].id, name: rows[0].name };
  } else {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }

  const [rows] = await pool.query(`SELECT name FROM municipalities WHERE id = ? LIMIT 1`, [targetId]);
  return { id: targetId, name: rows[0]?.name ?? null };
}

export function createForecastsRouter(authMiddleware) {
  const router = Router();

  router.get("/health", authMiddleware, async (_req, res) => {
    const r = await callMl("/health");
    return res.status(r.ok ? 200 : r.status).json(r.data);
  });

  router.get("/metrics", authMiddleware, async (_req, res) => {
    const r = await callMl("/metrics");
    return res.status(r.ok ? 200 : r.status).json(r.data);
  });

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const disease = normalizeDisease(req.query?.disease ?? "ILI");
      if (!disease) {
        return res.status(400).json({ error: "disease must be DENGUE, ILI, or AWD" });
      }

      const target = await resolveMunicipalityForRequest(req);
      if (target.error) return res.status(target.error.status).json(target.error.body);

      const r = await callMl("/predict", {
        method: "POST",
        body: JSON.stringify({ municipality_id: target.id, disease })
      });
      if (!r.ok) return res.status(r.status).json(r.data);

      return res.json({
        forecast: r.data,
        municipality: { id: target.id, name: target.name }
      });
    } catch (err) {
      console.error("[forecasts]", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}
