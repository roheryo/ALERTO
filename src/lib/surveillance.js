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
 * @param {object[]} patients
 * @param {{ start: Date, end: Date }} window
 * @param {{ disease?: string, barangayKey?: string }} filters
 */
export function countCasesInWindow(patients, window, filters = {}) {
  if (!Array.isArray(patients) || !window) return 0;
  const diseaseFilter = filters.disease ? String(filters.disease).toUpperCase() : null;
  const barangayKey = filters.barangayKey ?? null;

  let n = 0;
  for (const p of patients) {
    const dt = parseCaseDate(p);
    if (!dt || !inRange(dt, window.start, window.end)) continue;

    const disease = normalizeDisease(p?.diseaseType);
    if (diseaseFilter && disease !== diseaseFilter) continue;

    if (barangayKey) {
      const key = normalizePlaceKey(p?.barangay);
      if (key !== barangayKey) continue;
    }

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
  const windows =
    timeOptions.windows ??
    resolveSurveillanceWindows({
      windowWeeks,
      windowMode: timeOptions.windowMode,
      periodOffset: timeOptions.periodOffset,
      referenceDate: timeOptions.referenceDate
    });
  const wow = getWeekOverWeekWindows(timeOptions.referenceDate ?? new Date());

  const windowCount = countCasesInWindow(patients, windows.current, { disease });
  const wowCurrent = countCasesInWindow(patients, wow.current, { disease });
  const wowPrior = countCasesInWindow(patients, wow.prior, { disease });
  const wowDelta = wowCurrent - wowPrior;

  const activeCount = patients.filter(
    (p) =>
      normalizeDisease(p?.diseaseType) === disease &&
      String(p?.caseStatus ?? "active").toLowerCase() === "active"
  ).length;

  return {
    windowCount,
    wowDelta,
    wowCurrent,
    wowPrior,
    activeCount,
    windowLabel: formatWindowLabel(windows.current)
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

  const rows = [];

  for (const name of barangayNames) {
    const barangayKey = normalizePlaceKey(name);
    let current = 0;
    let prior = 0;

    for (const disease of diseases) {
      current += countCasesInWindow(patients, windows.current, { disease, barangayKey });
      prior += countCasesInWindow(patients, windows.prior, { disease, barangayKey });
    }

    const delta = current - prior;
    const pctChange = computePctChange(current, prior);

    rows.push({
      barangay: name,
      barangayKey,
      disease: diseaseFilter === "ALL" ? "All diseases" : diseaseFilter,
      current,
      prior,
      delta,
      pctChange
    });
  }

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
  const diseaseFilter = (d) => {
    const diseases =
      timeOptions.diseaseFilter === "ALL" || !timeOptions.diseaseFilter
        ? ["DENGUE", "ILI", "AWD"]
        : [String(timeOptions.diseaseFilter).toUpperCase()];
    return diseases.includes(d);
  };

  return buckets.map((bucket) => {
    let dengue = 0;
    let ili = 0;
    let awd = 0;
    for (const p of patients) {
      const dt = parseCaseDate(p);
      if (!dt || !inRange(dt, bucket.start, bucket.end)) continue;
      const d = normalizeDisease(p?.diseaseType);
      if (!diseaseFilter(d)) continue;
      if (d === "DENGUE") dengue += 1;
      else if (d === "ILI") ili += 1;
      else if (d === "AWD") awd += 1;
    }
    return { label: bucket.label, week: bucket.label, DENGUE: dengue, ILI: ili, AWD: awd };
  });
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
      ? ["DENGUE", "ILI", "AWD"]
      : [String(filterDisease).toUpperCase()];

  return buckets.map((bucket) => {
    let total = 0;
    for (const p of patients) {
      const dt = parseCaseDate(p);
      if (!dt || !inRange(dt, bucket.start, bucket.end)) continue;
      if (normalizePlaceKey(p?.barangay) !== barangayKey) continue;
      const d = normalizeDisease(p?.diseaseType);
      if (!diseases.includes(d)) continue;
      total += 1;
    }
    return { label: bucket.label, cases: total };
  });
}
