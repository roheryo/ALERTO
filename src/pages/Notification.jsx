import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import "./Dashboard.css";
import "./Notification.css";
import logo from "../assets/images/ddoLOGO.jpg";
import { fetchWeatherForMunicipality, WEATHER_MUNICIPALITY_NAMES } from "../lib/weatherClient";
import { useAuth } from "../context/AuthContext";
import { sessionUserFromAuth } from "../lib/authUser";

const RISK_THRESHOLD = {
  Dengue: 10,
  ILI: 14,
  AWD: 8
};

function normalizeDisease(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("dengue")) return "Dengue";
  if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) return "ILI";
  if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) return "AWD";
  return "";
}

function fmtDateTime(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function Notification() {
  const { user: authUser } = useAuth();
  const user = useMemo(() => sessionUserFromAuth(authUser), [authUser]);
  const roleRaw = String(user?.role ?? "").toLowerCase();
  const roleKey = roleRaw.includes("barangay")
    ? "barangay"
    : roleRaw.includes("municipal")
    ? "municipal"
    : "provincial";

  const lockedMunicipality = String(user?.municipality ?? "").trim();
  const lockedBarangay = String(user?.barangay ?? "").trim();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weatherByMunicipality, setWeatherByMunicipality] = useState({});

  const [diseaseFilter, setDiseaseFilter] = useState("All");
  const [municipalityFilter, setMunicipalityFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");

  useEffect(() => {
    setCases([]);
    setLoading(false);
  }, []);

  const municipalityOptions = useMemo(() => {
    const s = new Set();
    for (const c of cases) {
      const m = String(c?.municipality ?? "").trim();
      if (m) s.add(m);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [cases]);

  useEffect(() => {
    const municipalities =
      roleKey === "provincial"
        ? municipalityOptions.length
          ? municipalityOptions
          : WEATHER_MUNICIPALITY_NAMES
        : lockedMunicipality
        ? [lockedMunicipality]
        : [];

    if (!municipalities.length) {
      setWeatherByMunicipality({});
      return;
    }

    let cancelled = false;

    Promise.all(
      municipalities.map(async (m) => {
        try {
          const result = await fetchWeatherForMunicipality(m);
          if (!result.ok) return [m, null];
          return [m, result.data];
        } catch {
          return [m, null];
        }
      })
    ).then((rows) => {
      if (cancelled) return;
      const map = {};
      for (const [m, d] of rows) {
        if (d) map[m] = d;
      }
      setWeatherByMunicipality(map);
    });

    return () => {
      cancelled = true;
    };
  }, [municipalityOptions, roleKey, lockedMunicipality]);

  const scopedCases = useMemo(() => {
    const normalized = cases.map((c) => {
      const d = new Date(c?.dateStarted || c?.createdAt || c?.created_at || c?.created);
      return {
        ...c,
        _disease: normalizeDisease(c?.diseaseType),
        _municipality: String(c?.municipality ?? "").trim(),
        _barangay: String(c?.barangay ?? "").trim(),
        _date: Number.isNaN(d.getTime()) ? null : d
      };
    });

    return normalized.filter((c) => {
      if (!c._date || !c._disease) return false;
      if (roleKey === "municipal" && c._municipality !== lockedMunicipality) return false;
      if (roleKey === "barangay") {
        if (c._municipality !== lockedMunicipality) return false;
        if (c._barangay !== lockedBarangay) return false;
      }
      return true;
    });
  }, [cases, roleKey, lockedMunicipality, lockedBarangay]);

  const baseMunicipalityScope = useMemo(() => {
    if (roleKey === "municipal" || roleKey === "barangay") return lockedMunicipality;
    return municipalityFilter;
  }, [roleKey, lockedMunicipality, municipalityFilter]);

  const alerts = useMemo(() => {
    const results = [];
    const now = new Date();
    const todayStart = daysAgo(0);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);

    const scoped = scopedCases.filter((c) => {
      if (baseMunicipalityScope && c._municipality !== baseMunicipalityScope) return false;
      if (diseaseFilter !== "All" && c._disease !== diseaseFilter) return false;
      return true;
    });

    // Build grouped counts by municipality + disease.
    const groupMap = new Map();
    for (const c of scoped) {
      const key = `${c._municipality}__${c._disease}`;
      const cur = groupMap.get(key) || {
        municipality: c._municipality,
        disease: c._disease,
        recent7: 0,
        prev7: 0,
        todayNew: 0,
        latestDate: c._date
      };
      if (c._date >= sevenDaysAgo) cur.recent7 += 1;
      else if (c._date >= fourteenDaysAgo) cur.prev7 += 1;
      if (c._date >= todayStart) cur.todayNew += 1;
      if (!cur.latestDate || c._date > cur.latestDate) cur.latestDate = c._date;
      groupMap.set(key, cur);
    }

    for (const row of groupMap.values()) {
      const basePrev = row.prev7 || 1;
      const growthPct = ((row.recent7 - row.prev7) / basePrev) * 100;
      const trend = row.recent7 >= row.prev7 ? "Increasing" : "Decreasing";
      const confidence = Math.min(98, Math.max(62, 65 + row.recent7 * 2 + Math.max(0, growthPct) * 0.4));

      // HIGH RISK predictive alert
      if (row.recent7 >= (RISK_THRESHOLD[row.disease] || 10)) {
        results.push({
          id: `high-${row.municipality}-${row.disease}`,
          level: "HIGH",
          category: "PREDICTIVE",
          disease: row.disease,
          title: `High ${row.disease} Risk in ${row.municipality}`,
          description: `Model projects possible outbreak escalation in the next 1-4 weeks.`,
          location: row.municipality,
          timestamp: row.latestDate?.toISOString() || now.toISOString(),
          trend,
          confidence: Math.round(confidence),
          timeWindow: "Next 1-4 weeks",
          suggestedAction:
            row.disease === "Dengue"
              ? "Activate vector control, larval source reduction, and barangay-level clean-up operations within 72 hours."
              : "Preposition medicines, intensify syndromic surveillance, and alert RHU/BHU staff for early case detection."
        });
      }

      // WARNING trend alert
      if (growthPct >= 30 && row.recent7 >= 3) {
        results.push({
          id: `warn-${row.municipality}-${row.disease}`,
          level: "WARNING",
          category: "TREND",
          disease: row.disease,
          title: `${row.disease} cases increased by ${Math.round(growthPct)}%`,
          description: `Compared with previous 7-day period (${row.prev7} -> ${row.recent7} cases).`,
          location: row.municipality,
          timestamp: row.latestDate?.toISOString() || now.toISOString(),
          trend: "Increasing",
          confidence: null,
          timeWindow: "Current week vs previous week",
          suggestedAction:
            "Validate case clustering, intensify field investigation, and issue advisory to local health units."
        });
      }

      // INFO new logs alert
      if (row.todayNew > 0) {
        results.push({
          id: `info-${row.municipality}-${row.disease}`,
          level: "INFO",
          category: "NEW_CASES",
          disease: row.disease,
          title: `${row.todayNew} new ${row.disease} case${row.todayNew > 1 ? "s" : ""} reported today`,
          description: "New case logs recorded in surveillance database.",
          location: row.municipality,
          timestamp: now.toISOString(),
          trend: null,
          confidence: null,
          timeWindow: "Today",
          suggestedAction: "Review line list completeness and verify case classification within 24 hours."
        });
      }
    }

    // Weather-driven health risk alerts (thesis rule engine)
    for (const [municipality, weather] of Object.entries(weatherByMunicipality)) {
      if (!weather) continue;
      if (baseMunicipalityScope && municipality !== baseMunicipalityScope) continue;

      const temperature = Number(weather.temperature);
      const humidity = Number(weather.humidity);
      const condition = String(weather.condition || "").toLowerCase();
      const looksRainy = condition.includes("rain") || condition.includes("storm") || condition.includes("drizzle");

      // Rule 1: temp >= 28 and humidity >= 70 => High Dengue Risk
      if ((diseaseFilter === "All" || diseaseFilter === "Dengue") && temperature >= 28 && humidity >= 70) {
        results.push({
          id: `wx-high-dengue-${municipality}`,
          level: "HIGH",
          category: "ENVIRONMENT",
          disease: "Dengue",
          title: `High Dengue Risk Weather Pattern in ${municipality}`,
          description: `Temperature ${temperature.toFixed(1)}°C and humidity ${humidity}% are favorable for mosquito proliferation.`,
          location: municipality,
          timestamp: new Date().toISOString(),
          trend: "Increasing",
          confidence: Math.min(96, Math.round(72 + (temperature - 28) * 3 + (humidity - 70) * 0.4)),
          timeWindow: "Next 1-3 weeks",
          suggestedAction:
            "Initiate larval source reduction, conduct entomological checks, and issue dengue prevention reminders to households."
        });
      }

      // Rule 2: heavy rain => Possible AWD Risk
      if ((diseaseFilter === "All" || diseaseFilter === "AWD") && looksRainy) {
        results.push({
          id: `wx-awd-${municipality}`,
          level: "WARNING",
          category: "ENVIRONMENT",
          disease: "AWD",
          title: `Possible AWD Risk: Rainfall Event in ${municipality}`,
          description: `Current weather condition (${weather.condition}) may increase water contamination and AWD transmission risk.`,
          location: municipality,
          timestamp: new Date().toISOString(),
          trend: "Increasing",
          confidence: 78,
          timeWindow: "Next 3-10 days",
          suggestedAction:
            "Inspect water sources, reinforce chlorination and hygiene campaigns, and monitor AWD consultations daily."
        });
      }

      // Rule 3: significant temp drop => ILI Risk Increase
      if ((diseaseFilter === "All" || diseaseFilter === "ILI") && temperature <= 24) {
        results.push({
          id: `wx-ili-${municipality}`,
          level: "WARNING",
          category: "ENVIRONMENT",
          disease: "ILI",
          title: `ILI Risk Increase: Temperature Drop in ${municipality}`,
          description: `Lower ambient temperature (${temperature.toFixed(1)}°C) may contribute to increased respiratory illness transmission.`,
          location: municipality,
          timestamp: new Date().toISOString(),
          trend: "Increasing",
          confidence: 74,
          timeWindow: "Next 1-2 weeks",
          suggestedAction:
            "Reinforce respiratory hygiene messaging, monitor ILI consultations, and advise facilities to prepare for increased demand."
        });
      }
    }
    const built = results
      .filter((a) => (levelFilter === "All" ? true : a.level === levelFilter))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Notification array/list payload required by system design.
    const notificationPayload = built.map((a) => ({
      type: a.level,
      message: a.title,
      location: a.location,
      timestamp: a.timestamp
    }));
    void notificationPayload;

    return built;
  }, [scopedCases, baseMunicipalityScope, diseaseFilter, levelFilter, weatherByMunicipality]);

  const counts = useMemo(() => {
    const out = { HIGH: 0, WARNING: 0, INFO: 0 };
    for (const a of alerts) out[a.level] += 1;
    return out;
  }, [alerts]);

  return (
    <div className="notify-page">
      <header className="dashboard-header">
        <div className="notify-header-lead">
          <h2 className="header-title">Predictive Alerts and Notifications</h2>
          <p className="header-subline">
            ALERTO Early Warning Center - proactive disease surveillance support for health officials
          </p>
        </div>
        <div className="header-right">
          <Link to="/dashboard/notification" className="header-notification-link" aria-label="Notifications">
            <FaBell />
          </Link>
          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>Provincial Health Office</p>
          </div>
          <img src={logo} alt="logo" className="header-logo" />
        </div>
      </header>

      <div className="notify-body">
        <div className="notify-summary">
        <div className="pill high">High Risk: {counts.HIGH}</div>
        <div className="pill warning">Warning: {counts.WARNING}</div>
        <div className="pill info">Info: {counts.INFO}</div>
      </div>

      <div className="notify-filters">
        <label>
          Disease
          <select value={diseaseFilter} onChange={(e) => setDiseaseFilter(e.target.value)}>
            <option>All</option>
            <option>Dengue</option>
            <option>ILI</option>
            <option>AWD</option>
          </select>
        </label>

        <label>
          Municipality
          <select
            value={roleKey === "municipal" || roleKey === "barangay" ? lockedMunicipality : municipalityFilter}
            onChange={(e) => setMunicipalityFilter(e.target.value)}
            disabled={roleKey === "municipal" || roleKey === "barangay"}
          >
            <option value="">{roleKey === "provincial" ? "All Municipalities" : lockedMunicipality || "—"}</option>
            {roleKey === "provincial" &&
              municipalityOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </select>
        </label>

        <label>
          Alert Level
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="All">All Levels</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="notify-empty">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="notify-empty">No alerts for current filters.</div>
      ) : (
        <div className="notify-grid">
          {alerts.map((a) => (
            <article
              key={a.id}
              className={`alert-card ${a.level.toLowerCase()} ${a.category === "ENVIRONMENT" ? "environment" : ""}`}
            >
              <div className="alert-top">
                <span className="alert-badge">{a.level}</span>
                <span className="alert-time">{fmtDateTime(a.timestamp)}</span>
              </div>

              <h3>{a.title}</h3>
              <p className="desc">{a.description}</p>

              <div className="alert-meta">
                <div>
                  <strong>Disease:</strong> {a.disease}
                </div>
                <div>
                  <strong>Location:</strong> {a.location}
                </div>
                <div>
                  <strong>Window:</strong> {a.timeWindow}
                </div>
                {a.trend && (
                  <div>
                    <strong>Trend:</strong> {a.trend}
                  </div>
                )}
                {a.confidence !== null && (
                  <div>
                    <strong>Confidence:</strong> {a.confidence}%
                  </div>
                )}
              </div>

              <div className="action-box">
                <strong>Suggested Action:</strong>
                <span>{a.suggestedAction}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default Notification;