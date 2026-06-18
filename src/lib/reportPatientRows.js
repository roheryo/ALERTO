const CHUNK_SIZE = 500;

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

export function buildPreparedRow(p) {
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
}

function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 48 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

/** Build normalized report rows without blocking the UI thread for long lists. */
export async function buildReportPreparedRows(patients) {
  const source = Array.isArray(patients) ? patients : [];
  const rows = [];
  for (let i = 0; i < source.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, source.length);
    for (let j = i; j < end; j += 1) {
      const row = buildPreparedRow(source[j]);
      if (row.date) rows.push(row);
    }
    if (end < source.length) {
      await yieldToMain();
    }
  }
  return rows;
}
