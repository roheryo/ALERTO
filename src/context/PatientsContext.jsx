import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

/** Dispatch on window after a new case is saved so lists refetch without a full reload. */
export const PATIENTS_CHANGED_EVENT = "alerto:patients-changed";

const PatientsContext = createContext(null);

export function PatientsProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const patientsRef = useRef(patients);

  patientsRef.current = patients;

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setPatients([]);
      setLoading(false);
      setError(null);
      return;
    }

    const showBlockingLoad = patientsRef.current.length === 0;
    if (showBlockingLoad) setLoading(true);
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

  const mutatePatients = useCallback((updater) => {
    setPatients((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

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

  return (
    <PatientsContext.Provider value={{ patients, loading, error, refetch, mutatePatients }}>
      {children}
    </PatientsContext.Provider>
  );
}

/** Shared RBAC-scoped case list (one fetch for the whole app session). */
export function usePatients() {
  const ctx = useContext(PatientsContext);
  if (!ctx) {
    throw new Error("usePatients must be used within PatientsProvider");
  }
  return ctx;
}
