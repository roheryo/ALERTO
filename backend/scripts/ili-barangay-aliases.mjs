/**
 * Excel barangay labels → canonical names in database/migrations geography seed.
 * Keys: "municipality|barangay" (normalized via normKey).
 */
export const ILI_BARANGAY_ALIASES = {
  "laak|laac": "Laak (Poblacion)",
  "laak|poblacion": "Laak (Poblacion)",
  "mabini|tagnanan (mampising)": "Tagnanan (Mabini)",
  "mabini|mampising": "Tagnanan (Mabini)",
  "mabini|golden valley": "Golden Valley (Maraut)",
  "new bataan|cabinuangan": "Cabinuangan (Poblacion)",
  "montevista|san jose (pob.)": "San Jose",
  "montevista|san jose (pob)": "San Jose",
  "maragusan|maragusan": "Maragusan (Poblacion)",
  "maragusan|maragusan (pob.)": "Maragusan (Poblacion)",
  "maragusan|new man-ay": "New Manay",
  "maco|elizalde": "Elizalde (Somil)",
  "monkayo|pasian (santa filomena)": "Pasian",
  "monkayo|tubo-tubo (new del monte)": "Tubo-tubo",
  "laak|santo nino": "Santo Niño",
  "compostela|poblacion": "Poblacion",
  "nabunturan|poblacion": "Poblacion",
  "mawab|poblacion": "Poblacion",
  "pantukan|kingking (poblacion)": "Kingking (Poblacion)",
  "pantukan|p. fuentes": "P. Fuentes",
  "mawab|nuevo iloco": "Nuevo Iloco",
  "maragusan|maragusan (pob.)": "Maragusan (Poblacion)"
};

export function normKey(municipality, barangay) {
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\(pob\)|\(poblacion\)/g, " poblacion ")
      .replace(/\s+/g, " ")
      .trim();
  return `${norm(municipality)}|${norm(barangay)}`;
}
