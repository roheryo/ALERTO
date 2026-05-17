/** Human-readable label for weather API provider id from backend. */
export function formatWeatherProvider(provider) {
  const p = String(provider ?? "").toLowerCase();
  if (p === "openweathermap") return "OpenWeather";
  if (p === "open-meteo") return "Open-Meteo";
  return provider ? String(provider) : "Open-Meteo";
}

/** Emoji icon from condition text (OpenWeather or Open-Meteo). */
export function getWeatherIcon(condition) {
  const c = String(condition ?? "").toLowerCase();
  if (c.includes("thunder")) return "⛈";
  if (c.includes("rain") || c.includes("drizzle")) return "🌧";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "🌫";
  if (c.includes("cloud")) return "☁";
  if (c.includes("clear") || c.includes("sun")) return "☀";
  return "🌡";
}
