import { Router } from "express";
import { getWeatherForLocation } from "../services/weatherService.js";

/**
 * GET /api/weather?municipality=&barangay=
 * Current weather for a municipality/barangay (proxied, cached server-side).
 */
export function createWeatherRouter(authMiddleware) {
  const router = Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const municipality = String(req.query.municipality ?? "").trim();
      const barangay = String(req.query.barangay ?? "").trim();
      if (!municipality) {
        return res.status(400).json({ error: "Query parameter municipality is required" });
      }

      const result = await getWeatherForLocation({
        municipality,
        barangay: barangay || undefined
      });
      if (!result.ok) {
        return res.status(result.status ?? 502).json({ error: result.error });
      }
      return res.json({ weather: result.data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  return router;
}
