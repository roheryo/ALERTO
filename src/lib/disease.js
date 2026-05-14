/** Normalize free-text disease labels to AWD | ILI | DENGUE | other uppercase token. */
export function normalizeDisease(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) {
    return "AWD";
  }
  if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) {
    return "ILI";
  }
  if (v.includes("dengue")) {
    return "DENGUE";
  }
  return v.toUpperCase();
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** @returns {{ start: Date, end: Date, label: string }[]} oldest → newest (4 buckets, 7 days each) */
export function getLastFourWeekBuckets(referenceDate = new Date()) {
  const end = endOfDay(referenceDate);
  const buckets = [];
  for (let i = 3; i >= 0; i -= 1) {
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

export function parseCaseDate(patient) {
  const raw =
    patient?.dateStarted ??
    patient?.dateReported ??
    patient?.reportDate ??
    patient?.createdAt ??
    patient?.date;
  if (raw == null || raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Count cases per disease per week bucket. Patients without parseable dates are
 * omitted from weekly series (KPI totals still include them).
 */
export function weeklyDiseaseCounts(patients, buckets, normalize = normalizeDisease) {
  const dengue = buckets.map(() => 0);
  const ili = buckets.map(() => 0);
  const awd = buckets.map(() => 0);

  if (!Array.isArray(patients)) {
    return { dengue, ili, awd };
  }

  for (const p of patients) {
    const disease = normalize(p?.diseaseType);
    if (disease !== "DENGUE" && disease !== "ILI" && disease !== "AWD") continue;
    const dt = parseCaseDate(p);
    if (!dt) continue;
    for (let w = 0; w < buckets.length; w += 1) {
      const { start, end } = buckets[w];
      if (dt >= start && dt <= end) {
        if (disease === "DENGUE") dengue[w] += 1;
        else if (disease === "ILI") ili[w] += 1;
        else awd[w] += 1;
        break;
      }
    }
  }

  return { dengue, ili, awd };
}

/** When weekly buckets have no dated cases, spread totals across weeks (remainder on latest weeks). */
export function syntheticWeeklyFromTotals(totalDengue, totalIli, totalAwd, weekCount = 4) {
  const spread = (n) => {
    if (n <= 0) return Array.from({ length: weekCount }, () => 0);
    const base = Math.floor(n / weekCount);
    const rem = n % weekCount;
    return Array.from({ length: weekCount }, (_, i) => base + (i >= weekCount - rem ? 1 : 0));
  };
  return {
    dengue: spread(totalDengue),
    ili: spread(totalIli),
    awd: spread(totalAwd)
  };
}
