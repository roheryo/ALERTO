/**
 * Generate balanced, weather-correlated synthetic CONFIRMED cases for the
 * ALERTO LSTM training set.
 *
 *   Disease balance:
 *     ~equal totals across DENGUE / ILI / AWD (default ~6000 each) so the
 *     LSTM trains with comparable signal strength for every disease head.
 *
 *   Weather correlation (real archive, NOT fabricated):
 *     Reads data/processed/weather_daily.csv (already produced by
 *     fetch-weather-history.mjs) and computes per-week aggregates +
 *     lagged rainfall. Disease incidence is driven by a Poisson rate λ that
 *     depends on z-scored temperature, humidity, rainfall, and lagged
 *     rainfall — matching the published epidemiology each disease:
 *
 *       DENGUE  : rainfall 4-6wk lag (mosquito breeding cycle),
 *                 warm temp, humidity, peak Aug–Nov
 *       ILI     : cool/transition periods, indoor crowding pressure,
 *                 peak Jun–Sep + Dec–Feb
 *       AWD     : rainfall 1-3wk lag (contaminated runoff), flooding,
 *                 peak Jun–Oct
 *
 *   Environmental correlation:
 *     Each synthetic case also produces a `case_environmental` row whose
 *     boolean / categorical flags are sampled with disease-specific
 *     priors AND weighted by that week's weather (e.g. recent_heavy_rain
 *     is more likely in high-rainfall weeks; flood_history_4wk depends on
 *     the trailing 4-week rainfall sum; AWD cases are more likely to
 *     report unimproved water / open defecation).
 *
 *   Source-of-truth compatibility:
 *     Every inserted row sets:
 *       case_classification = 'Confirmed'   (rule 1 of build-ml-datasets)
 *       created_by          = <BHU user>    (rule 2 of build-ml-datasets)
 *     so the default `node backend/scripts/build-ml-datasets.mjs` will pick
 *     up the synthesis run without `--include-imported`.
 *
 * Usage:
 *   node backend/scripts/generate-synthetic-cases.mjs                  # insert
 *   node backend/scripts/generate-synthetic-cases.mjs --dry-run        # plan only
 *   node backend/scripts/generate-synthetic-cases.mjs --purge          # drop prior SYN-* first
 *   node backend/scripts/generate-synthetic-cases.mjs --target 4500    # cases/disease
 *   node backend/scripts/generate-synthetic-cases.mjs --seed 7         # reproducibility
 *   node backend/scripts/generate-synthetic-cases.mjs --start 2023-06-05 --end 2026-05-11
 *
 * After running:
 *   npm run ml:build-dataset   # rebuilds surveillance_weekly_training.csv
 *   npm run ml:train           # retrain the three LSTMs
 *   npm run ml:eval            # baselines + LSTM benchmark
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// --------------------------------------------------------------------------- //
// CLI                                                                          //
// --------------------------------------------------------------------------- //

function parseArgs(argv) {
  const opts = {
    weather: path.join(REPO_ROOT, "data", "processed", "weather_daily.csv"),
    summaryOut: path.join(REPO_ROOT, "data", "processed", "synthetic_case_summary.csv"),
    targetPerDisease: 6000,
    seed: 42,
    start: null,
    end: null,
    // Per-disease synthesis windows (thesis synthetic-data spec):
    //   ILI    -> from the day after the last real ILI entry through `end`
    //   DENGUE -> `start`..`end` EXCEPT calendar year 2025 (real data exists)
    //   AWD    -> full `start`..`end`
    iliStart: null,            // YYYY-MM-DD; defaults to `start` if omitted
    dengueSkipYears: [2025],   // calendar years Dengue synthesis must NOT cover
    purge: false,
    dryRun: false,
    batchSize: 500
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--weather" && next) {
      opts.weather = path.isAbsolute(next) ? next : path.join(REPO_ROOT, next);
      i += 1;
    } else if (arg === "--out" && next) {
      opts.summaryOut = path.isAbsolute(next) ? next : path.join(REPO_ROOT, next);
      i += 1;
    } else if (arg === "--target" && next) {
      opts.targetPerDisease = Math.max(100, Number(next) || 6000);
      i += 1;
    } else if (arg === "--seed" && next) {
      opts.seed = Number(next) >>> 0;
      i += 1;
    } else if (arg === "--start" && next) {
      opts.start = next;
      i += 1;
    } else if (arg === "--end" && next) {
      opts.end = next;
      i += 1;
    } else if (arg === "--ili-start" && next) {
      opts.iliStart = next;
      i += 1;
    } else if (arg === "--dengue-skip-years" && next) {
      opts.dengueSkipYears = next
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      i += 1;
    } else if (arg === "--batch" && next) {
      opts.batchSize = Math.max(50, Number(next) || 500);
      i += 1;
    } else if (arg === "--purge") {
      opts.purge = true;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }
  return opts;
}

// --------------------------------------------------------------------------- //
// Deterministic PRNG + samplers                                                //
// --------------------------------------------------------------------------- //

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function bernoulli(rng, p) {
  return rng() < clamp(p, 0, 1) ? 1 : 0;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** Box–Muller. */
function normal(rng, mu = 0, sigma = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mu + sigma * z;
}

/**
 * Poisson(λ). Knuth for λ < 30, normal approximation otherwise.
 */
function poisson(rng, lambda) {
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= rng();
    } while (p > L);
    return k - 1;
  }
  const x = normal(rng, lambda, Math.sqrt(lambda));
  return Math.max(0, Math.round(x));
}

/** Gamma(α=1, scale=1) is Exponential(1). For α=k positive integer use sum of k exponentials. */
function gamma1(rng) {
  return -Math.log(1 - rng());
}

/** Sample a probability simplex of length n from Dirichlet(α…α). Approx using Gamma(1). */
function dirichlet(rng, n, alpha = 1) {
  const xs = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    let g = 0;
    for (let k = 0; k < alpha; k += 1) g += gamma1(rng);
    xs[i] = g + 1e-9;
    s += xs[i];
  }
  for (let i = 0; i < n; i += 1) xs[i] /= s;
  return xs;
}

/** Weighted categorical sample from {value: weight} object. */
function categorical(rng, choices) {
  const total = choices.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [v, w] of choices) {
    r -= w;
    if (r <= 0) return v;
  }
  return choices[choices.length - 1][0];
}

// --------------------------------------------------------------------------- //
// Date helpers (ISO weeks, Monday-start buckets, UTC)                          //
// --------------------------------------------------------------------------- //

function ymd(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function parseYmd(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Generator: each Monday in [start, end] inclusive. */
function* eachMonday(start, end) {
  const cursor = weekStart(start);
  while (cursor <= end) {
    yield new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// --------------------------------------------------------------------------- //
// Per-disease synthesis windows                                               //
// --------------------------------------------------------------------------- //

/**
 * A window is an inclusive [start, end] pair of Dates. A disease may have one
 * or more windows; a week (its Monday) is eligible if it falls inside ANY of
 * the disease's windows.
 */
function inAnyWindow(windows, monday) {
  if (!windows || !windows.length) return true; // no restriction
  for (const [s, e] of windows) {
    if (monday >= s && monday <= e) return true;
  }
  return false;
}

/**
 * Subtract one or more full calendar years from a single [start, end] range,
 * returning the surviving sub-ranges (so Dengue can skip the real-data year(s)
 * while still covering everything before and after).
 */
function subtractYears(start, end, years) {
  let ranges = [[new Date(start), new Date(end)]];
  for (const year of years) {
    const yStart = new Date(Date.UTC(year, 0, 1));
    const yEnd = new Date(Date.UTC(year, 11, 31));
    const next = [];
    for (const [s, e] of ranges) {
      if (yEnd < s || yStart > e) {
        next.push([s, e]); // no overlap
        continue;
      }
      if (s < yStart) next.push([s, addDays(yStart, -1)]); // segment before the skipped year
      if (e > yEnd) next.push([addDays(yEnd, 1), e]);       // segment after the skipped year
    }
    ranges = next;
  }
  return ranges;
}

/**
 * Build the per-disease window map from the resolved global synthesis range and
 * the CLI options. See parseArgs() for the thesis spec these encode.
 */
function buildDiseaseWindows(opts, startMonday, endMonday) {
  const iliStart = parseYmd(opts.iliStart) ?? startMonday;
  return {
    ILI: [[weekStart(iliStart), endMonday]],
    AWD: [[startMonday, endMonday]],
    DENGUE: subtractYears(startMonday, endMonday, opts.dengueSkipYears ?? [])
  };
}

// --------------------------------------------------------------------------- //
// CSV utilities                                                                //
// --------------------------------------------------------------------------- //

function parseCsv(text) {
  const out = [];
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return out;
  const header = lines[0].split(",");
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const obj = {};
    header.forEach((h, j) => {
      obj[h] = parts[j] ?? "";
    });
    out.push(obj);
  }
  return out;
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// --------------------------------------------------------------------------- //
// MySQL loaders                                                                //
// --------------------------------------------------------------------------- //

async function loadGeography() {
  const [muniRows] = await pool.query(
    `SELECT id, name FROM municipalities ORDER BY id`
  );
  const [bgys] = await pool.query(
    `SELECT id, municipality_id AS municipalityId, name
     FROM barangays
     ORDER BY municipality_id, id`
  );
  const byMuni = new Map();
  for (const m of muniRows) byMuni.set(m.id, { id: m.id, name: m.name, barangays: [] });
  for (const b of bgys) {
    const muni = byMuni.get(b.municipalityId);
    if (muni) muni.barangays.push({ id: b.id, name: b.name });
  }
  const munis = [...byMuni.values()].filter((m) => m.barangays.length > 0);
  return { munis, byMuni, totalBarangays: bgys.length };
}

async function loadBhuUsers() {
  const [rows] = await pool.query(
    `SELECT id, role, municipality_id AS municipalityId, barangay_id AS barangayId
     FROM users
     WHERE is_active = 1 AND role IN ('barangay', 'municipality')`
  );
  const byBarangay = new Map();
  const byMunicipality = new Map();
  for (const r of rows) {
    if (r.role === "barangay" && r.barangayId) byBarangay.set(r.barangayId, r.id);
    if (r.role === "municipality" && r.municipalityId && !byMunicipality.has(r.municipalityId)) {
      byMunicipality.set(r.municipalityId, r.id);
    }
  }
  return { byBarangay, byMunicipality };
}

// --------------------------------------------------------------------------- //
// Weather loading + weekly aggregation                                         //
// --------------------------------------------------------------------------- //

async function loadWeatherDaily(weatherCsv) {
  const text = await fs.readFile(weatherCsv, "utf-8").catch((err) => {
    if (err?.code === "ENOENT") {
      throw new Error(
        `Weather CSV not found at ${weatherCsv}. Run:\n  node backend/scripts/fetch-weather-history.mjs`
      );
    }
    throw err;
  });
  const rows = parseCsv(text);
  /** @type {Map<string, Map<string, { temp:number|null, hum:number|null, rain:number|null }>>} */
  const byMuni = new Map();
  let minDate = null;
  let maxDate = null;
  for (const r of rows) {
    const muni = String(r.municipality_name ?? "").trim();
    const date = String(r.date ?? "").trim();
    if (!muni || !date) continue;
    const inner = byMuni.get(muni) ?? new Map();
    inner.set(date, {
      temp: num(r.temp_mean_c),
      hum: num(r.humidity_mean_pct),
      rain: num(r.rainfall_sum_mm)
    });
    byMuni.set(muni, inner);
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }
  return { byMuni, minDate, maxDate };
}

function aggregateWeek(dailyByMuni, muniName, monday) {
  const inner = dailyByMuni.get(muniName);
  if (!inner) return { temp: null, hum: null, rain: null, days: 0 };
  let tSum = 0;
  let tN = 0;
  let hSum = 0;
  let hN = 0;
  let rSum = 0;
  let rN = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = inner.get(ymd(addDays(monday, i)));
    if (!d) continue;
    if (d.temp != null) { tSum += d.temp; tN += 1; }
    if (d.hum != null) { hSum += d.hum; hN += 1; }
    if (d.rain != null) { rSum += d.rain; rN += 1; }
  }
  return {
    temp: tN ? tSum / tN : null,
    hum: hN ? hSum / hN : null,
    rain: rN ? rSum : null,
    days: Math.max(tN, hN, rN)
  };
}

/** Compute global μ, σ for temp / humidity / rainfall across all (muni, week). */
function computeZStats(weatherByMuniWeek) {
  const sums = { temp: [0, 0, 0], hum: [0, 0, 0], rain: [0, 0, 0] };
  for (const muniMap of weatherByMuniWeek.values()) {
    for (const w of muniMap.values()) {
      if (w.temp != null) { sums.temp[0] += w.temp; sums.temp[1] += w.temp * w.temp; sums.temp[2] += 1; }
      if (w.hum != null) { sums.hum[0] += w.hum; sums.hum[1] += w.hum * w.hum; sums.hum[2] += 1; }
      if (w.rain != null) { sums.rain[0] += w.rain; sums.rain[1] += w.rain * w.rain; sums.rain[2] += 1; }
    }
  }
  function mu_sigma([s, ss, n]) {
    if (!n) return { mu: 0, sigma: 1 };
    const mu = s / n;
    const variance = Math.max(1e-9, ss / n - mu * mu);
    return { mu, sigma: Math.sqrt(variance) };
  }
  return {
    temp: mu_sigma(sums.temp),
    hum: mu_sigma(sums.hum),
    rain: mu_sigma(sums.rain)
  };
}

// --------------------------------------------------------------------------- //
// Disease incidence model (per municipality × ISO-week × disease)              //
// --------------------------------------------------------------------------- //

const DISEASE_LABEL = {
  DENGUE: "Dengue Fever",
  ILI: "Influenza-like illness (ILI)",
  AWD: "Acute Watery Diarrhea (AWD)"
};

/**
 * Multiplicative seasonality factor per disease.
 * Davao region is tropical: wet season ~Jun–Nov; cool dry Dec–Feb; hot dry Mar–May.
 */
function seasonality(disease, monthIndex) {
  const m = monthIndex; // 0..11
  if (disease === "DENGUE") {
    // Peak Aug-Nov, trough Feb-Apr.
    const peakMonths = [7, 8, 9, 10];
    const lowMonths = [1, 2, 3];
    if (peakMonths.includes(m)) return 1.7;
    if (lowMonths.includes(m)) return 0.55;
    return 1.0;
  }
  if (disease === "ILI") {
    // Bimodal: rainy-season respiratory (Jun-Sep) + cool dry (Dec-Feb).
    const peakA = [5, 6, 7, 8];
    const peakB = [11, 0, 1];
    const trough = [3, 4];
    if (peakA.includes(m) || peakB.includes(m)) return 1.45;
    if (trough.includes(m)) return 0.65;
    return 1.0;
  }
  if (disease === "AWD") {
    // Peak Jun-Oct (rainy, runoff), secondary Dec-Jan; trough Mar-Apr.
    const peak = [5, 6, 7, 8, 9];
    const peakB = [11, 0];
    const trough = [2, 3];
    if (peak.includes(m)) return 1.55;
    if (peakB.includes(m)) return 1.20;
    if (trough.includes(m)) return 0.55;
    return 1.0;
  }
  return 1.0;
}

/**
 * Compute Poisson rate λ for one (disease, municipality, ISO-week) using z-scored
 * meteorology, lagged rainfall, and a per-municipality size factor.
 *
 * λ = base * sizeFactor * season(month) * exp( β · z_features )
 */
function lambdaFor(disease, ctx) {
  const { z, zLag4, zLag6, zLag2, zRoll4, season } = ctx;
  let logFactor = 0;
  if (disease === "DENGUE") {
    logFactor =
      0.22 * z.temp +
      0.12 * z.hum +
      0.10 * z.rain +
      0.35 * zLag6 +
      0.18 * zLag4;
  } else if (disease === "ILI") {
    logFactor =
      -0.20 * z.temp +
      0.10 * z.hum +
      0.05 * z.rain +
      0.08 * zLag2;
  } else if (disease === "AWD") {
    logFactor =
      0.05 * z.temp +
      0.18 * z.rain +
      0.30 * zLag2 +
      0.18 * zLag4 +
      0.25 * Math.max(0, zRoll4);
  }
  // Cap at exp(±2) to keep counts plausible.
  const adj = Math.exp(clamp(logFactor, -2, 2));
  return ctx.base * ctx.sizeFactor * season * adj;
}

// --------------------------------------------------------------------------- //
// Per-case environmental factor sampler                                        //
// --------------------------------------------------------------------------- //

const WATER_SOURCES_BY_DISEASE = {
  DENGUE: [["piped", 0.55], ["shared", 0.27], ["unimproved", 0.13], ["none", 0.05]],
  ILI:    [["piped", 0.58], ["shared", 0.25], ["unimproved", 0.12], ["none", 0.05]],
  AWD:    [["piped", 0.25], ["shared", 0.30], ["unimproved", 0.30], ["none", 0.15]]
};

const SANITATION_BY_DISEASE = {
  DENGUE: [["flush", 0.55], ["pit", 0.30], ["open", 0.08], ["none", 0.07]],
  ILI:    [["flush", 0.55], ["pit", 0.30], ["open", 0.08], ["none", 0.07]],
  AWD:    [["flush", 0.32], ["pit", 0.40], ["open", 0.20], ["none", 0.08]]
};

/**
 * Sample one case's environmental record. Flag probabilities are disease-
 * specific AND weighted by that week's meteorological signal so that the
 * downstream `pct_stagnant_water_4wk`, `pct_recent_heavy_rain_4wk`, etc.
 * features correlate with the rainfall/flood signal the LSTM also sees.
 */
function sampleEnvironment(rng, disease, weatherCtx) {
  const { zRain, zRoll4 } = weatherCtx;
  const rainBoost = clamp((zRain + 1) / 2, 0, 1); // 0..1 from "very dry" → "very wet"
  const floodBoost = clamp(zRoll4, 0, 1.5);
  const droughtBoost = clamp(-zRoll4, 0, 1.5);

  let pStagnant;
  let pRecentRain;
  let pCrowding;
  if (disease === "DENGUE") {
    pStagnant = 0.55 + 0.20 * rainBoost;
    pRecentRain = 0.45 + 0.35 * rainBoost;
    pCrowding = 0.18;
  } else if (disease === "ILI") {
    pStagnant = 0.15 + 0.05 * rainBoost;
    pRecentRain = 0.40 + 0.30 * rainBoost;
    pCrowding = 0.62;
  } else {
    pStagnant = 0.30 + 0.15 * rainBoost;
    pRecentRain = 0.55 + 0.30 * rainBoost;
    pCrowding = 0.28;
  }

  const flood = bernoulli(rng, 0.08 + 0.45 * floodBoost);
  const drought = bernoulli(rng, 0.04 + 0.35 * droughtBoost);

  return {
    stagnant_water: bernoulli(rng, pStagnant),
    recent_heavy_rain: bernoulli(rng, pRecentRain),
    indoor_crowding: bernoulli(rng, pCrowding),
    wash_water_source: categorical(rng, WATER_SOURCES_BY_DISEASE[disease]),
    wash_sanitation: categorical(rng, SANITATION_BY_DISEASE[disease]),
    flood_history_4wk: flood,
    drought_water_shortage: drought,
    exposure_notes: null
  };
}

// --------------------------------------------------------------------------- //
// Patient demographics                                                         //
// --------------------------------------------------------------------------- //

const FIRST_NAMES_M = [
  "Juan", "Pedro", "Jose", "Mark", "Carlo", "Allan", "Reynaldo", "Edgar",
  "Rolando", "Arnel", "Joseph", "Miguel", "Ramon", "Cesar", "Bryan",
  "Joel", "Romeo", "Ariel", "Dante", "Lito", "Renato", "Nestor",
  "Eduardo", "Christian", "Gerard", "Vince", "Paolo", "Diego"
];
const FIRST_NAMES_F = [
  "Maria", "Rosa", "Anna", "Cristina", "Liza", "Mae", "Joy", "Grace",
  "Lorna", "Imelda", "Marites", "Aileen", "Catherine", "Hazel", "Janet",
  "Ruby", "Sheila", "Trisha", "Carmen", "Daisy", "Evelyn", "Annaliza",
  "Ana", "Jennifer", "Mary Jane", "Janice", "Glenda", "Erlinda"
];
const SURNAMES = [
  "Dela Cruz", "Reyes", "Santos", "Cruz", "Garcia", "Mendoza", "Torres",
  "Aquino", "Castillo", "Ramos", "Flores", "Rivera", "Gonzales", "Lim",
  "Bautista", "Villanueva", "Domingo", "Castro", "Pascual", "Sarmiento",
  "Tan", "Manuel", "Bacus", "Lacanilao", "Magsino", "Aborque", "Estanislao",
  "Bansale", "Camarillo", "Dagohoy", "Dimaculangan", "Salvador"
];
const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];

function sampleAge(rng, disease) {
  let age;
  if (disease === "DENGUE") {
    age = Math.round(normal(rng, 22, 12));
  } else if (disease === "ILI") {
    age = Math.round(normal(rng, 24, 18));
  } else {
    age = Math.round(normal(rng, 15, 16));
  }
  return clamp(age, 0, 92);
}

function samplePatient(rng, disease) {
  const sex = rng() < 0.51 ? "Female" : "Male";
  const first = sex === "Female"
    ? FIRST_NAMES_F[randInt(rng, 0, FIRST_NAMES_F.length - 1)]
    : FIRST_NAMES_M[randInt(rng, 0, FIRST_NAMES_M.length - 1)];
  const last = SURNAMES[randInt(rng, 0, SURNAMES.length - 1)];
  const age = sampleAge(rng, disease);
  const status = age >= 18 ? CIVIL_STATUS[randInt(rng, 0, CIVIL_STATUS.length - 1)] : "Single";
  return { firstName: first, lastName: last, fullName: `${first} ${last}`, age, sex, civilStatus: status };
}

// --------------------------------------------------------------------------- //
// Planner                                                                      //
// --------------------------------------------------------------------------- //

const DISEASES = ["DENGUE", "ILI", "AWD"];

/**
 * Build a plan: per-week, per-muni, per-disease counts (clipped to ≥0).
 * Then rescale so each disease ends up close to targetPerDisease total.
 */
function planCases(opts, ctx, rng) {
  const { munis, weatherByMuniWeek, zStats } = ctx;

  // Size factor: barangay count proxy (more barangays → larger municipality).
  const sizeFactors = new Map();
  for (const m of munis) {
    sizeFactors.set(m.id, 1 + Math.sqrt(m.barangays.length));
  }

  // Step 1: compute raw λ per (week, muni, disease)
  /** @type {Map<string, Map<number, Record<string, number>>>} weekKey -> muniId -> {DENGUE,ILI,AWD} */
  const lambdaByWeek = new Map();
  const weeks = [...ctx.weeks];

  for (const monday of weeks) {
    const weekKey = ymd(monday);
    const inner = new Map();
    for (const m of munis) {
      const w = weatherByMuniWeek.get(m.name)?.get(weekKey);
      if (!w || w.days < 3) {
        inner.set(m.id, { DENGUE: 0, ILI: 0, AWD: 0 });
        continue;
      }
      const z = {
        temp: w.temp != null ? (w.temp - zStats.temp.mu) / zStats.temp.sigma : 0,
        hum: w.hum != null ? (w.hum - zStats.hum.mu) / zStats.hum.sigma : 0,
        rain: w.rain != null ? (w.rain - zStats.rain.mu) / zStats.rain.sigma : 0
      };
      const lag2 = weatherByMuniWeek.get(m.name)?.get(ymd(addDays(monday, -14)));
      const lag4 = weatherByMuniWeek.get(m.name)?.get(ymd(addDays(monday, -28)));
      const lag6 = weatherByMuniWeek.get(m.name)?.get(ymd(addDays(monday, -42)));
      const zLag2 = lag2?.rain != null ? (lag2.rain - zStats.rain.mu) / zStats.rain.sigma : 0;
      const zLag4 = lag4?.rain != null ? (lag4.rain - zStats.rain.mu) / zStats.rain.sigma : 0;
      const zLag6 = lag6?.rain != null ? (lag6.rain - zStats.rain.mu) / zStats.rain.sigma : 0;

      // Trailing 4-week rolling rainfall sum (z-scored against weekly rainfall σ * sqrt(4)).
      let roll4 = 0;
      let rollN = 0;
      for (let k = 0; k < 4; k += 1) {
        const rr = weatherByMuniWeek.get(m.name)?.get(ymd(addDays(monday, -7 * k)));
        if (rr?.rain != null) { roll4 += rr.rain; rollN += 1; }
      }
      const expected4 = zStats.rain.mu * 4;
      const sigma4 = zStats.rain.sigma * 2; // sqrt(4) = 2
      const zRoll4 = rollN > 0 ? (roll4 - expected4) / Math.max(sigma4, 1) : 0;

      const monthIdx = monday.getUTCMonth();
      const sizeFactor = sizeFactors.get(m.id) ?? 1;
      const perDisease = {};
      for (const d of DISEASES) {
        // Skip weeks outside this disease's synthesis window (e.g. real-data
        // year 2025 for Dengue, pre-2023-12-09 for ILI). λ=0 → no cases.
        if (!inAnyWindow(ctx.diseaseWindows?.[d], monday)) {
          perDisease[d] = 0;
          continue;
        }
        perDisease[d] = lambdaFor(d, {
          z, zLag2, zLag4, zLag6, zRoll4,
          season: seasonality(d, monthIdx),
          base: 1.0,
          sizeFactor
        });
      }
      inner.set(m.id, perDisease);
    }
    lambdaByWeek.set(weekKey, inner);
  }

  // Step 2: rescale so each disease totals ~ targetPerDisease.
  /** sum(λ) per disease */
  const sumLambda = { DENGUE: 0, ILI: 0, AWD: 0 };
  for (const inner of lambdaByWeek.values()) {
    for (const perD of inner.values()) {
      for (const d of DISEASES) sumLambda[d] += perD[d];
    }
  }
  const scale = {};
  for (const d of DISEASES) {
    scale[d] = sumLambda[d] > 0 ? opts.targetPerDisease / sumLambda[d] : 0;
  }

  // Step 3: sample Poisson counts at the scaled rate and distribute to barangays.
  /** @type {Array<{weekKey:string, monday:Date, muniId:number, muniName:string, barangayId:number, barangayName:string, disease:string, count:number}>} */
  const buckets = [];
  for (const monday of weeks) {
    const weekKey = ymd(monday);
    const inner = lambdaByWeek.get(weekKey);
    if (!inner) continue;
    for (const m of munis) {
      const perD = inner.get(m.id);
      if (!perD) continue;
      for (const d of DISEASES) {
        const lam = perD[d] * scale[d];
        const n = poisson(rng, lam);
        if (!n) continue;
        // Distribute to barangays via Dirichlet (so some barangays cluster).
        const shares = dirichlet(rng, m.barangays.length, 1);
        // Multinomial-ish assignment using cumulative shares.
        const counts = new Array(m.barangays.length).fill(0);
        for (let k = 0; k < n; k += 1) {
          const r = rng();
          let acc = 0;
          for (let i = 0; i < shares.length; i += 1) {
            acc += shares[i];
            if (r <= acc) { counts[i] += 1; break; }
          }
        }
        for (let i = 0; i < counts.length; i += 1) {
          if (!counts[i]) continue;
          const b = m.barangays[i];
          buckets.push({
            weekKey,
            monday,
            muniId: m.id,
            muniName: m.name,
            barangayId: b.id,
            barangayName: b.name,
            disease: d,
            count: counts[i]
          });
        }
      }
    }
  }

  return buckets;
}

// --------------------------------------------------------------------------- //
// Bulk insert helpers                                                          //
// --------------------------------------------------------------------------- //

async function purgeSynthetic() {
  const [r] = await pool.query(
    `DELETE FROM patients WHERE patient_number LIKE 'SYN-%'`
  );
  return r.affectedRows ?? 0;
}

async function insertPatientBatch(rows) {
  if (!rows.length) return { firstId: null, affected: 0 };
  const placeholders = rows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
  const params = [];
  for (const r of rows) {
    params.push(
      r.name,
      r.patient_number,
      String(r.age),
      r.sex,
      null,                 // birthdate
      r.civil_status,
      "Davao de Oro",
      r.municipality_id,
      r.barangay_id,
      null,                 // purok
      null,                 // birthplace
      r.disease_type,
      r.case_classification,
      r.case_status,
      r.date_started,
      r.created_by
    );
  }
  const sql =
    `INSERT INTO patients (
       name, patient_number, age, sex, birthdate, civil_status, province,
       municipality_id, barangay_id, purok, birthplace, disease_type,
       case_classification, case_status, date_started, created_by
     ) VALUES ${placeholders}`;
  const [res] = await pool.query(sql, params);
  return { firstId: res.insertId, affected: res.affectedRows ?? rows.length };
}

async function insertEnvironmentBatch(envRows) {
  if (!envRows.length) return 0;
  const placeholders = envRows.map(() => "(?,?,?,?,?,?,?,?,?)").join(",");
  const params = [];
  for (const r of envRows) {
    params.push(
      r.patient_id,
      r.stagnant_water,
      r.recent_heavy_rain,
      r.indoor_crowding,
      r.wash_water_source,
      r.wash_sanitation,
      r.flood_history_4wk,
      r.drought_water_shortage,
      r.exposure_notes
    );
  }
  const sql =
    `INSERT INTO case_environmental (
       patient_id, stagnant_water, recent_heavy_rain, indoor_crowding,
       wash_water_source, wash_sanitation, flood_history_4wk,
       drought_water_shortage, exposure_notes
     ) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       stagnant_water = VALUES(stagnant_water),
       recent_heavy_rain = VALUES(recent_heavy_rain),
       indoor_crowding = VALUES(indoor_crowding),
       wash_water_source = VALUES(wash_water_source),
       wash_sanitation = VALUES(wash_sanitation),
       flood_history_4wk = VALUES(flood_history_4wk),
       drought_water_shortage = VALUES(drought_water_shortage),
       exposure_notes = VALUES(exposure_notes)`;
  const [res] = await pool.query(sql, params);
  return res.affectedRows ?? 0;
}

// --------------------------------------------------------------------------- //
// Main                                                                         //
// --------------------------------------------------------------------------- //

async function main() {
  const opts = parseArgs(process.argv);
  const rng = mulberry32(opts.seed);

  console.log("[synth] Loading geography…");
  const { munis, totalBarangays } = await loadGeography();
  if (!munis.length) {
    console.error("[synth] No municipalities in DB. Run migrations 01–02 first.");
    process.exit(1);
  }
  console.log(`[synth]   ${munis.length} municipalities, ${totalBarangays} barangays`);

  console.log("[synth] Loading BHU user accounts (for created_by)…");
  const users = await loadBhuUsers();
  console.log(
    `[synth]   ${users.byBarangay.size} barangay users, ${users.byMunicipality.size} municipality users`
  );
  if (!users.byBarangay.size && !users.byMunicipality.size) {
    console.error(
      "[synth] No BHU users found. Run database/migrations/03_seed_users.sql first " +
        "(synth needs a created_by FK target so build-ml-datasets accepts the rows)."
    );
    process.exit(1);
  }

  console.log(`[synth] Loading weather archive: ${opts.weather}`);
  const { byMuni: dailyByMuni, minDate, maxDate } = await loadWeatherDaily(opts.weather);
  console.log(`[synth]   ${dailyByMuni.size} munis covered, ${minDate} -> ${maxDate}`);

  // Resolve synthesis date range. Lag features need ~6 weeks of weather BEFORE
  // the first generated week; we still allow earlier weeks but their lag terms
  // simply degrade to 0 (z=0) — same behaviour build-ml-datasets uses.
  const weatherStart = parseYmd(minDate);
  const weatherEnd = parseYmd(maxDate);
  const requestedStart = parseYmd(opts.start) ?? weatherStart;
  const requestedEnd = parseYmd(opts.end) ?? weatherEnd;
  const startMonday = weekStart(requestedStart);
  const endMonday = weekStart(requestedEnd);

  // Pre-aggregate weather per (muni, ISO-week Monday).
  /** @type {Map<string, Map<string, {temp:number|null, hum:number|null, rain:number|null, days:number}>>} */
  const weatherByMuniWeek = new Map();
  const weeks = [];
  for (const monday of eachMonday(startMonday, endMonday)) weeks.push(new Date(monday));

  for (const m of munis) {
    const muniMap = new Map();
    // Walk back 8 weeks before startMonday so lag-6 has data when synthesising
    // near the boundary of the archive.
    for (let i = -8; i <= weeks.length + 1; i += 1) {
      const baseIdx = clamp(i, 0, weeks.length - 1);
      const monday = i < 0 ? addDays(weeks[0], i * 7) : (i >= weeks.length ? addDays(weeks[weeks.length - 1], (i - weeks.length + 1) * 7) : weeks[baseIdx]);
      muniMap.set(ymd(monday), aggregateWeek(dailyByMuni, m.name, monday));
    }
    weatherByMuniWeek.set(m.name, muniMap);
  }

  console.log(
    `[synth] Generating across ${weeks.length} ISO weeks: ${ymd(weeks[0])} -> ${ymd(weeks[weeks.length - 1])}`
  );

  console.log("[synth] Computing weather z-score statistics…");
  const zStats = computeZStats(weatherByMuniWeek);
  console.log(
    `[synth]   temp μ=${zStats.temp.mu.toFixed(2)} σ=${zStats.temp.sigma.toFixed(2)}  ` +
    `hum μ=${zStats.hum.mu.toFixed(1)} σ=${zStats.hum.sigma.toFixed(1)}  ` +
    `rain μ=${zStats.rain.mu.toFixed(1)} σ=${zStats.rain.sigma.toFixed(1)}`
  );

  // Resolve per-disease synthesis windows from the spec + CLI options.
  const diseaseWindows = buildDiseaseWindows(opts, startMonday, endMonday);
  console.log("[synth] Per-disease synthesis windows:");
  for (const d of DISEASES) {
    const w = diseaseWindows[d] ?? [];
    console.log(
      `[synth]   ${d.padEnd(6)} ${w.map(([s, e]) => `${ymd(s)}..${ymd(e)}`).join("  ") || "(all)"}`
    );
  }

  console.log(`[synth] Planning DENGUE, ILI, AWD @ ~${opts.targetPerDisease} cases/disease…`);
  const buckets = planCases(opts, { munis, weatherByMuniWeek, zStats, weeks, diseaseWindows }, rng);

  // --- Plan summary ---
  const planTotals = { DENGUE: 0, ILI: 0, AWD: 0 };
  const perMuni = new Map();
  const perBarangayDisease = new Map();
  for (const b of buckets) {
    planTotals[b.disease] += b.count;
    if (!perMuni.has(b.muniId)) perMuni.set(b.muniId, { name: b.muniName, DENGUE: 0, ILI: 0, AWD: 0 });
    perMuni.get(b.muniId)[b.disease] += b.count;
    const key = `${b.barangayId}`;
    if (!perBarangayDisease.has(key)) {
      perBarangayDisease.set(key, {
        barangayId: b.barangayId,
        barangayName: b.barangayName,
        municipality: b.muniName,
        DENGUE: 0, ILI: 0, AWD: 0
      });
    }
    perBarangayDisease.get(key)[b.disease] += b.count;
  }

  console.log("[synth] Plan totals:");
  for (const d of DISEASES) {
    console.log(`[synth]   ${d.padEnd(6)}  ${planTotals[d]}`);
  }
  console.log("[synth] Per-municipality totals:");
  for (const m of munis) {
    const t = perMuni.get(m.id) ?? { DENGUE: 0, ILI: 0, AWD: 0 };
    console.log(
      `[synth]   ${m.name.padEnd(12)} DENGUE=${t.DENGUE}  ILI=${t.ILI}  AWD=${t.AWD}`
    );
  }
  const barangaysTouched = perBarangayDisease.size;
  console.log(`[synth]   Barangays touched: ${barangaysTouched} / ${totalBarangays}`);

  // --- Write barangay-level summary CSV ---
  const summaryRows = [...perBarangayDisease.values()].sort(
    (a, b) => (b.DENGUE + b.ILI + b.AWD) - (a.DENGUE + a.ILI + a.AWD)
  );
  const summaryLines = ["barangay_id,barangay_name,municipality,DENGUE,ILI,AWD,total"];
  for (const r of summaryRows) {
    summaryLines.push(
      [
        r.barangayId,
        csvCell(r.barangayName),
        csvCell(r.municipality),
        r.DENGUE,
        r.ILI,
        r.AWD,
        r.DENGUE + r.ILI + r.AWD
      ].join(",")
    );
  }
  await fs.mkdir(path.dirname(opts.summaryOut), { recursive: true });
  await fs.writeFile(opts.summaryOut, summaryLines.join("\n") + "\n", "utf-8");
  console.log(`[synth] Wrote barangay-level summary -> ${opts.summaryOut}`);

  if (opts.dryRun) {
    console.log("[synth] --dry-run: skipping MySQL writes. Done.");
    process.exit(0);
  }

  // --- Purge prior synthetic rows (cascades drop case_environmental too) ---
  if (opts.purge) {
    console.log("[synth] Purging prior SYN-* rows…");
    const removed = await purgeSynthetic();
    console.log(`[synth]   removed ${removed} prior synthetic patient rows`);
  }

  // --- Materialise per-case rows (one row per individual case) ---
  console.log("[synth] Inserting into MySQL (this may take a minute)…");
  /** Per-disease running counter for patient_number sequencing. */
  const seqByDisease = { DENGUE: 0, ILI: 0, AWD: 0 };

  let inserted = 0;
  let envInserted = 0;
  let pendingPatients = [];
  let pendingEnv = []; // env values without patient_id; resolved after insert
  let pendingMeta = []; // mirrors pendingPatients (so we can match env to patient by index)

  async function flushBatch() {
    if (!pendingPatients.length) return;
    const { firstId, affected } = await insertPatientBatch(pendingPatients);
    if (!firstId || !affected) {
      pendingPatients = [];
      pendingEnv = [];
      pendingMeta = [];
      return;
    }
    const envBatch = [];
    for (let i = 0; i < affected; i += 1) {
      const patientId = firstId + i;
      envBatch.push({ patient_id: patientId, ...pendingEnv[i] });
    }
    const n = await insertEnvironmentBatch(envBatch);
    inserted += affected;
    envInserted += n;
    pendingPatients = [];
    pendingEnv = [];
    pendingMeta = [];
  }

  for (const bucket of buckets) {
    const createdBy =
      users.byBarangay.get(bucket.barangayId) ??
      users.byMunicipality.get(bucket.muniId) ??
      null;
    if (!createdBy) continue; // skip if we have no BHU user to attribute the row to

    // Pre-compute the weather context for environmental sampling once per bucket.
    const w = weatherByMuniWeek.get(bucket.muniName)?.get(bucket.weekKey) ?? {};
    const zRain = w.rain != null ? (w.rain - zStats.rain.mu) / zStats.rain.sigma : 0;
    let roll4 = 0;
    let rollN = 0;
    for (let k = 0; k < 4; k += 1) {
      const rr = weatherByMuniWeek.get(bucket.muniName)?.get(ymd(addDays(bucket.monday, -7 * k)));
      if (rr?.rain != null) { roll4 += rr.rain; rollN += 1; }
    }
    const expected4 = zStats.rain.mu * 4;
    const sigma4 = zStats.rain.sigma * 2;
    const zRoll4 = rollN > 0 ? (roll4 - expected4) / Math.max(sigma4, 1) : 0;
    const weatherCtx = { zRain, zRoll4 };

    for (let i = 0; i < bucket.count; i += 1) {
      seqByDisease[bucket.disease] += 1;
      const patient = samplePatient(rng, bucket.disease);
      const dayOffset = randInt(rng, 0, 6);
      const dateStarted = ymd(addDays(bucket.monday, dayOffset));
      const patientNumber = `SYN-${bucket.disease}-${String(seqByDisease[bucket.disease]).padStart(6, "0")}`;
      const env = sampleEnvironment(rng, bucket.disease, weatherCtx);

      pendingPatients.push({
        name: patient.fullName,
        patient_number: patientNumber,
        age: patient.age,
        sex: patient.sex,
        civil_status: patient.civilStatus,
        municipality_id: bucket.muniId,
        barangay_id: bucket.barangayId,
        disease_type: DISEASE_LABEL[bucket.disease],
        case_classification: "Confirmed",
        case_status: "active",
        date_started: dateStarted,
        created_by: createdBy
      });
      pendingEnv.push(env);
      pendingMeta.push({ disease: bucket.disease, muniId: bucket.muniId, barangayId: bucket.barangayId });

      if (pendingPatients.length >= opts.batchSize) {
        await flushBatch();
      }
    }
  }

  await flushBatch();

  console.log(`[synth] DONE. Inserted ${inserted} patient rows.`);
  if (envInserted !== inserted) {
    console.warn(
      `[synth]   note: ${envInserted} environmental rows vs ${inserted} patients ` +
      `(missing rows usually mean case_environmental table is absent — run migration 14).`
    );
  }
  console.log("[synth] Next:");
  console.log("[synth]   npm run ml:build-dataset");
  console.log("[synth]   npm run ml:train");
  console.log("[synth]   npm run ml:eval");
  process.exit(0);
}

main().catch((err) => {
  console.error("[synth] FATAL:", err);
  process.exit(1);
});
