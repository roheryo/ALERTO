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
import { buildReportPreparedRows } from "@/lib/reportPatientRows";

/** Dispatch on window after a new case is saved so lists refetch without a full reload. */
export const PATIENTS_CHANGED_EVENT = "alerto:patients-changed";

const PatientsContext = createContext(null);

export function PatientsProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportRows, setReportRows] = useState([]);
  const [reportRowsLoading, setReportRowsLoading] = useState(false);
  const patientsRef = useRef(patients);
  const reportBuildGenRef = useRef(0);

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

  useEffect(() => {
    if (!patients.length) {
      setReportRows([]);
      setReportRowsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const buildId = reportBuildGenRef.current + 1;
    reportBuildGenRef.current = buildId;
    setReportRowsLoading(true);

    buildReportPreparedRows(patients).then((rows) => {
      if (cancelled || reportBuildGenRef.current !== buildId) return;
      setReportRows(rows);
      setReportRowsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [patients]);

  return (
    <PatientsContext.Provider
      value={{ patients, loading, error, refetch, mutatePatients, reportRows, reportRowsLoading }}
    >
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
