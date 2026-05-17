import { formatWeatherProvider, getWeatherIcon } from "@/lib/weatherDisplay";

function rainFromCondition(condition) {
  const c = String(condition ?? "").toLowerCase();
  if (c.includes("rain") || c.includes("drizzle") || c.includes("storm")) return "Rain likely";
  if (c.includes("cloud")) return "Low / variable";
  if (c.includes("clear") || c.includes("sun")) return "None observed";
  return "—";
}

function formatTemperature(weather) {
  if (weather?.loading) return "…";
  if (weather?.temperature == null) return "—";
  return `${weather.temperature.toFixed(1)}\u00A0°C`;
}

function formatHumidity(weather) {
  if (weather?.loading) return "…";
  if (weather?.humidity == null) return "—";
  return `${weather.humidity}%`;
}

/**
 * Environmental context strip — multivariate thesis framing (not diagnostic).
 */
export default function MunicipalWeatherContext({ weather, municipalityName = "" }) {
  const location =
    weather?.locationLabel || municipalityName || "Municipality";
  const conditionLabel = weather?.loading ? "…" : weather?.condition ?? "—";

  const metrics = [
    { id: "location", label: "Location", value: location },
    { id: "temperature", label: "Temperature", value: formatTemperature(weather) },
    { id: "humidity", label: "Humidity", value: formatHumidity(weather) },
    {
      id: "rain",
      label: "Rain (proxy)",
      value: weather?.loading ? "…" : rainFromCondition(weather?.condition)
    },
    { id: "conditions", label: "Conditions", value: conditionLabel }
  ];

  return (
    <section className="muni-panel muni-env-strip" aria-labelledby="muni-env-title">
      <header className="muni-section-head muni-section-head--env">
        <div className="muni-env-head-copy">
          <p className="muni-section-kicker">Multivariate context</p>
          <div className="muni-env-title-row">
            <span className="muni-env-title-icon" aria-hidden="true">
              {getWeatherIcon(weather?.condition)}
            </span>
            <h3 id="muni-env-title">Environmental context</h3>
          </div>
          <p className="muni-section-sub muni-env-head-sub">
            Temperature, humidity, and rainfall support interpretation alongside case trends — not a
            diagnosis of outbreak cause.
          </p>
        </div>
        <span className="muni-env-pill">{formatWeatherProvider(weather?.provider) || "Weather API"}</span>
      </header>

      <div className="muni-env-metrics" role="list">
        {metrics.map((metric) => (
          <article key={metric.id} className="muni-env-metric" role="listitem">
            <span className="muni-env-metric-label">{metric.label}</span>
            <span className="muni-env-metric-value">{metric.value}</span>
          </article>
        ))}
      </div>

      <p className="muni-env-future-note">
        Incident reports (flooding, WASH) will appear here when that module is enabled.
      </p>
    </section>
  );
}
