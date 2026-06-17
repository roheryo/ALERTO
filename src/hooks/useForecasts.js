import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const VALID_DISEASES = new Set(["DENGUE", "ILI", "AWD"]);

function normalizeDisease(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return VALID_DISEASES.has(v) ? v : null;
}

/**
 * Fetches an LSTM forecast (1..4 week ahead case counts) for one
 * (municipality, disease) from `/api/forecasts`. Returns the forecast
 * array, `as-of` week, and convenience flags for UI states.
 *
 * @param {{ disease?: string, municipalityId?: number, enabled?: boolean }} options
 */
export function useForecasts(options = {}) {
  const { token, isAuthenticated } = useAuth();
  const disease = normalizeDisease(options.disease ?? "ILI");
  const municipalityId = options.municipalityId;
  const enabled = options.enabled !== false;

  const [forecast, setForecast] = useState([]);
  const [asOfWeek, setAsOfWeek] = useState(null);
  const [municipality, setMunicipality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token || !disease || !enabled) {
      setForecast([]);
      setAsOfWeek(null);
      setMunicipality(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ disease });
      if (Number.isFinite(municipalityId) && municipalityId > 0) {
        params.set("municipalityId", String(municipalityId));
      }
      const data = await apiFetch(`/forecasts?${params.toString()}`, { token });
      const f = data?.forecast?.forecast;
      setForecast(Array.isArray(f) ? f : []);
      setAsOfWeek(data?.forecast?.as_of_week ?? null);
      setMunicipality(data?.municipality ?? null);
    } catch (e) {
      setForecast([]);
      setAsOfWeek(null);
      setMunicipality(null);
      setError(e?.message ?? "Failed to load forecast");
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, disease, municipalityId, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const total = useMemo(
    () => forecast.reduce((sum, row) => sum + (Number(row?.predicted_cases) || 0), 0),
    [forecast]
  );

  return {
    forecast,
    asOfWeek,
    municipality,
    total,
    loading,
    error,
    refetch
  };
}
