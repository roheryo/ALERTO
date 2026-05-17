import { useCallback, useEffect, useMemo, useState } from "react";

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
  computeDiseaseKpi,
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

export function useProvincialSurveillance() {
  const { patients: rawPatients, loading, error } = usePatients();
  const [filters, setFilters] = useState(loadFilters);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const patients = useMemo(
    () => filterConfirmedPatients(Array.isArray(rawPatients) ? rawPatients : []),
    [rawPatients]
  );

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
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const timeOptions = useMemo(
    () => ({
      windowMode: filters.windowMode,
      periodOffset: filters.periodOffset,
      referenceDate: new Date(),
      diseaseFilter: filters.diseaseFilter
    }),
    [filters.windowMode, filters.periodOffset, filters.diseaseFilter]
  );

  const windows = useMemo(
    () =>
      resolveSurveillanceWindows({
        windowWeeks: filters.windowWeeks,
        windowMode: filters.windowMode,
        periodOffset: filters.periodOffset,
        referenceDate: new Date()
      }),
    [filters.windowWeeks, filters.windowMode, filters.periodOffset]
  );

  const periodCaption = useMemo(
    () =>
      formatPeriodCaption(windows, {
        windowMode: filters.windowMode,
        windowWeeks: filters.windowWeeks,
        periodOffset: filters.periodOffset
      }),
    [windows, filters.windowMode, filters.windowWeeks, filters.periodOffset]
  );

  const kpis = useMemo(
    () => ({
      awd: computeDiseaseKpi(patients, "AWD", filters.windowWeeks, { ...timeOptions, windows }),
      ili: computeDiseaseKpi(patients, "ILI", filters.windowWeeks, { ...timeOptions, windows }),
      dengue: computeDiseaseKpi(patients, "DENGUE", filters.windowWeeks, { ...timeOptions, windows })
    }),
    [patients, filters.windowWeeks, timeOptions, windows]
  );

  const municipalityRows = useMemo(
    () =>
      computeMunicipalityVelocityRows(patients, filters.windowWeeks, filters.diseaseFilter, {
        ...timeOptions,
        windows
      }),
    [patients, filters.windowWeeks, filters.diseaseFilter, timeOptions, windows]
  );

  const barangayRows = useMemo(
    () =>
      computeProvinceBarangayRows(
        patients,
        filters.windowWeeks,
        filters.diseaseFilter,
        { ...timeOptions, windows },
        filters.municipalityFilter
      ),
    [patients, filters.windowWeeks, filters.diseaseFilter, timeOptions, windows, filters.municipalityFilter]
  );

  const statusBoard = useMemo(
    () =>
      computeMunicipalityStatusBoard(patients, filters.windowWeeks, filters.diseaseFilter, {
        ...timeOptions,
        windows
      }),
    [patients, filters.windowWeeks, filters.diseaseFilter, timeOptions, windows]
  );

  const crossAlerts = useMemo(() => computeCrossMunicipalityAlerts(statusBoard), [statusBoard]);

  const syncHealth = useMemo(() => computeProvinceSyncHealth(patients), [patients]);

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
      filters.diseaseFilter === "ALL"
        ? "all diseases"
        : filters.diseaseFilter === "ILI"
          ? "ILI"
          : filters.diseaseFilter === "AWD"
            ? "AWD"
            : "Dengue";
    const scope = filters.municipalityFilter
      ? `in ${filters.municipalityFilter}`
      : "province-wide";
    const top = barangayRows.slice(0, 10);
    return { label, scope, windowWeeks: filters.windowWeeks, top };
  }, [barangayRows, filters.diseaseFilter, filters.municipalityFilter, filters.windowWeeks]);

  const municipalities = useMemo(() => listProvinceMunicipalities(), []);

  return {
    patients,
    loading,
    error,
    lastSyncedAt,
    filters,
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
