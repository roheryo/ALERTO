import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const VALID_DISEASES = new Set(["DENGUE", "ILI", "AWD"]);

function normalizeDisease(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return VALID_DISEASES.has(v) ? v : null;
}

/**
 * Live decision brief for a locality + disease from
 * `GET /api/declarations/brief/:scopeType/:scopeId`.
 *
 * Returns the assembled trend / forecast / risk-score / supporting-alert bundle
 * the server uses when persisting a declaration, so the UI shows the same
 * numbers it will store.
 *
 * @param {{ scopeType?: "barangay"|"municipality", scopeId?: number,
 *           disease?: string, enabled?: boolean }} options
 */
export function useDecisionBrief(options = {}) {
  const { token, isAuthenticated } = useAuth();
  const scopeType = options.scopeType ?? "barangay";
  const scopeId = Number(options.scopeId);
  const disease = normalizeDisease(options.disease);
  const enabled =
    options.enabled !== false && Number.isFinite(scopeId) && scopeId > 0 && !!disease;

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token || !enabled) {
      setBrief(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `/declarations/brief/${scopeType}/${scopeId}?disease=${disease}`,
        { token }
      );
      setBrief(data?.brief ?? null);
    } catch (e) {
      setBrief(null);
      setError(e?.message ?? "Failed to load decision brief");
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, enabled, scopeType, scopeId, disease]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { brief, loading, error, refetch };
}

/**
 * List + mutate outbreak declarations via `/api/declarations`.
 * Create/update are restricted server-side to MHO (municipality) and PHO
 * (province) accounts.
 *
 * @param {{ status?: string, disease?: string, enabled?: boolean }} options
 */
export function useDeclarations(options = {}) {
  const { token, user, isAuthenticated } = useAuth();
  const enabled = options.enabled !== false;
  const status = options.status ?? "all";
  const disease = options.disease ?? null;

  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canMutate = user?.role === "municipality" || user?.role === "province";

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token || !enabled) {
      setDeclarations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (disease) params.set("disease", disease);
      const qs = params.toString();
      const data = await apiFetch(`/declarations${qs ? `?${qs}` : ""}`, { token });
      setDeclarations(Array.isArray(data?.declarations) ? data.declarations : []);
    } catch (e) {
      setDeclarations([]);
      setError(e?.message ?? "Failed to load declarations");
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, enabled, status, disease]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createDeclaration = useCallback(
    async ({ scopeType, scopeId, disease: d, status: s = "draft", notes }) => {
      if (!canMutate) throw new Error("Only MHO or PHO accounts can create declarations");
      const data = await apiFetch(`/declarations`, {
        token,
        method: "POST",
        body: { scopeType, scopeId, disease: d, status: s, notes }
      });
      await refetch();
      return data?.declaration ?? null;
    },
    [token, canMutate, refetch]
  );

  const updateDeclaration = useCallback(
    async (id, patch) => {
      if (!canMutate) throw new Error("Only MHO or PHO accounts can update declarations");
      const data = await apiFetch(`/declarations/${id}`, { token, method: "PATCH", body: patch });
      await refetch();
      return data?.declaration ?? null;
    },
    [token, canMutate, refetch]
  );

  return { declarations, loading, error, canMutate, refetch, createDeclaration, updateDeclaration };
}
