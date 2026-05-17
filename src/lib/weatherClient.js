/**
 * Weather client — calls ALERTO API proxy (backend/weatherService.js).
 * API keys stay on the server (OPENWEATHER_API_KEY in backend/.env).
 */

import { apiFetch } from "./api";

export const WEATHER_MUNICIPALITY_NAMES = [
  "Nabunturan",
  "Monkayo",
  "Compostela",
  "Mawab",
  "Maco",
  "Maragusan",
  "Montevista",
  "Pantukan",
  "New Bataan",
  "Laak",
  "Mabini"
];

/**
 * Fetch current weather for municipality + optional barangay (per-barangay coords on server).
 * @param {{ municipality: string, barangay?: string, token?: string }} options
 */
export async function fetchWeatherForLocation({ municipality, barangay, token } = {}) {
  const muni = String(municipality ?? "").trim();
  if (!muni) {
    return { ok: false, error: "Municipality is required" };
  }

  const params = new URLSearchParams({ municipality: muni });
  const brgy = String(barangay ?? "").trim();
  if (brgy) params.set("barangay", brgy);

  try {
    const body = await apiFetch(`/weather?${params.toString()}`, { token });
    const weather = body?.weather;
    if (!weather) {
      return { ok: false, error: "Invalid weather response from server" };
    }
    return { ok: true, data: weather };
  } catch (err) {
    return { ok: false, error: err?.message ?? "Failed to fetch weather" };
  }
}

/** @deprecated Use fetchWeatherForLocation */
export async function fetchWeatherForMunicipality(rawMunicipality, token) {
  return fetchWeatherForLocation({ municipality: rawMunicipality, token });
}
