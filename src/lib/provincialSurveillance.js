import { MUNICIPALITY_COORDS } from "@/data/barangayCoords";
import {
  BARANGAY_BY_MUNICIPALITY,
  listProvinceMunicipalities,
  provinceBarangayCount,
  resolveMunicipalityKey
} from "@/data/davaoDeOroGeography";
import { COUNT_THRESHOLDS, VELOCITY_MIN_DELTA, VELOCITY_MIN_PCT } from "@/lib/municipalAlerts";
import { normalizeDisease, parseCaseDate } from "@/lib/disease";
import {
  compositeBarangayKey,
  computePctChange,
  getWeeklyBuckets,
  normalizePlaceKey,
  resolveSurveillanceWindows
} from "@/lib/surveillance";

export { listProvinceMunicipalities, provinceBarangayCount };

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

function countForMunicipality(patients, windows, diseaseFilter, municipalityName) {
  const muniKey = normalizePlaceKey(municipalityName);
  const diseases =
    diseaseFilter === "ALL" ? ["DENGUE", "ILI", "AWD"] : [String(diseaseFilter).toUpperCase()];

  let current = 0;
  let prior = 0;
  for (const p of patients) {
    const pm = normalizePlaceKey(p?.municipality);
    if (pm !== muniKey) continue;
    const d = normalizeDisease(p?.diseaseType);
    if (!diseases.includes(d)) continue;
    const dt = parseCaseDate(p);
    if (!dt) continue;
    if (dt >= windows.current.start && dt <= windows.current.end) current += 1;
    else if (dt >= windows.prior.start && dt <= windows.prior.end) prior += 1;
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

  const rows = listProvinceMunicipalities().map((name) => {
    const counts = countForMunicipality(patients, windows, diseaseFilter, name);
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
    diseaseFilter === "ALL" ? ["DENGUE", "ILI", "AWD"] : [String(diseaseFilter).toUpperCase()];
  const muniFilterKey = municipalityFilter ? normalizePlaceKey(municipalityFilter) : null;
  const rows = [];

  for (const [municipality, barangays] of Object.entries(BARANGAY_BY_MUNICIPALITY)) {
    const muniKey = normalizePlaceKey(municipality);
    if (muniFilterKey && muniKey !== muniFilterKey) continue;

    for (const barangay of barangays) {
      const barangayNameKey = normalizePlaceKey(barangay);
      const barangayKey = compositeBarangayKey(municipality, barangay);
      let current = 0;
      let prior = 0;

      for (const p of patients) {
        if (normalizePlaceKey(p?.municipality) !== muniKey) continue;
        if (normalizePlaceKey(p?.barangay) !== barangayNameKey) continue;
        const d = normalizeDisease(p?.diseaseType);
        if (!diseases.includes(d)) continue;
        const dt = parseCaseDate(p);
        if (!dt) continue;
        if (dt >= windows.current.start && dt <= windows.current.end) current += 1;
        else if (dt >= windows.prior.start && dt <= windows.prior.end) prior += 1;
      }

      rows.push({
        municipality,
        municipalityKey: muniKey,
        barangay,
        barangayKey,
        disease: diseaseFilter === "ALL" ? "All diseases" : diseaseFilter,
        current,
        prior,
        delta: current - prior,
        pctChange: computePctChange(current, prior)
      });
    }
  }

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
  const now = Date.now();

  return rows.map((row) => {
    let lastEncodeAt = null;
    let lastBarangay = "";
    const muniKey = row.municipalityKey;

    for (const p of patients) {
      if (normalizePlaceKey(p?.municipality) !== muniKey) continue;
      const dt = parseCaseDate(p);
      if (!dt) continue;
      if (!lastEncodeAt || dt > lastEncodeAt) {
        lastEncodeAt = dt;
        lastBarangay = String(p?.barangay ?? "").trim();
      }
    }

    const minutesAgo =
      lastEncodeAt != null ? Math.max(0, Math.round((now - lastEncodeAt.getTime()) / 60000)) : null;

    return {
      ...row,
      alertLevel: alertLevelForRow(row, diseaseFilter),
      lastEncodeAt,
      lastBarangay,
      minutesAgo
    };
  });
}

/** Municipalities needing cross-municipality PHO coordination. */
export function computeCrossMunicipalityAlerts(statusBoard) {
  return (statusBoard ?? []).filter((r) => r.alertLevel === "high" || r.alertLevel === "elevated");
}

/** Barangays with recent case encodes (surveillance sync health). */
export function computeProvinceSyncHealth(patients) {
  const totalBarangays = provinceBarangayCount();
  const reportingKeys = new Set();
  let lastPatient = null;
  let lastDate = null;

  for (const p of patients) {
    const m = resolveMunicipalityKey(p?.municipality);
    const b = String(p?.barangay ?? "").trim();
    if (m && b) reportingKeys.add(compositeBarangayKey(m, b));

    const dt = parseCaseDate(p);
    if (!dt) continue;
    if (!lastDate || dt > lastDate) {
      lastDate = dt;
      lastPatient = p;
    }
  }

  return {
    totalBarangays,
    reportingBarangays: reportingKeys.size,
    lastEncode: lastPatient
      ? {
          barangay: lastPatient.barangay,
          municipality: lastPatient.municipality,
          at: lastDate
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

  return buckets.map((bucket) => {
    let dengue = 0;
    let ili = 0;
    let awd = 0;
    for (const p of patients) {
      const dt = parseCaseDate(p);
      if (!dt || dt < bucket.start || dt > bucket.end) continue;
      const d = normalizeDisease(p?.diseaseType);
      if (diseaseFilter && diseaseFilter !== "ALL" && d !== String(diseaseFilter).toUpperCase()) {
        continue;
      }
      if (d === "DENGUE") dengue += 1;
      else if (d === "ILI") ili += 1;
      else if (d === "AWD") awd += 1;
    }
    return { label: bucket.label, DENGUE: dengue, ILI: ili, AWD: awd };
  });
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
      ? ["DENGUE", "ILI", "AWD"]
      : [String(diseaseFilter).toUpperCase()];

  return listProvinceMunicipalities().map((municipality) => {
    const muniKey = normalizePlaceKey(municipality);
    const data = buckets.map((bucket) => {
      let cases = 0;
      for (const p of patients) {
        if (normalizePlaceKey(p?.municipality) !== muniKey) continue;
        const dt = parseCaseDate(p);
        if (!dt || dt < bucket.start || dt > bucket.end) continue;
        const d = normalizeDisease(p?.diseaseType);
        if (!diseases.includes(d)) continue;
        cases += 1;
      }
      return { label: bucket.label, cases };
    });
    return { municipality, data };
  });
}
