/**
 * Import ILI 2023 surveillance rows from Excel into patients table.
 *
 * Usage (from repo root):
 *   node backend/scripts/import-ili-2023.mjs
 *   node backend/scripts/import-ili-2023.mjs --file "C:\path\to\ILI.xlsx-2023.xlsx"
 *   node backend/scripts/import-ili-2023.mjs --dry-run
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { resolveMunicipalityKey } from "../../src/data/davaoDeOroGeography.js";
import { ILI_BARANGAY_ALIASES, normKey } from "./ili-barangay-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../../package.json"));
const XLSX = require("xlsx");

dotenv.config({ path: path.join(__dirname, "../.env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "ALERTO",
  waitForConnections: true,
  connectionLimit: 5
});

const IMPORT_PREFIX = "ILI23-";
const DISEASE_LABEL = "Influenza-like illness (ILI)";
const DEFAULT_FILE = path.join(__dirname, "../../database/imports/ILI-2023.xlsx");

function parseArgs(argv) {
  const opts = { file: DEFAULT_FILE, dryRun: false, replace: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") opts.dryRun = true;
    else if (argv[i] === "--no-replace") opts.replace = false;
    else if (argv[i] === "--file" && argv[i + 1]) {
      opts.file = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return opts;
}

function norm(s) {
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

function excelToDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const n = Number(value);
  if (Number.isFinite(n) && n > 20000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function mapSex(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "M") return "Male";
  if (s === "F") return "Female";
  return s || null;
}

function mapCaseClassification(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "confirmed") return "Confirmed";
  if (s === "suspect") return "Suspect";
  if (s === "probable") return "Probable";
  return "Suspect";
}

function mapCaseStatus(outcome) {
  return String(outcome ?? "").trim().toUpperCase() === "D" ? "closed" : "active";
}

function formatAge(years) {
  if (years == null || years === "") return null;
  const n = Number(years);
  if (!Number.isFinite(n)) return String(years).slice(0, 10);
  if (n < 1) return String(Math.round(n * 12)) + " mo";
  return String(Math.round(n * 10) / 10);
}

async function loadGeographyIndex() {
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

function findBarangayRow(municipalityName, rawBarangay, geo) {
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

function rowToPatient(row, geo) {
  const municipalityName = String(row.Muncity ?? row.MuncityOfDRU ?? "").trim();
  if (!municipalityName) return { error: "missing municipality" };

  const brgyRow = findBarangayRow(municipalityName, row.Barangay, geo);
  if (!brgyRow) {
    return {
      error: `unmapped barangay: ${municipalityName} / ${row.Barangay || "(empty)"}`
    };
  }

  const uniqueKey = String(row.UniqueKey ?? row.EPIID ?? "").trim();
  const patientNumber = uniqueKey
    ? `${IMPORT_PREFIX}${uniqueKey}`
    : `${IMPORT_PREFIX}${String(row.EPIID ?? "").slice(0, 32)}`;

  const dateStarted = excelToDate(row.DOnset) ?? excelToDate(row.DateOfEntry);
  const birthdate = excelToDate(row.DOB);
  const entryDate = excelToDate(row.DateOfEntry);
  const createdAt = entryDate ?? dateStarted ?? "2023-06-15";

  return {
    name: `ILI 2023 Case ${uniqueKey || patientNumber.replace(IMPORT_PREFIX, "")}`,
    patient_number: patientNumber.slice(0, 40),
    age: formatAge(row.AgeYears),
    sex: mapSex(row.Sex),
    birthdate,
    civil_status: null,
    province: "Davao de Oro",
    municipality_id: brgyRow.municipalityId,
    barangay_id: brgyRow.barangayId,
    purok: String(row.Streetpurok ?? "").trim().slice(0, 100) || null,
    birthplace: String(row.Muncity ?? "").trim().slice(0, 200) || null,
    disease_type: DISEASE_LABEL,
    case_classification: mapCaseClassification(row.CASECLASS),
    case_status: mapCaseStatus(row.Outcome),
    date_started: dateStarted,
    created_at: `${createdAt} 12:00:00`
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`[ILI import] Reading ${opts.file}`);

  const workbook = XLSX.readFile(opts.file);
  const sheet = workbook.Sheets.ILI ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`[ILI import] Rows in sheet: ${rows.length}`);

  const geo = await loadGeographyIndex();
  const toInsert = [];
  const skipped = [];

  for (const row of rows) {
    const mapped = rowToPatient(row, geo);
    if (mapped.error) {
      skipped.push(mapped.error);
      continue;
    }
    toInsert.push(mapped);
  }

  console.log(`[ILI import] Ready to insert: ${toInsert.length}, skipped: ${skipped.length}`);
  if (skipped.length) {
    const counts = new Map();
    for (const s of skipped) counts.set(s, (counts.get(s) ?? 0) + 1);
    console.log("[ILI import] Skip reasons (top 10):");
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([k, v]) => console.log(`  ${v}× ${k}`));
  }

  if (opts.dryRun) {
    console.log("[ILI import] Dry run — no database changes.");
    await pool.end();
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (opts.replace) {
      const [del] = await conn.query(
        `DELETE FROM patients WHERE patient_number LIKE ?`,
        [`${IMPORT_PREFIX}%`]
      );
      console.log(`[ILI import] Removed prior import rows: ${del.affectedRows ?? 0}`);
    }

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
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
    console.log(`[ILI import] Inserted ${inserted} ILI 2023 case records.`);
  } catch (err) {
    await conn.rollback();
    console.error("[ILI import] Failed:", err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
