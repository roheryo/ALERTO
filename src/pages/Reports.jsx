import { useEffect, useMemo, useState } from "react";
import "./Reports.css";

const MUNICIPALITY_DATA = {
  Compostela: [
    "Aurora","Bagongon","Gabi","Lagab","Mangayon","Mapaca","Maparat",
    "New Alegria","Ngan","Osmeña","Panansalan","Poblacion",
    "San Jose","San Miguel","Siocon","Tamia"
  ],
  Maragusan: [
    "Bagong Silang","Bahi","Cambawan","Coronobe","Katipunan","Lahi",
    "Langgawisan","Mabugnao","Magcagong","Mahayahay","Mapawa",
    "Maragusan (Poblacion)","Mauswagon","New Albay","New Katipunan",
    "New Manay","New Panay","Paloc","Parasanon","Talian","Tandik",
    "Tigbao","Tupaz","Tupaz Proper"
  ],
  Monkayo: [
    "Awao","Babag","Banlag","Baylo","Casoon","Haguimitan","Inambatan",
    "Macopa","Mamunga","Mount Diwata","Naboc","Olaycon","Pasian",
    "Poblacion","Rizal","Salvacion","San Isidro","San Jose",
    "Tubo-tubo","Union","Upper Ulip"
  ],
  Montevista: [
    "Banagbanag","Banglasan","Bankerohan Norte","Bankerohan Sur",
    "Camansi","Camantangan","Concepcion","Dauman","Kapatagan",
    "Lebanon","Linoan","Mayaon","New Eagle","New Visayas",
    "Prosperidad","San Jose","San Vicente","Santa Maria","Tapasan","Poblacion"
  ],
  "New Bataan": [
    "Andap","Bantacan","Batinao","Cabinuangan (Poblacion)","Camanlangan",
    "Cogonon","Fatima","Kahayag","Katipunan","Magangit","Magsaysay",
    "Manurigao","Pagsabangan","Panag","San Roque","Tandawan"
  ],
  Nabunturan: [
    "Anislagan","Antiquera","Basak","Bayabas","Bukal","Cabacungan",
    "Cabidianan","Katipunan","Libasan","Linda","Magading","Magsaysay",
    "Mainit","Manat","Matilo","Mipangi","New Dauis","New Sibonga",
    "Ogao","Pangutosan","Poblacion","San Isidro","San Roque",
    "San Vicente","Santa Maria","Santo Niño (Kao)","Sasa","Tagnocon"
  ],
  Laak: [
    "Aguinaldo","Amor Cruz","Ampawid","Andap","Anitap","Bagong Silang",
    "Banbanon","Belmonte","Binasbas","Bullucan","Cebulida","Concepcion",
    "Datu Ampunan","Datu Davao","Doña Josefa","El Katipunan","Il Papa",
    "Imelda","Inacayan","Kaligutan","Kapatagan","Kidawa","Kilagding",
    "Kiokmay","Laak (Poblacion)","Langtud","Longanapan","Mabuhay",
    "Macopa","Malinao","Mangloy","Melale","Naga","New Bethlehem",
    "Panamoren","Sabud","San Antonio","Santa Emilia","Santo Niño","Sisimon"
  ],
  Mabini: [
    "Cadunan","Concepcion","Cuvia","Golden Valley (Maraut)","Libodon",
    "Pindasan","Poblacion","San Antonio","San Vicente",
    "Tagnanan (Mabini)","Del Pilar"
  ],
  Maco: [
    "Anibongan","Anislagan","Binuangan","Bucana","Calabcab","Concepcion",
    "Dumlan","Elizalde (Somil)","Gubatan","Hijo","Kinuban","Langgam",
    "Lapu-lapu","Libay-libay","Limbo","Lumatab","Magangit","Mainit",
    "Malamodao","Manipongol","Mapaang","Masara","New Asturias",
    "New Barili","Panibasan","Panoraon","Pangi (Gaudencio Antonio)",
    "Poblacion","San Juan","San Roque","Sangab","Taglawig"
  ],
  Mawab: [
    "Andili","Bawani","Concepcion","Malinawon","Nueva Visayas",
    "Nuevo Iloco","Poblacion","Salvacion","Saosao","Sawangan","Tuboran"
  ],
  Pantukan: [
    "Araibo","Bongabong","Bongbong","Kingking (Poblacion)",
    "Las Arenas","Magnaga","Matiao","Napnapan","P. Fuentes",
    "Tag-ugpo","Tagdangua","Tambongon","Tibagon"
  ]
};

function formatLongDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    }).format(d);
  } catch {
    return "—";
  }
}

function normalizeDisease(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("dengue")) return "Dengue";
  if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) return "ILI";
  if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) return "AWD";
  return String(raw ?? "").trim();
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePlaceKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function dateKey(d) {
  // YYYY-MM-DD in local time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function Reports() {
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);
  const generatedBy = String(user?.username ?? "User").trim() || "User";
  const roleRaw = String(
    user?.role ??
      user?.Role ??
      user?.userRole ??
      user?.user_role ??
      user?.accountRole ??
      user?.account_role ??
      ""
  )
    .trim()
    .toLowerCase();

  const roleKey = useMemo(() => {
    if (!user) return "provincial";
    if (roleRaw.includes("barangay")) return "barangay";
    if (roleRaw.includes("municipal")) return "municipal";
    if (roleRaw.includes("provincial") || roleRaw.includes("province")) return "provincial";
    // fallback inference
    if (user?.barangay && String(user.barangay).trim()) return "barangay";
    if (user?.municipality && String(user.municipality).trim()) return "municipal";
    return "provincial";
  }, [user, roleRaw]);

  const lockedMunicipality = String(user?.municipality ?? "").trim();
  const lockedBarangay = String(user?.barangay ?? "").trim();

  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const defaultEnd = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 0), [today]);

  const [startDate, setStartDate] = useState(() => dateKey(defaultStart));
  const [endDate, setEndDate] = useState(() => dateKey(defaultEnd));
  const [dateMode, setDateMode] = useState("CUSTOM"); // CUSTOM | ALL
  const [reportType, setReportType] = useState("ALL"); // ALL | Dengue | ILI | AWD
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPatients([]);
    setError("");
    setLoading(false);
  }, []);

  // Initialize scope defaults based on role
  useEffect(() => {
    if (roleKey === "municipal") {
      setSelectedMunicipality(lockedMunicipality);
      setSelectedBarangay("");
    } else if (roleKey === "barangay") {
      setSelectedMunicipality(lockedMunicipality);
      setSelectedBarangay(lockedBarangay);
    } else {
      // provincial
      setSelectedMunicipality("");
      setSelectedBarangay("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey, lockedMunicipality, lockedBarangay]);

 const municipalityOptions = Object.keys(MUNICIPALITY_DATA);

  const barangayOptions = useMemo(() => {
  const selected =
    roleKey === "barangay" || roleKey === "municipal"
      ? lockedMunicipality
      : selectedMunicipality;

  if (!selected) return [];

  return MUNICIPALITY_DATA[selected] || [];
}, [selectedMunicipality, roleKey, lockedMunicipality]);

  const range = useMemo(() => {
    if (dateMode === "ALL") return null;
    const start = safeDate(startDate);
    const end = safeDate(endDate);
    if (!start || !end) return null;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (start > end) return null;
    return { start, end };
  }, [startDate, endDate, dateMode]);

  const filtered = useMemo(() => {
    if (dateMode === "CUSTOM" && !range) return [];
    const start = range?.start ?? null;
    const end = range?.end ?? null;

    return (patients ?? [])
      .map((p) => {
        const started = safeDate(p?.dateStarted);
        const fallback = safeDate(p?.createdAt || p?.created_at || p?.created);
        const d = started || fallback;

        const municipality = String(p?.municipality ?? "—").trim() || "—";
        const barangay = String(p?.barangay ?? "—").trim() || "—";

        return {
          raw: p,
          date: d,
          dateLabel: d ? formatLongDate(d) : "—",
          disease: normalizeDisease(p?.diseaseType),
          municipality,
          barangay,
          municipalityKey: normalizePlaceKey(municipality),
          barangayKey: normalizePlaceKey(barangay),
          patientName: String(p?.name ?? "—").trim() || "—",
          status: String(p?.status ?? "Recorded").trim() || "Recorded"
        };
      })
      .filter((x) => {
        if (!x.date) return false;
        if (dateMode === "ALL") return true;
        return x.date >= start && x.date <= end;
      })
      .filter((x) => (reportType === "ALL" ? true : x.disease === reportType))
      .filter((x) => {
        const municipalityScope =
          roleKey === "barangay" || roleKey === "municipal" ? lockedMunicipality : selectedMunicipality;
        const barangayScope = roleKey === "barangay" ? lockedBarangay : selectedBarangay;

        if (municipalityScope && x.municipalityKey !== normalizePlaceKey(municipalityScope)) return false;
        if (barangayScope && x.barangayKey !== normalizePlaceKey(barangayScope)) return false;
        return true;
      })
      .sort((a, b) => b.date - a.date);
  }, [
    patients,
    range,
    reportType,
    roleKey,
    lockedMunicipality,
    lockedBarangay,
    selectedMunicipality,
    selectedBarangay,
    dateMode
  ]);

  const summary = useMemo(() => {
    const counts = { total: 0, dengue: 0, ili: 0, awd: 0 };
    for (const c of filtered) {
      counts.total += 1;
      if (c.disease === "Dengue") counts.dengue += 1;
      else if (c.disease === "ILI") counts.ili += 1;
      else if (c.disease === "AWD") counts.awd += 1;
    }
    return counts;
  }, [filtered]);

  const municipalityRows = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      const key = c.municipalityKey;
      const cur = map.get(key) || { municipality: c.municipality, dengue: 0, ili: 0, awd: 0, total: 0 };
      cur.total += 1;
      if (c.disease === "Dengue") cur.dengue += 1;
      else if (c.disease === "ILI") cur.ili += 1;
      else if (c.disease === "AWD") cur.awd += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.municipality.localeCompare(b.municipality));
  }, [filtered]);

  const chartData = useMemo(() => {
    const map = new Map();

    if (dateMode === "CUSTOM" && !range) return [];

    for (const c of filtered) {
      if (!c.date) continue;
      const k = dateKey(c.date);
      const row = map.get(k) || { date: k, total: 0, Dengue: 0, ILI: 0, AWD: 0 };
      row.total += 1;
      if (c.disease === "Dengue") row.Dengue += 1;
      else if (c.disease === "ILI") row.ILI += 1;
      else if (c.disease === "AWD") row.AWD += 1;
      map.set(k, row);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered, range, dateMode]);

  const remarks = useMemo(() => {
    if (dateMode === "CUSTOM" && !range) return "Invalid date range selected.";
    if (!filtered.length) return "No cases recorded within the selected reporting period.";

    const top = municipalityRows[0];
    const hotspot = top ? `${top.municipality} (${top.total} cases)` : "—";

    // Trend: compare first half vs second half totals
    const midIdx = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, Math.max(1, midIdx)).reduce((s, r) => s + r.total, 0);
    const secondHalf = chartData.slice(Math.max(1, midIdx)).reduce((s, r) => s + r.total, 0);
    const trend =
      secondHalf > firstHalf
        ? "Cases increased toward the latter half of the period."
        : secondHalf < firstHalf
        ? "Cases decreased toward the latter half of the period."
        : "Cases remained stable across the reporting period.";

    const scope =
      reportType === "ALL" ? "Dengue, ILI, and AWD" : `${reportType} cases`;

    return `${trend} Current hotspot area: ${hotspot}. Continue intensified surveillance and timely reporting for ${scope}.`;
  }, [range, filtered.length, municipalityRows, chartData, reportType, dateMode]);

  const titleRange = useMemo(() => {
    if (dateMode === "ALL") return "All dates";
    const s = safeDate(startDate);
    const e = safeDate(endDate);
    if (!s || !e) return "—";
    return `${formatLongDate(s)} – ${formatLongDate(e)}`;
  }, [startDate, endDate, dateMode]);

  const reportTitle = reportType === "ALL" ? "Disease Surveillance Report" : `${reportType} Surveillance Report`;

  const coverageLabel = useMemo(() => {
    const municipalityScope =
      roleKey === "barangay" || roleKey === "municipal" ? lockedMunicipality : selectedMunicipality;
    const barangayScope = roleKey === "barangay" ? lockedBarangay : selectedBarangay;

    if (municipalityScope && barangayScope) return `${municipalityScope} — ${barangayScope}`;
    if (municipalityScope) return municipalityScope;
    return "Province-wide";
  }, [roleKey, lockedMunicipality, lockedBarangay, selectedMunicipality, selectedBarangay]);

  return (
    <div className="report-page">
      <div className="report-toolbar no-print">
        <div className="toolbar-left">
          <div className="toolbar-title">{reportTitle}</div>
          <div className="toolbar-subtitle">ALERTO — Davao de Oro Disease Surveillance System</div>
        </div>

        <div className="toolbar-right">
          <div className="toolbar-group">
            <button
              type="button"
              className={`toolbar-chip ${reportType === "Dengue" ? "active" : ""}`}
              onClick={() => setReportType("Dengue")}
            >
              Generate Dengue Report
            </button>
            <button
              type="button"
              className={`toolbar-chip ${reportType === "ILI" ? "active" : ""}`}
              onClick={() => setReportType("ILI")}
            >
              Generate ILI Report
            </button>
            <button
              type="button"
              className={`toolbar-chip ${reportType === "AWD" ? "active" : ""}`}
              onClick={() => setReportType("AWD")}
            >
              Generate AWD Report
            </button>
            <button
              type="button"
              className={`toolbar-chip ${reportType === "ALL" ? "active" : ""}`}
              onClick={() => setReportType("ALL")}
            >
              All Diseases
            </button>
          </div>

          <div className="toolbar-scope">
            <label className="toolbar-field">
              <span>Municipality</span>
              <select
                value={roleKey === "municipal" || roleKey === "barangay" ? lockedMunicipality : selectedMunicipality}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedMunicipality(v);
                  setSelectedBarangay("");
                }}
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

            <label className="toolbar-field">
              <span>Barangay</span>
              <select
                value={roleKey === "barangay" ? lockedBarangay : selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                disabled={roleKey === "barangay" || (!selectedMunicipality && roleKey === "provincial")}
              >
                <option value="">
                  {roleKey === "barangay"
                    ? lockedBarangay || "—"
                    : roleKey === "provincial" && !selectedMunicipality
                    ? "Select municipality first"
                    : "All Barangays"}
                </option>
                {(roleKey === "barangay" ? [] : barangayOptions).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="toolbar-dates">
            <label className="toolbar-field">
              <span>Date Mode</span>
              <select value={dateMode} onChange={(e) => setDateMode(e.target.value)}>
                <option value="CUSTOM">Custom Range</option>
                <option value="ALL">All Dates</option>
              </select>
            </label>

            <label className="toolbar-field">
              <span>From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={dateMode === "ALL"}
              />
            </label>

            <label className="toolbar-field">
              <span>To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={dateMode === "ALL"}
              />
            </label>
          </div>

          <button type="button" className="toolbar-btn" onClick={() => window.print()}>
            Export to PDF
          </button>
        </div>
      </div>

      <div className="report-sheet">
        <header className="report-header">
          <div className="header-block">
            <div className="report-title">Province of Davao de Oro</div>
            <div className="report-subtitle">{reportTitle}</div>
          </div>

          <div className="header-meta">
            <div className="meta-row">
              <div className="meta-label">Date range</div>
              <div className="meta-value">{titleRange}</div>
            </div>
            <div className="meta-row">
              <div className="meta-label">Coverage</div>
              <div className="meta-value">{coverageLabel}</div>
            </div>
            <div className="meta-row">
              <div className="meta-label">Generated by</div>
              <div className="meta-value">{generatedBy}</div>
            </div>
            <div className="meta-row">
              <div className="meta-label">Generated on</div>
              <div className="meta-value">{formatLongDate(new Date())}</div>
            </div>
          </div>
        </header>

        <section className="report-section">
          <div className="section-title">Summary</div>
          <div className="summary-grid">
            <div className="summary-card">
              <div className="kpi-label">Total Cases</div>
              <div className="kpi-value">{summary.total}</div>
            </div>
            <div className="summary-card">
              <div className="kpi-label">Dengue Cases</div>
              <div className="kpi-value">{summary.dengue}</div>
            </div>
            <div className="summary-card">
              <div className="kpi-label">ILI Cases</div>
              <div className="kpi-value">{summary.ili}</div>
            </div>
            <div className="summary-card">
              <div className="kpi-label">AWD Cases</div>
              <div className="kpi-value">{summary.awd}</div>
            </div>
          </div>
        </section>

        <section className="report-section">
          <div className="section-title">Cases Over Time</div>
          <div className="chart-wrap" aria-label="Cases over time chart">
            {range && chartData.length ? (
              <div className="sparkbar" role="img" aria-label="Bar chart of daily totals">
                {chartData.map((r) => (
                  <div key={r.date} className="bar-col" title={`${r.date}: ${r.total}`}>
                    <div className="bar" style={{ height: `${Math.min(100, r.total * 12)}%` }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">
                {loading ? "Loading…" : error ? error : "Select a valid date range to display chart."}
              </div>
            )}
          </div>
          <div className="chart-legend">
            <span className="legend-dot" /> Daily total cases (scaled)
          </div>
        </section>

        <section className="report-section">
          <div className="section-title">Municipality Breakdown</div>
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Municipality</th>
                  <th className="num">Dengue</th>
                  <th className="num">ILI</th>
                  <th className="num">AWD</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {municipalityRows.length ? (
                  municipalityRows.map((r) => (
                    <tr key={r.municipality}>
                      <td>{r.municipality}</td>
                      <td className="num">{r.dengue}</td>
                      <td className="num">{r.ili}</td>
                      <td className="num">{r.awd}</td>
                      <td className="num strong">{r.total}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="muted center">
                      {loading ? "Loading…" : error ? error : "No municipality data for selected period."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section">
          <div className="section-title">Detailed Case Table</div>
          <div className="table-wrap">
            <table className="report-table dense">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient Name</th>
                  <th>Disease</th>
                  <th>Municipality</th>
                  <th>Barangay</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.slice(0, 50).map((c, idx) => (
                    <tr key={`${c.patientName}-${idx}`}>
                      <td>{c.dateLabel}</td>
                      <td>{c.patientName}</td>
                      <td>{c.disease || "—"}</td>
                      <td>{c.municipality}</td>
                      <td>{c.barangay}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="muted center">
                      {loading ? "Loading…" : error ? error : "No cases recorded for selected period."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <div className="muted footnote">
                Showing first 50 records for print clarity. Narrow the date range to include fewer records.
              </div>
            )}
          </div>
        </section>

        <section className="report-section">
          <div className="section-title">Remarks</div>
          <div className="remarks-box">{remarks}</div>
        </section>

        <section className="report-section signature-section">
          <div className="signature-grid">
            <div className="sig">
              <div className="sig-line" />
              <div className="sig-label">Prepared by</div>
            </div>
            <div className="sig">
              <div className="sig-line" />
              <div className="sig-label">Approved by</div>
            </div>
            <div className="sig">
              <div className="sig-line" />
              <div className="sig-label">Date</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Reports;