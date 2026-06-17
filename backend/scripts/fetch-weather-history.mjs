/**
 * Fetch daily weather history for each Davao de Oro municipality from the
 * Open-Meteo ERA5 archive and save it to data/processed/weather_daily.csv.
 *
 * The CSV is consumed by `build-ml-datasets.mjs`, which aggregates the daily
 * rows into weekly municipal weather features (temp_mean/min/max, humidity,
 * rainfall + lagged rainfall) for the LSTM training set.
 *
 * Usage:
 *   node backend/scripts/fetch-weather-history.mjs
 *   node backend/scripts/fetch-weather-history.mjs --start 2023-01-01 --end 2026-05-10
 *   node backend/scripts/fetch-weather-history.mjs --out data/processed/weather_daily.csv
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { MUNICIPALITY_COORDS, WEATHER_MUNICIPALITY_NAMES } from "../services/weatherCoords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

function parseArgs(argv) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Use Open-Meteo's archive which lags real-time by ~5 days.
  const fiveDaysAgo = new Date(today);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const defaultEnd = fiveDaysAgo.toISOString().slice(0, 10);

  const opts = {
    start: "2023-01-01",
    end: defaultEnd,
    out: path.join(REPO_ROOT, "data", "processed", "weather_daily.csv")
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--start" && next) {
      opts.start = next;
      i += 1;
    } else if (arg === "--end" && next) {
      opts.end = next;
      i += 1;
    } else if (arg === "--out" && next) {
      opts.out = path.isAbsolute(next) ? next : path.join(REPO_ROOT, next);
      i += 1;
    }
  }
  return opts;
}

/**
 * @returns {Promise<Array<{date:string, temp_mean_c:number|null, temp_min_c:number|null, temp_max_c:number|null, humidity_mean_pct:number|null, rainfall_sum_mm:number|null}>>}
 */
async function fetchDaily(lat, lon, start, end) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=temperature_2m_mean,temperature_2m_min,temperature_2m_max,` +
    `precipitation_sum,relative_humidity_2m_mean&timezone=Asia%2FManila`;

  const res = await fetch(url, { headers: { "User-Agent": "ALERTO/dev" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const d = data?.daily ?? {};
  const dates = d.time ?? [];
  return dates.map((date, i) => ({
    date,
    temp_mean_c: d.temperature_2m_mean?.[i] ?? null,
    temp_min_c: d.temperature_2m_min?.[i] ?? null,
    temp_max_c: d.temperature_2m_max?.[i] ?? null,
    humidity_mean_pct: d.relative_humidity_2m_mean?.[i] ?? null,
    rainfall_sum_mm: d.precipitation_sum?.[i] ?? null
  }));
}

function fmt(value) {
  if (value == null || Number.isNaN(value)) return "";
  return Number(value).toFixed(2);
}

async function main() {
  const opts = parseArgs(process.argv);
  await fs.mkdir(path.dirname(opts.out), { recursive: true });

  const lines = [
    "municipality_name,date,temp_mean_c,temp_min_c,temp_max_c,humidity_mean_pct,rainfall_sum_mm"
  ];

  for (const name of WEATHER_MUNICIPALITY_NAMES) {
    const coords = MUNICIPALITY_COORDS[name.toLowerCase()];
    if (!coords) {
      console.warn(`[weather] No coords for ${name}, skipping`);
      continue;
    }
    process.stdout.write(`[weather] ${name} (${opts.start} -> ${opts.end})… `);
    try {
      const rows = await fetchDaily(coords.lat, coords.lon, opts.start, opts.end);
      for (const r of rows) {
        lines.push(
          [
            name,
            r.date,
            fmt(r.temp_mean_c),
            fmt(r.temp_min_c),
            fmt(r.temp_max_c),
            fmt(r.humidity_mean_pct),
            fmt(r.rainfall_sum_mm)
          ].join(",")
        );
      }
      console.log(`${rows.length} days`);
    } catch (err) {
      console.error(`FAILED — ${err.message}`);
    }
    // Open-Meteo is gentle but we still throttle to be polite.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await fs.writeFile(opts.out, lines.join("\n") + "\n", "utf-8");
  console.log(`\nSaved ${lines.length - 1} daily rows -> ${opts.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
