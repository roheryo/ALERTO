import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const POLL_INTERVAL_MS = 60_000;

const EMPTY_SUMMARY = { total: 0, active: 0, bySeverity: { high: 0, elevated: 0, watch: 0 } };

/**
 * Lightweight summary-only hook for the sidebar badge / dashboard indicators.
 * Hits `/api/alerts/summary` (cheap aggregate) and polls every 60s. Avoids
 * fetching the full alert list where only the active count is needed.
 */
export function useAlertSummary(options = {}) {
  const { token, isAuthenticated } = useAuth();
  const enabled = options.enabled !== false;
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  useEffect(() => {
    if (!isAuthenticated || !token || !enabled) return undefined;
    let cancelled = false;
    // setState lives inside the promise callback (not synchronous in the effect
    // body) and is guarded by `cancelled` to avoid setting state after unmount.
    const tick = () => {
      apiFetch(`/alerts/summary`, { token })
        .then((data) => {
          if (cancelled) return;
          setSummary({
            total: Number(data?.total) || 0,
            active: Number(data?.active) || 0,
            bySeverity: {
              high: Number(data?.bySeverity?.high) || 0,
              elevated: Number(data?.bySeverity?.elevated) || 0,
              watch: Number(data?.bySeverity?.watch) || 0
            }
          });
        })
        .catch(() => {
          // Keep the last known summary on transient errors (badge is non-critical).
        });
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated, token, enabled]);

  return { summary };
}

/**
 * Loads Early-Warning alerts from `/api/alerts` (RBAC-scoped server-side) plus
 * the active-count summary, and exposes acknowledge / dismiss mutations.
 * Polls every 60s while mounted. Mirrors the useForecasts hook pattern.
 *
 * @param {{ status?: string, disease?: string, severity?: string, enabled?: boolean }} options
 */
export function useAlerts(options = {}) {
  const { token, user, isAuthenticated } = useAuth();
  const enabled = options.enabled !== false;
  const status = options.status ?? "active";
  const disease = options.disease ?? null;
  const severity = options.severity ?? null;

  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, bySeverity: { high: 0, elevated: 0, watch: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canMutate = user?.role === "municipality";

  // Keep the latest filters in a ref so polling always uses current values
  // without re-creating the interval on every filter change.
  const filtersRef = useRef({ status, disease, severity });
  filtersRef.current = { status, disease, severity };

  const buildQuery = useCallback(() => {
    const { status: s, disease: d, severity: sev } = filtersRef.current;
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (d) params.set("disease", d);
    if (sev) params.set("severity", sev);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, []);

  const refetch = useCallback(
    async ({ quiet = false } = {}) => {
      if (!isAuthenticated || !token || !enabled) {
        setAlerts([]);
        setSummary({ total: 0, active: 0, bySeverity: { high: 0, elevated: 0, watch: 0 } });
        setLoading(false);
        setError(null);
        return;
      }
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const [listData, summaryData] = await Promise.all([
          apiFetch(`/alerts${buildQuery()}`, { token }),
          apiFetch(`/alerts/summary`, { token })
        ]);
        setAlerts(Array.isArray(listData?.alerts) ? listData.alerts : []);
        if (summaryData && typeof summaryData === "object") {
          setSummary({
            total: Number(summaryData.total) || 0,
            active: Number(summaryData.active) || 0,
            bySeverity: {
              high: Number(summaryData.bySeverity?.high) || 0,
              elevated: Number(summaryData.bySeverity?.elevated) || 0,
              watch: Number(summaryData.bySeverity?.watch) || 0
            }
          });
        }
      } catch (e) {
        if (!quiet) {
          setAlerts([]);
          setError(e?.message ?? "Failed to load alerts");
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [token, isAuthenticated, enabled, buildQuery]
  );

  useEffect(() => {
    refetch();
  }, [refetch, status, disease, severity]);

  useEffect(() => {
    if (!isAuthenticated || !token || !enabled) return undefined;
    const id = setInterval(() => refetch({ quiet: true }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch, isAuthenticated, token, enabled]);

  const acknowledge = useCallback(
    async (alertId) => {
      if (!canMutate) throw new Error("Only Municipal Health Office accounts can acknowledge alerts");
      await apiFetch(`/alerts/${alertId}/acknowledge`, { token, method: "PATCH" });
      await refetch({ quiet: true });
    },
    [token, canMutate, refetch]
  );

  const dismiss = useCallback(
    async (alertId, reason) => {
      if (!canMutate) throw new Error("Only Municipal Health Office accounts can dismiss alerts");
      await apiFetch(`/alerts/${alertId}/dismiss`, {
        token,
        method: "PATCH",
        body: reason ? { reason } : undefined
      });
      await refetch({ quiet: true });
    },
    [token, canMutate, refetch]
  );

  const grouped = useMemo(() => {
    const buckets = { high: [], elevated: [], watch: [] };
    for (const alert of alerts) {
      if (alert?.severity in buckets) buckets[alert.severity].push(alert);
    }
    return buckets;
  }, [alerts]);

  return {
    alerts,
    grouped,
    summary,
    loading,
    error,
    canMutate,
    acknowledge,
    dismiss,
    refetch
  };
}
