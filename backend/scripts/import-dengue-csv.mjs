/**
 * Import Davao de Oro dengue surveillance rows from CSV into patients table.
 *
 * Usage (from repo root):
 *   node backend/scripts/import-dengue-csv.mjs
 *   node backend/scripts/import-dengue-csv.mjs --file "C:\path\to\DAVAO DE ORO DENGUE DATA.csv"
 *   node backend/scripts/import-dengue-csv.mjs --dry-run
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import {
  excelToDate,
  findBarangayRow,
  formatAge,
  insertPatients,
  loadGeographyIndex,
  logSkipReasons,
  mapCaseClassification,
  mapCaseStatus,
  mapSex
} from "./import-surveillance-utils.mjs";

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

const IMPORT_PREFIX = "DEN-";
const DISEASE_LABEL = "Dengue";
const DEFAULT_FILE = path.join(
  __dirname,
  "../../database/imports/DAVAO DE ORO DENGUE DATA.csv"
);

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

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    defval: ""
  });
}

function dedupeCases(rows) {
  const byCaseId = new Map();
  for (const row of rows) {
    const caseId = String(row["CASE ID"] ?? "").trim();
    if (!caseId) continue;
    if (!byCaseId.has(caseId)) {
      byCaseId.set(caseId, row);
      continue;
    }
    const existing = byCaseId.get(caseId);
    const existingClass = String(existing["Case Classification"] ?? "").toLowerCase();
    const nextClass = String(row["Case Classification"] ?? "").toLowerCase();
    if (existingClass !== "confirmed" && nextClass === "confirmed") {
      byCaseId.set(caseId, row);
    }
  }
  return [...byCaseId.values()];
}

function rowToPatient(row, geo) {
  const province = String(row["(Current Address) Province"] ?? "").trim();
  if (!/davao de oro/i.test(province)) {
    return { error: "outside Davao de Oro province" };
  }

  const municipalityName = String(
    row["(Current Address) City / Municipality"] ?? ""
  ).trim();
  if (!municipalityName) return { error: "missing municipality" };

  const barangayName = String(row["(Current Address) Barangay"] ?? "").trim();
  const brgyRow = findBarangayRow(municipalityName, barangayName, geo);
  if (!brgyRow) {
    return {
      error: `unmapped barangay: ${municipalityName} / ${barangayName || "(empty)"}`
    };
  }

  const caseId = String(row["CASE ID"] ?? "").trim();
  const epiId = String(row.EPIID ?? "").trim();
  const patientNumber = `${IMPORT_PREFIX}${caseId || epiId}`.slice(0, 40);

  const dateStarted =
    excelToDate(row.DOnset) ??
    excelToDate(row["Date Consulted"]) ??
    excelToDate(row.DAdmit);
  const birthdate = excelToDate(row.DOB);
  const createdAt =
    excelToDate(row.timestamp_patient) ??
    excelToDate(row.lastmodifieddate) ??
    dateStarted ??
    "2025-01-01";

  return {
    name: `Dengue Case ${caseId || patientNumber.replace(IMPORT_PREFIX, "")}`,
    patient_number: patientNumber,
    age: formatAge(row.AgeYears),
    sex: mapSex(row.Sex),
    birthdate,
    civil_status: null,
    province: "Davao de Oro",
    municipality_id: brgyRow.municipalityId,
    barangay_id: brgyRow.barangayId,
    purok:
      String(row["(Current Address) Sitio / Purok / Street Name"] ?? "")
        .trim()
        .slice(0, 100) || null,
    birthplace: municipalityName.slice(0, 200),
    disease_type: DISEASE_LABEL,
    case_classification: mapCaseClassification(row["Case Classification"]),
    case_status: mapCaseStatus(row.outcome),
    date_started: dateStarted,
    created_at: `${createdAt} 12:00:00`
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`[Dengue import] Reading ${opts.file}`);

  const rawRows = readRows(opts.file);
  const rows = dedupeCases(rawRows);
  console.log(
    `[Dengue import] Raw rows: ${rawRows.length}, unique cases: ${rows.length}`
  );

  const geo = await loadGeographyIndex(pool);
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

  console.log(
    `[Dengue import] Ready to insert: ${toInsert.length}, skipped: ${skipped.length}`
  );
  logSkipReasons(skipped, "Dengue import");

  if (opts.dryRun) {
    console.log("[Dengue import] Dry run — no database changes.");
    await pool.end();
    return;
  }

  try {
    const inserted = await insertPatients(pool, toInsert, {
      replacePrefix: opts.replace ? IMPORT_PREFIX : null
    });
    console.log(`[Dengue import] Inserted ${inserted} dengue case records.`);
  } catch (err) {
    console.error("[Dengue import] Failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
