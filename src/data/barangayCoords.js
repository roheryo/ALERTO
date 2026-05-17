/**
 * Barangay coordinates for municipal map (mirrors backend/services/weatherCoords.js).
 */

export const MUNICIPALITY_COORDS = {
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

export const BARANGAY_COORDS = {
  "compostela|aurora": { lat: 7.7012, lon: 126.1024 },
  "compostela|poblacion": { lat: 7.6731, lon: 126.0886 },
  "nabunturan|poblacion": { lat: 7.6075, lon: 125.9667 },
  "monkayo|poblacion": { lat: 7.8175, lon: 126.0503 },
  "maco|poblacion": { lat: 7.3619, lon: 125.8553 },
  "maragusan|maragusan (poblacion)": { lat: 7.3853, lon: 126.1069 },
  "mawab|poblacion": { lat: 7.5592, lon: 125.9928 },
  "montevista|poblacion": { lat: 7.695, lon: 125.9869 },
  "pantukan|poblacion": { lat: 7.1242, lon: 126.0078 },
  "new bataan|poblacion": { lat: 7.5325, lon: 126.1428 },
  "laak|poblacion": { lat: 7.9703, lon: 125.9994 },
  "mabini|poblacion": { lat: 7.3122, lon: 125.8533 }
};

function normalizePlaceName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function barangayCoordKey(municipality, barangay) {
  return `${normalizePlaceName(municipality)}|${normalizePlaceName(barangay)}`;
}

function estimatedBarangayOffset(municipality, barangay) {
  const seed = `${normalizePlaceName(municipality)}|${normalizePlaceName(barangay)}`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(h) % 360) * Math.PI) / 180;
  const radius = 0.018 + (Math.abs(h >> 8) % 12) * 0.002;
  return {
    dLat: radius * Math.cos(angle),
    dLon: radius * Math.sin(angle)
  };
}

/** @returns {{ lat: number, lon: number } | null} */
export function resolveBarangayCoords(municipality, barangay) {
  const muniKey = normalizePlaceName(municipality);
  const muni = MUNICIPALITY_COORDS[muniKey];
  if (!muni) return null;

  const brgyLabel = String(barangay ?? "").trim();
  if (!brgyLabel) return { lat: muni.lat, lon: muni.lon };

  const explicit = BARANGAY_COORDS[barangayCoordKey(municipality, brgyLabel)];
  if (explicit) return { lat: explicit.lat, lon: explicit.lon };

  const { dLat, dLon } = estimatedBarangayOffset(municipality, brgyLabel);
  return { lat: muni.lat + dLat, lon: muni.lon + dLon };
}
