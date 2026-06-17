/** @param {object} patient */
export function isConfirmedCase(patient) {
  return String(patient?.caseClassification ?? "")
    .trim()
    .toLowerCase() === "confirmed";
}

export function normalizeDisease(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("awd") || (v.includes("acute") && v.includes("watery") && v.includes("diarr"))) {
    return "AWD";
  }
  if (v.includes("ili") || (v.includes("influenza") && v.includes("like"))) {
    return "ILI";
  }
  if (v.includes("dengue")) {
    return "DENGUE";
  }
  return v.toUpperCase();
}

export function parseCaseDate(patient) {
  const raw =
    patient?.dateStarted ??
    patient?.dateReported ??
    patient?.reportDate ??
    patient?.createdAt ??
    patient?.date;
  if (raw == null || raw === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
