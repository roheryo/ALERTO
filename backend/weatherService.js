import { resolveWeatherCoords } from "./weatherCoords.js";

const PLACEHOLDER_API_KEYS = new Set([
  "",
  "your_openweather_key",
  "your-api-key",
  "changeme",
  "xxx"
]);

function resolveOpenWeatherApiKey() {
  const key = String(
    process.env.OPENWEATHER_API_KEY ?? process.env.VITE_OPENWEATHER_API_KEY ?? ""
  ).trim();
  if (!key || PLACEHOLDER_API_KEYS.has(key.toLowerCase())) return "";
  return key;
}

const OPENWEATHER_API_KEY = resolveOpenWeatherApiKey();

const CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.WEATHER_CACHE_TTL_MS ?? 10 * 60 * 1000) || 10 * 60 * 1000
);

/** @type {Map<string, { expires: number, data: object }>} */
const weatherCache = new Map();

function cacheKey(provider, lat, lon) {
  return `${provider}:${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function getCached(key) {
  const hit = weatherCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    weatherCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  weatherCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

function mapOpenMeteoCodeToCondition(code) {
  const n = Number(code);
  if (n === 0) return "Clear";
  if ([1, 2, 3].includes(n)) return "Cloudy";
  if ([45, 48].includes(n)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(n)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return "Rain";
  if ([95, 96, 99].includes(n)) return "Thunderstorm";
  return "Unknown";
}

function titleCaseCondition(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "Unknown";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function fetchOpenMeteo(lat, lon) {
  const key = cacheKey("open-meteo", lat, lon);
  const cached = getCached(key);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.current) {
    throw new Error("Open-Meteo request failed");
  }

  const payload = {
    temperature: Number(data.current.temperature_2m ?? 0),
    humidity: Number(data.current.relative_humidity_2m ?? 0),
    condition: mapOpenMeteoCodeToCondition(data.current.weather_code),
    provider: "open-meteo"
  };
  setCached(key, payload);
  return payload;
}

async function fetchOpenWeatherMap(lat, lon) {
  const key = cacheKey("openweathermap", lat, lon);
  const cached = getCached(key);
  if (cached) return cached;

  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
    `&appid=${encodeURIComponent(OPENWEATHER_API_KEY)}&units=metric`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || "OpenWeatherMap request failed";
    throw new Error(msg);
  }

  const payload = {
    temperature: Number(data?.main?.temp ?? 0),
    humidity: Number(data?.main?.humidity ?? 0),
    condition: titleCaseCondition(data?.weather?.[0]?.main ?? data?.weather?.[0]?.description),
    provider: "openweathermap"
  };
  setCached(key, payload);
  return payload;
}

async function fetchCurrentWeather(lat, lon) {
  let usedFallback = false;

  if (OPENWEATHER_API_KEY) {
    try {
      const reading = await fetchOpenWeatherMap(lat, lon);
      return { ...reading, providerFallback: false };
    } catch (err) {
      usedFallback = true;
      const msg = String(err?.message ?? "");
      if (/invalid api key|401|unauthorized/i.test(msg)) {
        console.warn(
          "[ALERTO API] OpenWeatherMap key not active yet (new keys can take up to 2 hours). Using Open-Meteo."
        );
      } else {
        console.warn("[ALERTO API] OpenWeatherMap failed, falling back to Open-Meteo:", msg);
      }
    }
  }

  const reading = await fetchOpenMeteo(lat, lon);
  return { ...reading, providerFallback: usedFallback };
}

/**
 * @param {{ municipality: string, barangay?: string }} location
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string, status?: number }>}
 */
export async function getWeatherForLocation({ municipality, barangay } = {}) {
  const coords = resolveWeatherCoords(municipality, barangay);
  if (!coords) {
    return {
      ok: false,
      status: 400,
      error: `No coordinates mapped for municipality: ${municipality}`
    };
  }

  try {
    const reading = await fetchCurrentWeather(coords.lat, coords.lon);
    const locationLabel = coords.barangay
      ? `${coords.barangay}, ${coords.municipalityLabel}`
      : coords.municipalityLabel;

    return {
      ok: true,
      data: {
        municipality: coords.municipalityLabel,
        barangay: coords.barangay,
        locationLabel,
        temperature: reading.temperature,
        humidity: reading.humidity,
        condition: reading.condition,
        provider: reading.provider,
        providerFallback: Boolean(reading.providerFallback),
        coordSource: coords.coordSource,
        lat: coords.lat,
        lon: coords.lon,
        cachedTtlMs: CACHE_TTL_MS
      }
    };
  } catch (err) {
    return { ok: false, status: 502, error: err?.message ?? "Failed to fetch weather" };
  }
}
