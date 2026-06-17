import { resolveMunicipalityKey } from "../../src/data/davaoDeOroGeography.js";
import { ILI_BARANGAY_ALIASES, normKey } from "./ili-barangay-aliases.mjs";

export function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\(pob\)|\(poblacion\)/g, " poblacion ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excelToDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const n = Number(value);
  if (Number.isFinite(n) && n > 20000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export function mapSex(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "M" || s === "MALE") return "Male";
  if (s === "F" || s === "FEMALE") return "Female";
  return s ? String(raw).trim() : null;
}

export function mapCaseClassification(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "confirmed") return "Confirmed";
  if (s === "suspect") return "Suspect";
  if (s === "probable") return "Probable";
  return "Suspect";
}

export function mapCaseStatus(outcome) {
  const s = String(outcome ?? "").trim().toLowerCase();
  if (s === "died" || s === "dead" || s === "d") return "closed";
  return "active";
}

export function formatAge(years) {
  if (years == null || years === "") return null;
  const n = Number(years);
  if (!Number.isFinite(n)) return String(years).slice(0, 10);
  if (n < 1) return String(Math.round(n * 12)) + " mo";
  return String(Math.round(n * 10) / 10);
}

export async function loadGeographyIndex(pool) {
  const [rows] = await pool.query(
    `SELECT b.id AS barangayId, b.name AS barangayName,
            m.id AS municipalityId, m.name AS municipalityName
     FROM barangays b
     JOIN municipalities m ON m.id = b.municipality_id
     JOIN provinces p ON p.id = m.province_id
     WHERE p.name = 'Davao de Oro'`
  );

  const byKey = new Map();
  const byMuni = new Map();

  for (const row of rows) {
    const mKey = norm(row.municipalityName);
    const bKey = norm(row.barangayName);
    byKey.set(`${mKey}|${bKey}`, row);
    if (!byMuni.has(mKey)) byMuni.set(mKey, []);
    byMuni.get(mKey).push(row);
  }

  return { byKey, byMuni };
}

function resolveBarangayName(municipalityName, rawBarangay) {
  let barangay = String(rawBarangay ?? "").trim();
  if (!barangay) barangay = "Poblacion";

  const aliasKey = normKey(municipalityName, barangay);
  if (ILI_BARANGAY_ALIASES[aliasKey]) {
    return ILI_BARANGAY_ALIASES[aliasKey];
  }

  return barangay
    .replace(/\s+/g, " ")
    .replace(/\(POB\.?\)/gi, "(Poblacion)")
    .replace(/^POBLACION$/i, "Poblacion")
    .trim();
}

export function findBarangayRow(municipalityName, rawBarangay, geo) {
  const muniKey = resolveMunicipalityKey(municipalityName);
  const mNorm = norm(muniKey);
  const resolvedName = resolveBarangayName(muniKey, rawBarangay);
  const bNorm = norm(resolvedName);

  const direct = geo.byKey.get(`${mNorm}|${bNorm}`);
  if (direct) return direct;

  const candidates = geo.byMuni.get(mNorm) ?? [];
  const exact = candidates.find((c) => norm(c.barangayName) === bNorm);
  if (exact) return exact;

  const contains = candidates.find(
    (c) => norm(c.barangayName).includes(bNorm) || bNorm.includes(norm(c.barangayName))
  );
  if (contains) return contains;

  const poblacion = candidates.find((c) => /poblacion/i.test(c.barangayName));
  return poblacion ?? null;
}

export async function insertPatients(pool, patients, { replacePrefix } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (replacePrefix) {
      const [del] = await conn.query(
        `DELETE FROM patients WHERE patient_number LIKE ?`,
        [`${replacePrefix}%`]
      );
      console.log(`Removed prior import rows: ${del.affectedRows ?? 0}`);
    }

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < patients.length; i += batchSize) {
      const batch = patients.slice(i, i + batchSize);
      const values = batch.map((p) => [
        p.name,
        p.patient_number,
        p.age,
        p.sex,
        p.birthdate,
        p.civil_status,
        p.province,
        p.municipality_id,
        p.barangay_id,
        p.purok,
        p.birthplace,
        p.disease_type,
        p.case_classification,
        p.case_status,
        p.date_started,
        p.created_at
      ]);

      await conn.query(
        `INSERT INTO patients (
          name, patient_number, age, sex, birthdate, civil_status, province,
          municipality_id, barangay_id, purok, birthplace,
          disease_type, case_classification, case_status, date_started, created_at
        ) VALUES ?`,
        [values]
      );
      inserted += batch.length;
    }

    await conn.commit();
    return inserted;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function logSkipReasons(skipped, label = "import") {
  if (!skipped.length) return;
  const counts = new Map();
  for (const s of skipped) counts.set(s, (counts.get(s) ?? 0) + 1);
  console.log(`[${label}] Skip reasons (top 10):`);
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`  ${v}× ${k}`));
}
