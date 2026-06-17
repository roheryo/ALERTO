import { MUNICIPALITY_COORDS } from "@/data/barangayCoords";
import {
  BARANGAY_BY_MUNICIPALITY,
  listProvinceMunicipalities,
  provinceBarangayCount,
  resolveMunicipalityKey
} from "@/data/davaoDeOroGeography";
import {
  buildSurveillanceIndex,
  compositeBarangayKey,
  computePctChange,
  getWeeklyBuckets,
  normalizePlaceKey,
  resolveSurveillanceWindows
} from "@/lib/surveillance";

/** Provincial cross-municipality alert thresholds (kept here after the
 *  municipal early-warning module was retired). */
const COUNT_THRESHOLDS = { DENGUE: 10, ILI: 14, AWD: 8 };
const VELOCITY_MIN_DELTA = 2;
const VELOCITY_MIN_PCT = 40;

export { listProvinceMunicipalities, provinceBarangayCount };

function resolveCaseIndex(patients, timeOptions = {}) {
  return timeOptions.caseIndex ?? buildSurveillanceIndex(patients);
}

function bucketIndexForTime(time, bucketRanges) {
  for (let i = 0; i < bucketRanges.length; i += 1) {
    const bucket = bucketRanges[i];
    if (time >= bucket.start && time <= bucket.end) return i;
  }
  return -1;
}

function normalizeMuniKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveMunicipalityCoords(municipalityName) {
  const resolved = resolveMunicipalityKey(municipalityName) || municipalityName;
  const key = normalizeMuniKey(resolved);
  const c = MUNICIPALITY_COORDS[key];
  if (c) return { ...c, municipality: resolved };
  return null;
}

function countForMunicipality(index, windows, diseaseFilter, municipalityName) {
  const muniKey = normalizePlaceKey(municipalityName);
  const diseases =
    diseaseFilter === "ALL" ? new Set(["DENGUE", "ILI", "AWD"]) : new Set([String(diseaseFilter).toUpperCase()]);
  const currentStart = windows.current.start.getTime();
  const currentEnd = windows.current.end.getTime();
  const priorStart = windows.prior.start.getTime();
  const priorEnd = windows.prior.end.getTime();

  let current = 0;
  let prior = 0;
  for (const c of index) {
    if (c.municipalityKey !== muniKey) continue;
    if (!diseases.has(c.disease)) continue;
    if (c.time >= currentStart && c.time <= currentEnd) current += 1;
    else if (c.time >= priorStart && c.time <= priorEnd) prior += 1;
  }
  return { current, prior, delta: current - prior, pctChange: computePctChange(current, prior) };
}

/** Velocity rows for each municipality in the province. */
export function computeMunicipalityVelocityRows(
  patients,
  windowWeeks,
  diseaseFilter = "DENGUE",
  timeOptions = {}
) {
  const windows =
    timeOptions.windows ??
    resolveSurveillanceWindows({
      windowWeeks,
      windowMode: timeOptions.windowMode,
      periodOffset: timeOptions.periodOffset,
      referenceDate: timeOptions.referenceDate
    });
  const index = resolveCaseIndex(patients, timeOptions);

  const rows = listProvinceMunicipalities().map((name) => {
    const counts = countForMunicipality(index, windows, diseaseFilter, name);
    return {
      municipality: name,
      municipalityKey: normalizePlaceKey(name),
      disease: diseaseFilter === "ALL" ? "All diseases" : diseaseFilter,
      ...counts
    };
  });

  rows.sort((a, b) => b.delta - a.delta || b.current - a.current);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Province-wide barangay velocity rows (optional municipality filter). */
export function computeProvinceBarangayRows(
  patients,
  windowWeeks,
  diseaseFilter = "DENGUE",
  timeOptions = {},
  municipalityFilter = ""
) {
  const windows =
    timeOptions.windows ??
    resolveSurveillanceWindows({
      windowWeeks,
      windowMode: timeOptions.windowMode,
      periodOffset: timeOptions.periodOffset,
      referenceDate: timeOptions.referenceDate
    });

  const diseases =
    diseaseFilter === "ALL" ? new Set(["DENGUE", "ILI", "AWD"]) : new Set([String(diseaseFilter).toUpperCase()]);
  const muniFilterKey = municipalityFilter ? normalizePlaceKey(municipalityFilter) : null;
  const currentStart = windows.current.start.getTime();
  const currentEnd = windows.current.end.getTime();
  const priorStart = windows.prior.start.getTime();
  const priorEnd = windows.prior.end.getTime();

  const rowsByKey = new Map();
  for (const [municipality, barangays] of Object.entries(BARANGAY_BY_MUNICIPALITY)) {
    const muniKey = normalizePlaceKey(municipality);
    if (muniFilterKey && muniKey !== muniFilterKey) continue;

    for (const barangay of barangays) {
      const barangayKey = compositeBarangayKey(municipality, barangay);
      rowsByKey.set(barangayKey, {
        municipality,
        municipalityKey: muniKey,
        barangay,
        barangayKey,
        disease: diseaseFilter === "ALL" ? "All diseases" : diseaseFilter,
        current: 0,
        prior: 0
      });
    }
  }

  const index = resolveCaseIndex(patients, timeOptions);
  for (const c of index) {
    if (!diseases.has(c.disease)) continue;
    const row = rowsByKey.get(`${c.municipalityKey}|${c.barangayKey}`);
    if (!row) continue;
    if (c.time >= currentStart && c.time <= currentEnd) row.current += 1;
    else if (c.time >= priorStart && c.time <= priorEnd) row.prior += 1;
  }

  const rows = Array.from(rowsByKey.values()).map((row) => ({
    ...row,
    delta: row.current - row.prior,
    pctChange: computePctChange(row.current, row.prior)
  }));

  rows.sort((a, b) => b.delta - a.delta || b.current - a.current);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

function alertLevelForRow(row, diseaseFilter) {
  const threshold =
    diseaseFilter === "ALL"
      ? Math.min(COUNT_THRESHOLDS.DENGUE, COUNT_THRESHOLDS.ILI, COUNT_THRESHOLDS.AWD)
      : COUNT_THRESHOLDS[String(diseaseFilter).toUpperCase()] ?? 10;

  if (row.current >= threshold && row.delta >= VELOCITY_MIN_DELTA) return "high";
  if (row.current >= threshold || row.delta >= VELOCITY_MIN_DELTA) return "elevated";
  if (row.pctChange >= VELOCITY_MIN_PCT && row.delta > 0 && row.current >= 2) return "watch";
  return "normal";
}

/** Municipality status board for PHO coordination. */
export function computeMunicipalityStatusBoard(
  patients,
  windowWeeks,
  diseaseFilter,
  timeOptions = {}
) {
  const rows = computeMunicipalityVelocityRows(patients, windowWeeks, diseaseFilter, timeOptions);
  const index = resolveCaseIndex(patients, timeOptions);
  const now = Date.now();
  const lastByMuni = new Map();

  for (const c of index) {
    const existing = lastByMuni.get(c.municipalityKey);
    if (!existing || c.time > existing.time) {
      lastByMuni.set(c.municipalityKey, { time: c.time, barangay: c.barangay });
    }
  }

  return rows.map((row) => {
    const last = lastByMuni.get(row.municipalityKey);
    const lastEncodeAt = last ? new Date(last.time) : null;
    const minutesAgo =
      lastEncodeAt != null ? Math.max(0, Math.round((now - lastEncodeAt.getTime()) / 60000)) : null;

    return {
      ...row,
      alertLevel: alertLevelForRow(row, diseaseFilter),
      lastEncodeAt,
      lastBarangay: last?.barangay ?? "",
      minutesAgo
    };
  });
}

/** Municipalities needing cross-municipality PHO coordination. */
export function computeCrossMunicipalityAlerts(statusBoard) {
  return (statusBoard ?? []).filter((r) => r.alertLevel === "high" || r.alertLevel === "elevated");
}

/** Barangays with recent case encodes (surveillance sync health). */
export function computeProvinceSyncHealth(patients, timeOptions = {}) {
  const totalBarangays = provinceBarangayCount();
  const index = resolveCaseIndex(patients, timeOptions);
  const reportingKeys = new Set();
  let lastCase = null;

  for (const c of index) {
    if (c.municipalityKey && c.barangayKey) {
      reportingKeys.add(`${c.municipalityKey}|${c.barangayKey}`);
    }
    if (!lastCase || c.time > lastCase.time) {
      lastCase = c;
    }
  }

  return {
    totalBarangays,
    reportingBarangays: reportingKeys.size,
    lastEncode: lastCase
      ? {
          barangay: lastCase.barangay,
          municipality: lastCase.municipality || lastCase.municipalityKey,
          at: new Date(lastCase.time)
        }
      : null
  };
}

/** Weekly province trend. */
export function computeProvinceWeeklyTrend(patients, weekCount, timeOptions = {}) {
  const buckets = getWeeklyBuckets(
    weekCount,
    timeOptions.referenceDate ?? new Date(),
    timeOptions.periodOffset ?? 0
  );
  const diseaseFilter = timeOptions.diseaseFilter;
  const diseases =
    !diseaseFilter || diseaseFilter === "ALL"
      ? new Set(["DENGUE", "ILI", "AWD"])
      : new Set([String(diseaseFilter).toUpperCase()]);
  const index = resolveCaseIndex(patients, timeOptions);
  const bucketRanges = buckets.map((bucket) => ({
    start: bucket.start.getTime(),
    end: bucket.end.getTime()
  }));

  const counts = buckets.map((bucket) => ({
    label: bucket.label,
    DENGUE: 0,
    ILI: 0,
    AWD: 0
  }));

  for (const c of index) {
    if (!diseases.has(c.disease)) continue;
    const bucketIdx = bucketIndexForTime(c.time, bucketRanges);
    if (bucketIdx < 0) continue;
    if (c.disease === "DENGUE") counts[bucketIdx].DENGUE += 1;
    else if (c.disease === "ILI") counts[bucketIdx].ILI += 1;
    else if (c.disease === "AWD") counts[bucketIdx].AWD += 1;
  }

  return counts;
}

/** Sparkline data per municipality. */
export function computeMunicipalitySparklines(patients, weekCount, timeOptions = {}) {
  const buckets = getWeeklyBuckets(
    weekCount,
    timeOptions.referenceDate ?? new Date(),
    timeOptions.periodOffset ?? 0
  );
  const diseaseFilter = timeOptions.diseaseFilter;
  const diseases =
    diseaseFilter === "ALL" || !diseaseFilter
      ? new Set(["DENGUE", "ILI", "AWD"])
      : new Set([String(diseaseFilter).toUpperCase()]);
  const index = resolveCaseIndex(patients, timeOptions);
  const bucketRanges = buckets.map((bucket) => ({
    start: bucket.start.getTime(),
    end: bucket.end.getTime()
  }));

  const byMuni = new Map(
    listProvinceMunicipalities().map((municipality) => [
      normalizePlaceKey(municipality),
      buckets.map((bucket) => ({ label: bucket.label, cases: 0 }))
    ])
  );

  for (const c of index) {
    if (!diseases.has(c.disease)) continue;
    const series = byMuni.get(c.municipalityKey);
    if (!series) continue;
    const bucketIdx = bucketIndexForTime(c.time, bucketRanges);
    if (bucketIdx >= 0) series[bucketIdx].cases += 1;
  }

  return listProvinceMunicipalities().map((municipality) => ({
    municipality,
    data: byMuni.get(normalizePlaceKey(municipality)) ?? buckets.map((bucket) => ({ label: bucket.label, cases: 0 }))
  }));
}
