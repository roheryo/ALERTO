/**
 * Browser-only weather (Open-Meteo). No app backend required.
 * Replace with your own API if you add a server later.
 */

const MUNICIPALITY_COORDS = {
  nabunturan: { lat: 7.6075, lon: 125.9667, label: "Nabunturan" },
  monkayo: { lat: 7.8175, lon: 126.0503, label: "Monkayo" },
  compostela: { lat: 7.6731, lon: 126.0886, label: "Compostela" },
  mawab: { lat: 7.5592, lon: 125.9928, label: "Mawab" },
  maco: { lat: 7.3619, lon: 125.8553, label: "Maco" },
  maragusan: { lat: 7.3853, lon: 126.1069, label: "Maragusan" },
  montevista: { lat: 7.695, lon: 125.9869, label: "Montevista" },
  pantukan: { lat: 7.1242, lon: 126.0078, label: "Pantukan" },
  "new bataan": { lat: 7.5325, lon: 126.1428, label: "New Bataan" },
  newbataan: { lat: 7.5325, lon: 126.1428, label: "New Bataan" },
  laak: { lat: 7.9703, lon: 125.9994, label: "Laak" },
  mabini: { lat: 7.3122, lon: 125.8533, label: "Mabini" }
};

function normalizeMunicipalityName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

export async function fetchWeatherForMunicipality(rawMunicipality) {
  const key = normalizeMunicipalityName(rawMunicipality);
  const coords = MUNICIPALITY_COORDS[key];
  if (!coords) {
    return { ok: false, error: `No coordinates mapped for municipality: ${rawMunicipality}` };
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.current) {
    return { ok: false, error: "Failed to fetch weather" };
  }

  return {
    ok: true,
    data: {
      municipality: coords.label,
      temperature: Number(data.current.temperature_2m ?? 0),
      humidity: Number(data.current.relative_humidity_2m ?? 0),
      condition: mapOpenMeteoCodeToCondition(data.current.weather_code),
      provider: "open-meteo"
    }
  };
}

/** Municipalities with coordinates (for UI when there is no case-derived list). */
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
