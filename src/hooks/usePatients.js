import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

/** Dispatch on window after a new case is saved so lists refetch without a full reload. */
export const PATIENTS_CHANGED_EVENT = "alerto:patients-changed";

/**
 * Fetches case rows visible to the logged-in user (RBAC on the server).
 * @returns {{ patients: object[], loading: boolean, error: string | null, refetch: () => Promise<void> }}
 */
export function usePatients() {
  const { token, isAuthenticated } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setPatients([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/patients", { token });
      setPatients(Array.isArray(data?.patients) ? data.patients : []);
    } catch (e) {
      setPatients([]);
      setError(e?.message ?? "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPatientsChanged = () => {
      refetch();
    };
    window.addEventListener(PATIENTS_CHANGED_EVENT, onPatientsChanged);
    return () => window.removeEventListener(PATIENTS_CHANGED_EVENT, onPatientsChanged);
  }, [refetch]);

  return { patients, loading, error, refetch };
}
