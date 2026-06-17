import { useCallback, useEffect, useMemo, useState, useDeferredValue, startTransition } from "react";

import { listProvinceMunicipalities } from "@/data/davaoDeOroGeography";
import { filterConfirmedPatients } from "@/lib/disease";
import {
  computeCrossMunicipalityAlerts,
  computeMunicipalitySparklines,
  computeMunicipalityStatusBoard,
  computeMunicipalityVelocityRows,
  computeProvinceBarangayRows,
  computeProvinceSyncHealth,
  computeProvinceWeeklyTrend,
  provinceBarangayCount
} from "@/lib/provincialSurveillance";
import {
  buildSurveillanceIndex,
  computeAllDiseaseKpis,
  formatPeriodCaption,
  formatWindowLabel,
  resolveSurveillanceWindows
} from "@/lib/surveillance";
import { usePatients } from "@/hooks/usePatients";

const STORAGE_KEY = "alerto-province-filters";

const DEFAULT_FILTERS = {
  windowMode: "weeks",
  windowWeeks: 4,
  periodOffset: 0,
  diseaseFilter: "DENGUE",
  geoView: "municipality",
  municipalityFilter: "",
  mapMetric: "velocity"
};

function loadFilters() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

const WINDOW_WEEKS = 4;
const WINDOW_MODE = "weeks";
const PERIOD_OFFSET = 0;

export function useProvincialSurveillance() {
  const { patients: rawPatients, loading, error } = usePatients();
  const [filters, setFilters] = useState(loadFilters);
  const deferredFilters = useDeferredValue(filters);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const patients = useMemo(
    () => filterConfirmedPatients(Array.isArray(rawPatients) ? rawPatients : []),
    [rawPatients]
  );

  const caseIndex = useMemo(() => buildSurveillanceIndex(patients), [patients]);

  useEffect(() => {
    if (!loading && !error) setLastSyncedAt(new Date());
  }, [loading, error, rawPatients]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const patchFilters = useCallback((patch) => {
    startTransition(() => {
      setFilters((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const timeOptions = useMemo(
    () => ({
      windowMode: WINDOW_MODE,
      periodOffset: PERIOD_OFFSET,
      referenceDate: new Date(),
      diseaseFilter: deferredFilters.diseaseFilter,
      caseIndex
    }),
    [deferredFilters.diseaseFilter, caseIndex]
  );

  const windows = useMemo(
    () =>
      resolveSurveillanceWindows({
        windowWeeks: WINDOW_WEEKS,
        windowMode: WINDOW_MODE,
        periodOffset: PERIOD_OFFSET,
        referenceDate: new Date()
      }),
    []
  );

  const periodCaption = useMemo(
    () =>
      formatPeriodCaption(windows, {
        windowMode: WINDOW_MODE,
        windowWeeks: WINDOW_WEEKS,
        periodOffset: PERIOD_OFFSET
      }),
    [windows]
  );

  const kpis = useMemo(
    () => computeAllDiseaseKpis(patients, WINDOW_WEEKS, { ...timeOptions, windows }),
    [patients, timeOptions, windows]
  );

  const municipalityRows = useMemo(
    () =>
      computeMunicipalityVelocityRows(patients, WINDOW_WEEKS, deferredFilters.diseaseFilter, {
        ...timeOptions,
        windows
      }),
    [patients, deferredFilters.diseaseFilter, timeOptions, windows]
  );

  const barangayRows = useMemo(
    () =>
      computeProvinceBarangayRows(
        patients,
        WINDOW_WEEKS,
        deferredFilters.diseaseFilter,
        { ...timeOptions, windows },
        deferredFilters.municipalityFilter
      ),
    [patients, deferredFilters.diseaseFilter, timeOptions, windows, deferredFilters.municipalityFilter]
  );

  const statusBoard = useMemo(
    () =>
      computeMunicipalityStatusBoard(patients, WINDOW_WEEKS, deferredFilters.diseaseFilter, {
        ...timeOptions,
        windows
      }),
    [patients, deferredFilters.diseaseFilter, timeOptions, windows]
  );

  const crossAlerts = useMemo(() => computeCrossMunicipalityAlerts(statusBoard), [statusBoard]);

  const syncHealth = useMemo(() => computeProvinceSyncHealth(patients, timeOptions), [patients, timeOptions]);

  const provinceTrend = useMemo(
    () => computeProvinceWeeklyTrend(patients, 8, timeOptions),
    [patients, timeOptions]
  );

  const municipalitySparklines = useMemo(
    () => computeMunicipalitySparklines(patients, 6, timeOptions),
    [patients, timeOptions]
  );

  const topBarangaysHeadline = useMemo(() => {
    const label =
      deferredFilters.diseaseFilter === "ALL"
        ? "all diseases"
        : deferredFilters.diseaseFilter === "ILI"
          ? "ILI"
          : deferredFilters.diseaseFilter === "AWD"
            ? "AWD"
            : "Dengue";
    const scope = deferredFilters.municipalityFilter
      ? `in ${deferredFilters.municipalityFilter}`
      : "province-wide";
    const top = barangayRows.slice(0, 10);
    return { label, scope, windowWeeks: WINDOW_WEEKS, top };
  }, [barangayRows, deferredFilters.diseaseFilter, deferredFilters.municipalityFilter]);

  const municipalities = useMemo(() => listProvinceMunicipalities(), []);

  return {
    patients,
    loading,
    error,
    lastSyncedAt,
    filters,
    filtersPending: deferredFilters !== filters,
    patchFilters,
    windows,
    periodCaption,
    windowLabel: formatWindowLabel(windows.current),
    kpis,
    municipalityRows,
    barangayRows,
    statusBoard,
    crossAlerts,
    syncHealth,
    provinceTrend,
    municipalitySparklines,
    topBarangaysHeadline,
    municipalities,
    totalBarangays: provinceBarangayCount()
  };
}
