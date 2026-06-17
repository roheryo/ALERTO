/**
 * Build the LSTM training dataset by joining MySQL case logs with the
 * Open-Meteo weather archive CSV.
 *
 * Outputs (under data/processed/):
 *   case_line_list.csv               One row per confirmed case (line list)
 *   surveillance_weekly_training.csv One row per (municipality, disease, ISO-week)
 *                                    with case_count, weather, lags, rolling sums,
 *                                    cases_t_plus_1..4, and split label.
 *
 * Usage:
 *   node backend/scripts/build-ml-datasets.mjs
 *   node backend/scripts/build-ml-datasets.mjs --weather data/processed/weather_daily.csv
 *   node backend/scripts/build-ml-datasets.mjs --train-fraction 0.7 --val-fraction 0.15
 *
 * Source-of-truth policy (matches thesis §2.3):
 *   The LSTM is trained ONLY on rows that simultaneously satisfy:
 *     1. case_classification = 'Confirmed'  -> diagnostic certainty
 *     2. created_by IS NOT NULL             -> submitted through the BHU
 *                                              report-case form (not bulk
 *                                              imported / seeded)
 *   Cases that fail either condition are excluded from the training CSV. This
 *   ensures every datapoint the model sees originated from the same audited
 *   submission path that the live system uses going forward.
 *
 *   Pass `--include-imported` to relax rule (2) temporarily (e.g. to sanity-
 *   check the pipeline against the 2023 ILI archive). Rule (1) is always on.
 *
 * Other notes:
 *   - Time split is chronological (not random): train -> val -> test.
 *   - Run `node backend/scripts/fetch-weather-history.mjs` first if the
 *     weather CSV does not yet exist.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";

import { pool } from "../config/db.js";
import { normalizeDisease } from "../lib/diseaseUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DISEASES = ["DENGUE", "ILI", "AWD"];
const HORIZON_WEEKS = 4;
const ROLLING_WINDOWS = [4, 8];
const RAINFALL_LAGS = [4, 6, 8];
const TEMP_LAGS = [1, 2, 3];
const HUMIDITY_LAGS = [1];

const PEAK_SEASON_MONTHS = new Set([7, 8, 9, 10, 11]); // tropical wet season → AWD/Dengue spikes

function parseArgs(argv) {
  const opts = {
    weather: path.join(REPO_ROOT, "data", "processed", "weather_daily.csv"),
    outDir: path.join(REPO_ROOT, "data", "processed"),
    trainFraction: 0.7,
    valFraction: 0.15,
    // formOnly=true (default) → only train on cases that came through
    // POST /api/patients (created_by IS NOT NULL). Set --include-imported
    // to also include legacy seed / 2023 ILI Excel rows.
    formOnly: true
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--weather" && next) {
      opts.weather = path.isAbsolute(next) ? next : path.join(REPO_ROOT, next);
      i += 1;
    } else if (arg === "--out-dir" && next) {
      opts.outDir = path.isAbsolute(next) ? next : path.join(REPO_ROOT, next);
      i += 1;
    } else if (arg === "--train-fraction" && next) {
      opts.trainFraction = Number(next);
      i += 1;
    } else if (arg === "--val-fraction" && next) {
      opts.valFraction = Number(next);
      i += 1;
    } else if (arg === "--include-imported") {
      opts.formOnly = false;
    } else if (arg === "--form-only") {
      opts.formOnly = true;
    }
  }
  return opts;
}

// --------------------------------------------------------------------------- //
// Date helpers (ISO weeks, Mon-start week buckets)
// --------------------------------------------------------------------------- //

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Monday of the ISO week containing `date` (UTC). */
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday=7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** ISO year + week (1-based). */
function isoYearWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { iso_year: d.getUTCFullYear(), iso_week: week };
}

function* iterWeeks(startDate, endDate) {
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    yield new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function avg(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sumAll(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0);
}

function minOf(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? Math.min(...xs) : null;
}

function maxOf(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? Math.max(...xs) : null;
}

// --------------------------------------------------------------------------- //
// MySQL extraction
// --------------------------------------------------------------------------- //

async function fetchMunicipalities() {
  const [rows] = await pool.query(
    `SELECT m.id, m.name, COALESCE(SUM(1), 0) AS barangays
     FROM municipalities m
     LEFT JOIN barangays b ON b.municipality_id = m.id
     GROUP BY m.id, m.name
     ORDER BY m.id`
  );
  return rows;
}

/**
 * Pull cases eligible for LSTM training.
 *
 * Always filters to case_classification = 'Confirmed'. When `formOnly` is true
 * (default), also restricts to rows that were submitted through the BHU
 * report-case form (`patients.created_by IS NOT NULL`) so that historical
 * Excel-imported rows and seeded sample data are excluded from training. Pass
 * `formOnly=false` (via `--include-imported`) to relax the second rule.
 */
async function fetchConfirmedCases({ formOnly } = { formOnly: true }) {
  const sourceClause = formOnly ? "AND p.created_by IS NOT NULL" : "";
  const [rows] = await pool.query(
    `SELECT
        p.id,
        p.patient_number AS patientNumber,
        p.disease_type AS diseaseRaw,
        p.case_classification AS caseClassification,
        DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
        DATE_FORMAT(p.created_at, '%Y-%m-%d') AS dateReported,
        p.municipality_id AS municipalityId,
        m.name AS municipalityName,
        p.barangay_id AS barangayId,
        b.name AS barangayName,
        p.sex AS sex,
        p.age AS age,
        p.created_by AS createdBy
      FROM patients p
      JOIN municipalities m ON m.id = p.municipality_id
      JOIN barangays b ON b.id = p.barangay_id
      WHERE LOWER(TRIM(COALESCE(p.case_classification, ''))) = 'confirmed'
        ${sourceClause}`
  );
  return rows;
}

/**
 * Pull per-case environmental factors for *all* patients (regardless of case
 * classification). Returned rows are keyed by patient_id and merged with the
 * confirmed cases above. Silently returns [] if migration 14 hasn't been run
 * yet (table missing).
 */
async function fetchCaseEnvironment() {
  try {
    const [rows] = await pool.query(
      `SELECT
          p.id AS patientId,
          p.municipality_id AS municipalityId,
          DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
          ce.stagnant_water        AS stagnantWater,
          ce.recent_heavy_rain     AS recentHeavyRain,
          ce.indoor_crowding       AS indoorCrowding,
          ce.wash_water_source     AS washWater,
          ce.wash_sanitation       AS washSanitation,
          ce.flood_history_4wk     AS floodHistory,
          ce.drought_water_shortage AS droughtHistory
        FROM case_environmental ce
        JOIN patients p ON p.id = ce.patient_id`
    );
    return rows;
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE" || err?.code === "ER_BAD_FIELD_ERROR") {
      console.warn(
        "[build] case_environmental table missing — environmental features will be zero. " +
          "Run migration 14_case_environmental.sql to enable them."
      );
      return [];
    }
    throw err;
  }
}

// --------------------------------------------------------------------------- //
// Weather CSV loader (output of fetch-weather-history.mjs)
// --------------------------------------------------------------------------- //

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = parts[i] ?? "";
    });
    return obj;
  });
}

async function loadWeatherDaily(weatherCsv) {
  try {
    const text = await fs.readFile(weatherCsv, "utf-8");
    const rows = parseCsv(text);
    /** @type {Map<string, Map<string, object>>} municipality -> date -> row */
    const byMuni = new Map();
    for (const row of rows) {
      const muni = String(row.municipality_name ?? "").trim();
      const date = String(row.date ?? "").trim();
      if (!muni || !date) continue;
      const inner = byMuni.get(muni) ?? new Map();
      inner.set(date, {
        temp_mean_c: num(row.temp_mean_c),
        temp_min_c: num(row.temp_min_c),
        temp_max_c: num(row.temp_max_c),
        humidity_mean_pct: num(row.humidity_mean_pct),
        rainfall_sum_mm: num(row.rainfall_sum_mm)
      });
      byMuni.set(muni, inner);
    }
    return byMuni;
  } catch (err) {
    if (err?.code === "ENOENT") {
      console.warn(
        `[build] Weather CSV not found at ${weatherCsv}. Weather columns will be empty. ` +
          `Run: node backend/scripts/fetch-weather-history.mjs`
      );
      return new Map();
    }
    throw err;
  }
}

function aggregateWeeklyWeather(dailyByMuni, municipalityName, monday) {
  const days = [];
  const inner = dailyByMuni.get(municipalityName);
  if (!inner) {
    return {
      temp_mean_c: null,
      temp_min_c: null,
      temp_max_c: null,
      humidity_mean_pct: null,
      rainfall_sum_mm: null
    };
  }
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const row = inner.get(ymd(d));
    if (row) days.push(row);
  }
  return {
    temp_mean_c: avg(days.map((d) => d.temp_mean_c)),
    temp_min_c: minOf(days.map((d) => d.temp_min_c)),
    temp_max_c: maxOf(days.map((d) => d.temp_max_c)),
    humidity_mean_pct: avg(days.map((d) => d.humidity_mean_pct)),
    rainfall_sum_mm: sumAll(days.map((d) => d.rainfall_sum_mm))
  };
}

// --------------------------------------------------------------------------- //
// Per-case environment -> weekly aggregates by municipality
// --------------------------------------------------------------------------- //

const UNIMPROVED_WATER = new Set(["unimproved", "none"]);
const OPEN_DEFECATION = new Set(["open", "none"]);

/**
 * Build a Map<muniId, Map<weekKey, agg>> of environmental counts. Environmental
 * factors are tied to *where* a case was reported, not which disease it was,
 * so the aggregate is shared across all three diseases for a given municipality
 * and ISO-week.
 */
function aggregateCaseEnvironment(envRows) {
  /** @type {Map<number, Map<string, {
   *   reports:number,
   *   stagnantWater:number,
   *   recentHeavyRain:number,
   *   indoorCrowding:number,
   *   floodReports:number,
   *   droughtReports:number,
   *   washWaterTotal:number,
   *   washWaterUnimproved:number,
   *   sanitationTotal:number,
   *   sanitationOpen:number
   * }>>} */
  const out = new Map();
  for (const r of envRows) {
    const date = toDate(r.dateStarted);
    if (!date || !r.municipalityId) continue;
    const monday = ymd(weekStart(date));
    const inner = out.get(r.municipalityId) ?? new Map();
    const bucket = inner.get(monday) ?? {
      reports: 0,
      stagnantWater: 0,
      recentHeavyRain: 0,
      indoorCrowding: 0,
      floodReports: 0,
      droughtReports: 0,
      washWaterTotal: 0,
      washWaterUnimproved: 0,
      sanitationTotal: 0,
      sanitationOpen: 0
    };
    bucket.reports += 1;
    if (r.stagnantWater) bucket.stagnantWater += 1;
    if (r.recentHeavyRain) bucket.recentHeavyRain += 1;
    if (r.indoorCrowding) bucket.indoorCrowding += 1;
    if (r.floodHistory) bucket.floodReports += 1;
    if (r.droughtHistory) bucket.droughtReports += 1;
    const water = String(r.washWater ?? "").trim().toLowerCase();
    if (water) {
      bucket.washWaterTotal += 1;
      if (UNIMPROVED_WATER.has(water)) bucket.washWaterUnimproved += 1;
    }
    const sanitation = String(r.washSanitation ?? "").trim().toLowerCase();
    if (sanitation) {
      bucket.sanitationTotal += 1;
      if (OPEN_DEFECATION.has(sanitation)) bucket.sanitationOpen += 1;
    }
    inner.set(monday, bucket);
    out.set(r.municipalityId, inner);
  }
  return out;
}

const ENV_FEATURE_COLUMNS = [
  "env_reports",
  "pct_stagnant_water",
  "pct_recent_heavy_rain",
  "pct_indoor_crowding",
  "pct_unimproved_water",
  "pct_open_defecation",
  "pct_flood_history",
  "pct_drought_history",
  // 4-week rolling versions smooth the signal & forward-fill weeks without reports.
  "env_reports_4wk",
  "pct_stagnant_water_4wk",
  "pct_recent_heavy_rain_4wk",
  "pct_indoor_crowding_4wk",
  "pct_unimproved_water_4wk",
  "pct_open_defecation_4wk",
  "pct_flood_history_4wk",
  "pct_drought_history_4wk"
];

function emptyEnvFeatures() {
  const out = {};
  for (const col of ENV_FEATURE_COLUMNS) out[col] = 0;
  return out;
}

/**
 * Given a sorted-by-week list of weekly aggregate buckets for one municipality,
 * compute the 4-week rolling average rates for environmental fields. We use a
 * trailing window so the value at week `i` reflects weeks `i-3..i`. Weeks with
 * zero reports in the window default to 0.
 */
function attachEnvFeaturesToRows(rows, envByMuni) {
  // Group rows by municipality so we can compute rolling stats within each muni.
  /** @type {Map<number, Array<object>>} */
  const byMuni = new Map();
  for (const row of rows) {
    if (!byMuni.has(row.municipality_id)) byMuni.set(row.municipality_id, []);
    byMuni.get(row.municipality_id).push(row);
  }

  for (const [muniId, muniRows] of byMuni) {
    const envMap = envByMuni.get(muniId) ?? new Map();
    // Index rows by (week_start, disease_code) → row, but we only need ordered
    // unique weeks to compute the rolling window once per week.
    const uniqueWeeks = Array.from(new Set(muniRows.map((r) => r.week_start))).sort();
    /** @type {Map<string, ReturnType<typeof emptyEnvFeatures> & {raw: object|null}>} */
    const weekFeatures = new Map();

    for (let i = 0; i < uniqueWeeks.length; i += 1) {
      const wk = uniqueWeeks[i];
      const cur = envMap.get(wk) ?? null;

      // Trailing 4-week aggregates.
      let acc = {
        reports: 0,
        stagnantWater: 0,
        recentHeavyRain: 0,
        indoorCrowding: 0,
        floodReports: 0,
        droughtReports: 0,
        washWaterTotal: 0,
        washWaterUnimproved: 0,
        sanitationTotal: 0,
        sanitationOpen: 0
      };
      for (let k = Math.max(0, i - 3); k <= i; k += 1) {
        const b = envMap.get(uniqueWeeks[k]);
        if (!b) continue;
        acc.reports += b.reports;
        acc.stagnantWater += b.stagnantWater;
        acc.recentHeavyRain += b.recentHeavyRain;
        acc.indoorCrowding += b.indoorCrowding;
        acc.floodReports += b.floodReports;
        acc.droughtReports += b.droughtReports;
        acc.washWaterTotal += b.washWaterTotal;
        acc.washWaterUnimproved += b.washWaterUnimproved;
        acc.sanitationTotal += b.sanitationTotal;
        acc.sanitationOpen += b.sanitationOpen;
      }

      const safeRate = (num, den) => (den > 0 ? num / den : 0);

      const features = {
        env_reports: cur?.reports ?? 0,
        pct_stagnant_water: safeRate(cur?.stagnantWater ?? 0, cur?.reports ?? 0),
        pct_recent_heavy_rain: safeRate(cur?.recentHeavyRain ?? 0, cur?.reports ?? 0),
        pct_indoor_crowding: safeRate(cur?.indoorCrowding ?? 0, cur?.reports ?? 0),
        pct_unimproved_water: safeRate(
          cur?.washWaterUnimproved ?? 0,
          cur?.washWaterTotal ?? 0
        ),
        pct_open_defecation: safeRate(cur?.sanitationOpen ?? 0, cur?.sanitationTotal ?? 0),
        pct_flood_history: safeRate(cur?.floodReports ?? 0, cur?.reports ?? 0),
        pct_drought_history: safeRate(cur?.droughtReports ?? 0, cur?.reports ?? 0),
        env_reports_4wk: acc.reports,
        pct_stagnant_water_4wk: safeRate(acc.stagnantWater, acc.reports),
        pct_recent_heavy_rain_4wk: safeRate(acc.recentHeavyRain, acc.reports),
        pct_indoor_crowding_4wk: safeRate(acc.indoorCrowding, acc.reports),
        pct_unimproved_water_4wk: safeRate(acc.washWaterUnimproved, acc.washWaterTotal),
        pct_open_defecation_4wk: safeRate(acc.sanitationOpen, acc.sanitationTotal),
        pct_flood_history_4wk: safeRate(acc.floodReports, acc.reports),
        pct_drought_history_4wk: safeRate(acc.droughtReports, acc.reports)
      };
      weekFeatures.set(wk, features);
    }

    for (const row of muniRows) {
      const f = weekFeatures.get(row.week_start) ?? emptyEnvFeatures();
      Object.assign(row, f);
    }
  }
}

// --------------------------------------------------------------------------- //
// Line-list CSV + weekly aggregation
// --------------------------------------------------------------------------- //

function fmtCsv(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function writeLineList(cases, outPath) {
  const header = [
    "patient_number",
    "disease_code",
    "disease_type_raw",
    "case_classification",
    "date_onset",
    "date_reported",
    "municipality_id",
    "municipality_name",
    "barangay_id",
    "barangay_name",
    "province_name",
    "sex",
    "age_years",
    "case_status",
    // source = "form" if created_by IS NOT NULL, else "imported". When the
    // builder runs in --form-only mode (the default) this column is always
    // "form"; kept for thesis audit trails.
    "source"
  ];

  const lines = [header.join(",")];
  for (const c of cases) {
    const disease = normalizeDisease(c.diseaseRaw);
    if (!DISEASES.includes(disease)) continue;
    const row = [
      c.patientNumber ?? "",
      disease,
      c.diseaseRaw ?? "",
      c.caseClassification ?? "Confirmed",
      c.dateStarted ?? "",
      c.dateReported ?? "",
      c.municipalityId,
      c.municipalityName,
      c.barangayId,
      c.barangayName,
      "Davao de Oro",
      c.sex ?? "",
      c.age ?? "",
      "active",
      c.createdBy != null ? "form" : "imported"
    ];
    lines.push(row.map(fmtCsv).join(","));
  }
  await fs.writeFile(outPath, lines.join("\n") + "\n", "utf-8");
  return lines.length - 1;
}

// --------------------------------------------------------------------------- //
// Weekly aggregation per (municipality, disease)
// --------------------------------------------------------------------------- //

function buildWeeklyRows(cases, municipalities, dailyByMuni, envByMuni, opts) {
  /** @type {Map<string, Map<string, {count:number, barangays:Set<number>}>>} */
  const counts = new Map(); // muniId -> weekKey -> aggregates per disease (merged below)

  const perDisease = new Map(); // disease -> Map<muniId, Map<weekKey, count>>
  for (const disease of DISEASES) {
    perDisease.set(disease, new Map());
  }

  let earliest = null;
  let latest = null;

  for (const c of cases) {
    const disease = normalizeDisease(c.diseaseRaw);
    if (!DISEASES.includes(disease)) continue;
    const date = toDate(c.dateStarted ?? c.dateReported);
    if (!date) continue;
    const week = weekStart(date);
    const weekKey = ymd(week);
    if (!earliest || week < earliest) earliest = week;
    if (!latest || week > latest) latest = week;

    const diseaseMap = perDisease.get(disease);
    const muniMap = diseaseMap.get(c.municipalityId) ?? new Map();
    const bucket = muniMap.get(weekKey) ?? { count: 0, barangays: new Set() };
    bucket.count += 1;
    bucket.barangays.add(c.barangayId);
    muniMap.set(weekKey, bucket);
    diseaseMap.set(c.municipalityId, muniMap);
  }

  // Always emit at least ~24 months of weekly rows ending at `latest` so every
  // (municipality, disease) series has enough history (≥ lookback + horizon)
  // for the LSTM, even if the eligible case set is tiny / freshly seeded. Weeks
  // with no reports are represented with case_count = 0.
  const today = weekStart(new Date());
  if (!latest || latest < today) latest = today;
  const minEarliest = new Date(latest);
  minEarliest.setUTCFullYear(minEarliest.getUTCFullYear() - 2);
  if (!earliest || earliest > minEarliest) earliest = minEarliest;

  // Pad start to allow lookback features.
  const paddedStart = new Date(earliest);
  paddedStart.setUTCDate(paddedStart.getUTCDate() - 26 * 7);

  // Build dense (municipality x disease x week) grid.
  const weeks = Array.from(iterWeeks(paddedStart, latest));
  const rows = [];

  for (const muni of municipalities) {
    for (const disease of DISEASES) {
      const muniMap = perDisease.get(disease).get(muni.id) ?? new Map();
      const series = weeks.map((monday) => {
        const key = ymd(monday);
        const bucket = muniMap.get(key);
        const weather = aggregateWeeklyWeather(dailyByMuni, muni.name, monday);
        const { iso_year, iso_week } = isoYearWeek(monday);
        const month = monday.getUTCMonth() + 1;
        return {
          municipality_id: muni.id,
          municipality_name: muni.name,
          disease_code: disease,
          week_start: key,
          monday,
          iso_year,
          iso_week,
          month,
          is_peak_season: PEAK_SEASON_MONTHS.has(month) ? 1 : 0,
          week_sin: Math.sin((2 * Math.PI * iso_week) / 52),
          week_cos: Math.cos((2 * Math.PI * iso_week) / 52),
          case_count: bucket?.count ?? 0,
          barangay_count_reporting: bucket ? bucket.barangays.size : 0,
          ...weather
        };
      });

      // Lag / rolling features
      for (let i = 0; i < series.length; i += 1) {
        const row = series[i];
        // Case lags 1..26
        for (let lag = 1; lag <= 26; lag += 1) {
          row[`cases_lag_${lag}`] = i - lag >= 0 ? series[i - lag].case_count : null;
        }
        // Rolling sums
        for (const w of ROLLING_WINDOWS) {
          const start = Math.max(0, i - w + 1);
          let sum = 0;
          for (let j = start; j <= i; j += 1) sum += series[j].case_count;
          row[`cases_rolling_${w}wk`] = sum;
        }
        // Weather lags
        for (const lag of TEMP_LAGS) {
          row[`temp_mean_c_lag_${lag}`] = i - lag >= 0 ? series[i - lag].temp_mean_c : null;
        }
        for (const lag of HUMIDITY_LAGS) {
          row[`humidity_mean_pct_lag_${lag}`] =
            i - lag >= 0 ? series[i - lag].humidity_mean_pct : null;
        }
        for (const lag of RAINFALL_LAGS) {
          row[`rainfall_sum_mm_lag_${lag}`] =
            i - lag >= 0 ? series[i - lag].rainfall_sum_mm : null;
        }
        // Future targets t+1..t+4
        for (let h = 1; h <= HORIZON_WEEKS; h += 1) {
          row[`cases_t_plus_${h}`] = i + h < series.length ? series[i + h].case_count : null;
        }
      }

      // Drop the padded leading rows (where targets would be null near tail anyway).
      const trimmed = series.filter((row) => toDate(row.week_start) >= earliest);
      rows.push(...trimmed);
    }
  }

  // Attach environmental features per (muni, week). Done after rolling/lag
  // computation so we don't accidentally use future env data in lag features.
  attachEnvFeaturesToRows(rows, envByMuni);

  // Sort chronologically per series, then assign train/val/test splits.
  rows.sort((a, b) => {
    if (a.municipality_id !== b.municipality_id) return a.municipality_id - b.municipality_id;
    if (a.disease_code !== b.disease_code) return a.disease_code.localeCompare(b.disease_code);
    return a.week_start.localeCompare(b.week_start);
  });

  // Find every unique week_start in chronological order to decide split boundaries.
  const allWeeks = Array.from(new Set(rows.map((r) => r.week_start))).sort();
  const trainCutoffIdx = Math.floor(allWeeks.length * opts.trainFraction);
  const valCutoffIdx = Math.floor(allWeeks.length * (opts.trainFraction + opts.valFraction));
  const trainCutoff = allWeeks[trainCutoffIdx - 1] ?? "";
  const valCutoff = allWeeks[valCutoffIdx - 1] ?? "";

  for (const row of rows) {
    if (row.week_start <= trainCutoff) row.split = "train";
    else if (row.week_start <= valCutoff) row.split = "val";
    else row.split = "test";
  }

  return rows;
}

// --------------------------------------------------------------------------- //
// Final CSV writer
// --------------------------------------------------------------------------- //

function buildHeader() {
  const base = [
    "municipality_id",
    "municipality_name",
    "disease_code",
    "week_start",
    "iso_year",
    "iso_week",
    "case_count",
    "barangay_count_reporting"
  ];
  const lagCols = [];
  for (let lag = 1; lag <= 26; lag += 1) lagCols.push(`cases_lag_${lag}`);
  const rollingCols = ROLLING_WINDOWS.map((w) => `cases_rolling_${w}wk`);
  const seasonCols = ["week_sin", "week_cos", "month", "is_peak_season"];
  const weatherCols = ["temp_mean_c", "temp_min_c", "temp_max_c", "humidity_mean_pct", "rainfall_sum_mm"];
  const weatherLagCols = [
    ...TEMP_LAGS.map((l) => `temp_mean_c_lag_${l}`),
    ...HUMIDITY_LAGS.map((l) => `humidity_mean_pct_lag_${l}`),
    ...RAINFALL_LAGS.map((l) => `rainfall_sum_mm_lag_${l}`)
  ];
  const targetCols = [];
  for (let h = 1; h <= HORIZON_WEEKS; h += 1) targetCols.push(`cases_t_plus_${h}`);
  return [
    ...base,
    ...lagCols,
    ...rollingCols,
    ...seasonCols,
    ...weatherCols,
    ...weatherLagCols,
    ...ENV_FEATURE_COLUMNS,
    ...targetCols,
    "split"
  ];
}

function formatCell(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  return fmtCsv(value);
}

async function writeTrainingCsv(rows, outPath) {
  const header = buildHeader();
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((h) => formatCell(row[h])).join(","));
  }
  await fs.writeFile(outPath, lines.join("\n") + "\n", "utf-8");
  return lines.length - 1;
}

// --------------------------------------------------------------------------- //
// Driver
// --------------------------------------------------------------------------- //

async function main() {
  const opts = parseArgs(process.argv);
  await fs.mkdir(opts.outDir, { recursive: true });

  console.log("[build] Loading municipalities + cases from MySQL…");
  console.log(
    `[build]   source policy: confirmed = YES, form-submitted only = ` +
      `${opts.formOnly ? "YES" : "NO (--include-imported)"}`
  );
  const [municipalities, cases, envRows] = await Promise.all([
    fetchMunicipalities(),
    fetchConfirmedCases({ formOnly: opts.formOnly }),
    fetchCaseEnvironment()
  ]);
  console.log(
    `[build]   ${municipalities.length} municipalities, ${cases.length} eligible cases, ` +
      `${envRows.length} env reports`
  );

  if (cases.length === 0) {
    console.warn(
      "[build] WARNING: no cases passed the eligibility filter. The training " +
        "CSV will have case_count = 0 for every week — the model will only " +
        "learn the zero baseline. Submit cases through the report-case form, " +
        "or run with --include-imported to also use legacy data."
    );
  } else if (opts.formOnly && cases.length < 50) {
    console.warn(
      `[build] WARNING: only ${cases.length} form-submitted confirmed cases. ` +
        "LSTM forecasts will be very low-confidence until more cases are " +
        "reported. See ml/README.md §Data prerequisites."
    );
  }

  console.log(`[build] Loading weather archive: ${opts.weather}`);
  const dailyByMuni = await loadWeatherDaily(opts.weather);
  console.log(`[build]   ${dailyByMuni.size} municipalities with weather rows`);

  const envByMuni = aggregateCaseEnvironment(envRows);
  console.log(`[build]   ${envByMuni.size} municipalities with environmental reports`);

  console.log("[build] Writing case_line_list.csv…");
  const linePath = path.join(opts.outDir, "case_line_list.csv");
  const lineCount = await writeLineList(cases, linePath);
  console.log(`[build]   ${lineCount} rows -> ${linePath}`);

  console.log("[build] Aggregating weekly surveillance + features…");
  const rows = buildWeeklyRows(cases, municipalities, dailyByMuni, envByMuni, opts);
  const splits = rows.reduce((acc, r) => {
    acc[r.split] = (acc[r.split] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[build]   splits: ${JSON.stringify(splits)}`);

  const trainPath = path.join(opts.outDir, "surveillance_weekly_training.csv");
  const trainCount = await writeTrainingCsv(rows, trainPath);
  console.log(`[build]   ${trainCount} rows -> ${trainPath}`);

  console.log("[build] Done.");
}

main()
  .catch((err) => {
    console.error("[build] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    process.exit();
  });
