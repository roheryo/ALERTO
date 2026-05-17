import { useEffect, useMemo, useState } from "react";
import { fetchWeatherForLocation } from "../lib/weatherClient";

const INITIAL = {
  municipality: "",
  barangay: "",
  locationLabel: "",
  temperature: null,
  humidity: null,
  condition: "Loading...",
  provider: "",
  providerFallback: false,
  loading: true,
  error: null
};

/**
 * Live weather for the logged-in account scope (municipality + optional barangay).
 * Data is loaded via GET /weather (OpenWeatherMap when configured, else Open-Meteo).
 */
export function useAccountWeather({ municipality, barangay, token, fallbackMunicipality = "Nabunturan" } = {}) {
  const accountMunicipality = String(municipality ?? "").trim();
  const accountBarangay = String(barangay ?? "").trim();

  const target = useMemo(
    () => ({
      municipality: accountMunicipality || fallbackMunicipality,
      barangay: accountBarangay
    }),
    [accountMunicipality, accountBarangay, fallbackMunicipality]
  );

  const [weather, setWeather] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    const { municipality: muni, barangay: brgy } = target;
    const locationLabel = [brgy, muni].filter(Boolean).join(", ");

    setWeather((w) => ({
      ...w,
      loading: true,
      error: null,
      condition: "Loading...",
      locationLabel
    }));

    fetchWeatherForLocation({ municipality: muni, barangay: brgy, token })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok || result.error) {
          setWeather({
            municipality: muni,
            barangay: brgy,
            locationLabel,
            temperature: null,
            humidity: null,
            condition: "Unavailable",
            provider: "",
            providerFallback: false,
            loading: false,
            error: result.error ?? "Failed to fetch weather"
          });
          return;
        }

        const data = result.data;
        setWeather({
          municipality: data?.municipality || muni,
          barangay: data?.barangay || brgy,
          locationLabel: data?.locationLabel || locationLabel,
          temperature: Number.isFinite(data?.temperature) ? data.temperature : null,
          humidity: Number.isFinite(data?.humidity) ? data.humidity : null,
          condition: data?.condition || "Unknown",
          provider: String(data?.provider ?? ""),
          providerFallback: Boolean(data?.providerFallback),
          loading: false,
          error: null
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setWeather({
          municipality: muni,
          barangay: brgy,
          locationLabel,
          temperature: null,
          humidity: null,
          condition: "Unavailable",
          provider: "",
          providerFallback: false,
          loading: false,
          error: err?.message ?? "Failed to fetch weather"
        });
      });

    return () => {
      cancelled = true;
    };
  }, [target, token]);

  return {
    weather,
    accountMunicipality,
    accountBarangay,
    weatherTarget: target
  };
}
