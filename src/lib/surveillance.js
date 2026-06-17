import { normalizeDisease, parseCaseDate } from "./disease";

export function normalizePlaceKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Province-wide unique key for a barangay (names repeat across municipalities). */
export function compositeBarangayKey(municipality, barangay) {
  return `${normalizePlaceKey(municipality)}|${normalizePlaceKey(barangay)}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Rolling N-week window and the N weeks immediately before it. */
export function getComparisonWindows(weekCount, referenceDate = new Date(), periodOffset = 0) {
  const weeks = Math.max(1, Number(weekCount) || 4);
  const spanDays = weeks * 7;

  const ref = new Date(referenceDate);
  if (periodOffset > 0) {
    ref.setDate(ref.getDate() - periodOffset * spanDays);
  }

  const currentEnd = endOfDay(ref);
  const currentStart = startOfDay(ref);
  currentStart.setDate(currentStart.getDate() - (spanDays - 1));

  const priorEnd = new Date(currentStart);
  priorEnd.setDate(priorEnd.getDate() - 1);
  priorEnd.setHours(23, 59, 59, 999);

  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (spanDays - 1));
  priorStart.setHours(0, 0, 0, 0);

  return {
    weeks,
    mode: "weeks",
    current: { start: currentStart, end: currentEnd },
    prior: { start: priorStart, end: priorEnd }
  };
}

/** Calendar month vs previous calendar month (periodOffset shifts month backward). */
export function getMonthComparisonWindows(referenceDate = new Date(), periodOffset = 0) {
  const ref = new Date(referenceDate);
  ref.setMonth(ref.getMonth() - periodOffset);

  const currentStart = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
  const currentEnd = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));

  const priorStart = startOfDay(new Date(ref.getFullYear(), ref.getMonth() - 1, 1));
  const priorEnd = endOfDay(new Date(ref.getFullYear(), ref.getMonth(), 0));

  return {
    weeks: null,
    mode: "month",
    current: { start: currentStart, end: currentEnd },
    prior: { start: priorStart, end: priorEnd }
  };
}

export function resolveSurveillanceWindows({
  windowWeeks = 4,
  windowMode = "weeks",
  periodOffset = 0,
  referenceDate = new Date()
} = {}) {
  if (windowMode === "month") {
    return getMonthComparisonWindows(referenceDate, periodOffset);
  }
  return getComparisonWindows(windowWeeks, referenceDate, periodOffset);
}

/** @returns {{ start: Date, end: Date, label: string }[]} oldest → newest */
export function getWeeklyBuckets(weekCount, referenceDate = new Date(), periodOffset = 0) {
  const weeks = Math.max(1, Number(weekCount) || 4);
  const spanDays = weeks * 7;
  const ref = new Date(referenceDate);
  if (periodOffset > 0) {
    ref.setDate(ref.getDate() - periodOffset * spanDays);
  }

  const end = endOfDay(ref);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const bucketEnd = new Date(end);
    bucketEnd.setDate(bucketEnd.getDate() - i * 7);
    const bucketStart = new Date(bucketEnd);
    bucketStart.setDate(bucketStart.getDate() - 6);
    bucketStart.setHours(0, 0, 0, 0);
    const be = endOfDay(bucketEnd);
    const a = bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const b = be.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    buckets.push({ start: bucketStart, end: be, label: `${a} – ${b}` });
  }
  return buckets;
}

export function formatPeriodCaption(windows, { windowMode = "weeks", windowWeeks = 4, periodOffset = 0 } = {}) {
  if (!windows?.current) return "—";
  const current = formatWindowLabel(windows.current);
  const prior = formatWindowLabel(windows.prior);
  const offsetNote = periodOffset > 0 ? ` · ${periodOffset} period(s) earlier` : "";
  if (windowMode === "month") {
    return `This month (${current}) vs prior month (${prior})${offsetNote} · raw case counts`;
  }
  return `${windowWeeks}-week window (${current}) vs prior ${windowWeeks} weeks (${prior})${offsetNote} · raw case counts`;
}

/** Last 7 calendar days vs the 7 days before that (week-over-week). */
export function getWeekOverWeekWindows(referenceDate = new Date()) {
  const currentEnd = endOfDay(referenceDate);
  const currentStart = startOfDay(referenceDate);
  currentStart.setDate(currentStart.getDate() - 6);

  const priorEnd = new Date(currentStart);
  priorEnd.setDate(priorEnd.getDate() - 1);
  priorEnd.setHours(23, 59, 59, 999);

  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - 6);
  priorStart.setHours(0, 0, 0, 0);

  return {
    current: { start: currentStart, end: currentEnd },
    prior: { start: priorStart, end: priorEnd }
  };
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

/**
 * Pre-parse case rows once so dashboards can aggregate in a single pass
 * instead of re-scanning the full patient list on every filter change.
 * @param {object[]} patients
 * @returns {{ time: number, disease: string, barangayKey: string, municipalityKey: string, isActive: boolean, barangay: string }[]}
 */
export function buildSurveillanceIndex(patients) {
  if (!Array.isArray(patients) || patients.length === 0) return [];

  const index = [];
  for (const p of patients) {
    const dt = parseCaseDate(p);
    if (!dt) continue;
    const disease = normalizeDisease(p?.diseaseType);
    if (!disease) continue;
    index.push({
      time: dt.getTime(),
      disease,
      barangayKey: normalizePlaceKey(p?.barangay),
      municipalityKey: normalizePlaceKey(p?.municipality),
      municipality: String(p?.municipality ?? "").trim(),
      isActive: String(p?.caseStatus ?? "active").toLowerCase() === "active",
      barangay: String(p?.barangay ?? "").trim()
    });
  }
  return index;
}

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

/**
 * @param {object[]} patients
 * @param {{ start: Date, end: Date }} window
 * @param {{ disease?: string, barangayKey?: string }} filters
 */
export function countCasesInWindow(patients, window, filters = {}, timeOptions = {}) {
  if (!window) return 0;
  const index = resolveCaseIndex(patients, timeOptions);
  if (index.length === 0) return 0;

  const diseaseFilter = filters.disease ? String(filters.disease).toUpperCase() : null;
  const barangayKey = filters.barangayKey ?? null;
  const start = window.start.getTime();
  const end = window.end.getTime();

  let n = 0;
  for (const c of index) {
    if (c.time < start || c.time > end) continue;
    if (diseaseFilter && c.disease !== diseaseFilter) continue;
    if (barangayKey && c.barangayKey !== barangayKey) continue;
    n += 1;
  }
  return n;
}

export function formatWindowLabel(window) {
  if (!window?.start || !window?.end) return "—";
  const a = window.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = window.end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${a} – ${b}`;
}

export function computePctChange(current, prior) {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

export function formatDeltaLabel(delta) {
  if (delta > 0) return `+${delta} vs prior period`;
  if (delta < 0) return `${delta} vs prior period`;
  return "No change vs prior period";
}

/**
 * KPI for one disease: count in rolling window + WoW (last 7d vs prior 7d).
 * @param {object[]} patients — confirmed cases only
 */
export function computeDiseaseKpi(patients, disease, windowWeeks, timeOptions = {}) {
  const all = computeAllDiseaseKpis(patients, windowWeeks, timeOptions);
  const key = String(disease).toUpperCase();
  if (key === "AWD") return all.awd;
  if (key === "ILI") return all.ili;
  return all.dengue;
}

/** KPI cards for all three diseases in one indexed pass. */
export function computeAllDiseaseKpis(patients, windowWeeks, timeOptions = {}) {
  const index = resolveCaseIndex(patients, timeOptions);
  const windows =
    timeOptions.windows ??
    resolveSurveillanceWindows({
      windowWeeks,
      windowMode: timeOptions.windowMode,
      periodOffset: timeOptions.periodOffset,
      referenceDate: timeOptions.referenceDate
    });
  const wow = getWeekOverWeekWindows(timeOptions.referenceDate ?? new Date());

  const windowStart = windows.current.start.getTime();
  const windowEnd = windows.current.end.getTime();
  const wowCurrentStart = wow.current.start.getTime();
  const wowCurrentEnd = wow.current.end.getTime();
  const wowPriorStart = wow.prior.start.getTime();
  const wowPriorEnd = wow.prior.end.getTime();
  const windowLabel = formatWindowLabel(windows.current);

  const stats = {
    DENGUE: { windowCount: 0, wowCurrent: 0, wowPrior: 0, activeCount: 0 },
    ILI: { windowCount: 0, wowCurrent: 0, wowPrior: 0, activeCount: 0 },
    AWD: { windowCount: 0, wowCurrent: 0, wowPrior: 0, activeCount: 0 }
  };

  for (const c of index) {
    const row = stats[c.disease];
    if (!row) continue;
    if (c.isActive) row.activeCount += 1;
    const t = c.time;
    if (t >= windowStart && t <= windowEnd) row.windowCount += 1;
    if (t >= wowCurrentStart && t <= wowCurrentEnd) row.wowCurrent += 1;
    if (t >= wowPriorStart && t <= wowPriorEnd) row.wowPrior += 1;
  }

  function pack(diseaseKey) {
    const row = stats[diseaseKey];
    return {
      windowCount: row.windowCount,
      wowDelta: row.wowCurrent - row.wowPrior,
      wowCurrent: row.wowCurrent,
      wowPrior: row.wowPrior,
      activeCount: row.activeCount,
      windowLabel
    };
  }

  return {
    awd: pack("AWD"),
    ili: pack("ILI"),
    dengue: pack("DENGUE")
  };
}

/**
 * Velocity rows per barangay for municipal dashboard.
 * @param {object[]} patients — confirmed, municipality-scoped
 * @param {string[]} barangayNames — all barangays in municipality
 * @param {number} windowWeeks — 2, 3, or 4
 * @param {string} diseaseFilter — DENGUE | ILI | AWD | ALL
 */
export function computeBarangayVelocityRows(
  patients,
  barangayNames,
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
  const diseases =
    diseaseFilter === "ALL" ? ["DENGUE", "ILI", "AWD"] : [String(diseaseFilter).toUpperCase()];
  const diseaseSet = new Set(diseases);
  const index = resolveCaseIndex(patients, timeOptions);

  const currentStart = windows.current.start.getTime();
  const currentEnd = windows.current.end.getTime();
  const priorStart = windows.prior.start.getTime();
  const priorEnd = windows.prior.end.getTime();

  const tallies = new Map();
  for (const name of barangayNames) {
    tallies.set(normalizePlaceKey(name), { barangay: name, current: 0, prior: 0 });
  }

  for (const c of index) {
    if (!diseaseSet.has(c.disease)) continue;
    const row = tallies.get(c.barangayKey);
    if (!row) continue;
    if (c.time >= currentStart && c.time <= currentEnd) row.current += 1;
    else if (c.time >= priorStart && c.time <= priorEnd) row.prior += 1;
  }

  const rows = barangayNames.map((name) => {
    const barangayKey = normalizePlaceKey(name);
    const tally = tallies.get(barangayKey) ?? { current: 0, prior: 0 };
    const current = tally.current;
    const prior = tally.prior;
    const delta = current - prior;
    return {
      barangay: name,
      barangayKey,
      disease: diseaseFilter === "ALL" ? "All diseases" : diseaseFilter,
      current,
      prior,
      delta,
      pctChange: computePctChange(current, prior)
    };
  });

  rows.sort((a, b) => b.delta - a.delta || b.current - a.current || a.barangay.localeCompare(b.barangay));

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Weekly case counts for municipality trend chart (all diseases).
 * @returns {{ label: string, DENGUE: number, ILI: number, AWD: number }[]}
 */
export function computeMunicipalityWeeklyTrend(patients, weekCount = 8, timeOptions = {}) {
  const buckets = getWeeklyBuckets(
    weekCount,
    timeOptions.referenceDate ?? new Date(),
    timeOptions.periodOffset ?? 0
  );
  const diseases =
    timeOptions.diseaseFilter === "ALL" || !timeOptions.diseaseFilter
      ? new Set(["DENGUE", "ILI", "AWD"])
      : new Set([String(timeOptions.diseaseFilter).toUpperCase()]);
  const index = resolveCaseIndex(patients, timeOptions);
  const bucketRanges = buckets.map((bucket) => ({
    start: bucket.start.getTime(),
    end: bucket.end.getTime()
  }));

  const counts = buckets.map((bucket) => ({
    label: bucket.label,
    week: bucket.label,
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

/** Weekly series for one barangay (top-riser small multiples). */
export function computeBarangayWeeklyTrend(
  patients,
  barangayKey,
  weekCount = 8,
  timeOptions = {}
) {
  const buckets = getWeeklyBuckets(
    weekCount,
    timeOptions.referenceDate ?? new Date(),
    timeOptions.periodOffset ?? 0
  );
  const filterDisease = timeOptions.diseaseFilter;
  const diseases =
    filterDisease === "ALL" || !filterDisease
      ? new Set(["DENGUE", "ILI", "AWD"])
      : new Set([String(filterDisease).toUpperCase()]);
  const index = resolveCaseIndex(patients, timeOptions);
  const bucketRanges = buckets.map((bucket) => ({
    start: bucket.start.getTime(),
    end: bucket.end.getTime()
  }));
  const totals = buckets.map(() => 0);

  for (const c of index) {
    if (c.barangayKey !== barangayKey) continue;
    if (!diseases.has(c.disease)) continue;
    const bucketIdx = bucketIndexForTime(c.time, bucketRanges);
    if (bucketIdx >= 0) totals[bucketIdx] += 1;
  }

  return buckets.map((bucket, i) => ({ label: bucket.label, cases: totals[i] }));
}
