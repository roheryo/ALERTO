import { formatWeatherProvider, getWeatherIcon } from "../../lib/weatherDisplay";

/**
 * Live weather card for account municipality/barangay (read-only scope labels).
 */
export default function LiveWeatherCard({
  weather,
  municipalityLabel = "",
  barangayLabel = "",
  className = ""
}) {
  const location =
    weather?.locationLabel ||
    [weather?.barangay, weather?.municipality].filter(Boolean).join(", ") ||
    "Davao de Oro";

  const providerLabel = formatWeatherProvider(weather?.provider);
  const showFallbackNote =
    weather?.providerFallback && String(weather?.provider).toLowerCase() === "open-meteo";

  return (
    <div className={`weather-container${className ? ` ${className}` : ""}`}>
      <div className="weather-card">
        <div className="weather-header">
          <div className="weather-header-left">
            <div className="weather-title">Live Weather</div>
            <div className="weather-location">{location}</div>
          </div>
          <div className="weather-header-right">
            <span className="weather-pill" aria-label="Weather data source">
              {providerLabel}
            </span>
          </div>
        </div>

        {showFallbackNote ? (
          <p className="weather-fallback-note" role="status">
            OpenWeatherMap is not active yet; showing Open-Meteo until your API key is enabled.
          </p>
        ) : null}

        <div className="weather-scope weather-controls--pro" aria-label="Weather location from your account">
          <div className="weather-scope-item">
            <span className="weather-scope-label">Municipality</span>
            <span className="weather-scope-value">{municipalityLabel || "—"}</span>
          </div>
          <div className="weather-scope-item">
            <span className="weather-scope-label">Barangay</span>
            <span className="weather-scope-value">{barangayLabel || "—"}</span>
          </div>
        </div>

        <div className="weather-main weather-main--pro">
          <div className="weather-icon" aria-hidden="true">
            {getWeatherIcon(weather?.condition)}
          </div>
          <div className="weather-primary">
            <div className="weather-stats weather-stats--pro">
              <div className="weather-stat weather-stat--primary">
                <div className="weather-stat-label">Temperature</div>
                <div className="weather-stat-value">
                  {weather?.loading
                    ? "…"
                    : weather?.temperature !== null
                      ? `${weather.temperature.toFixed(1)}°C`
                      : "—"}
                </div>
              </div>
              <div className="weather-stat">
                <div className="weather-stat-label">Condition</div>
                <div className="weather-stat-value">{weather?.condition ?? "—"}</div>
              </div>
              <div className="weather-stat">
                <div className="weather-stat-label">Humidity</div>
                <div className="weather-stat-value">
                  {weather?.loading
                    ? "…"
                    : weather?.humidity !== null
                      ? `${weather.humidity}%`
                      : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
