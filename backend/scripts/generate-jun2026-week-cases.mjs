/**
 * Generate exactly 500 confirmed/suspect/probable cases per disease (1,500 total)
 * for the reporting week June 10–17, 2026 across Davao de Oro barangays.
 *
 * Matches ALERTO patient + case_environmental schema and BHU form conventions.
 *
 * Usage (from repo root):
 *   npm run seed:jun2026-week --prefix backend
 *   npm run seed:jun2026-week:dry --prefix backend
 *   node backend/scripts/generate-jun2026-week-cases.mjs --purge
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const WEEK_START = "2026-06-10";
const WEEK_END = "2026-06-17";
const TARGET_PER_DISEASE = 500;
const IMPORT_PREFIX = "JUN26-";
const BATCH_SIZE = 200;

const DISEASES = [
  { code: "DENGUE", label: "Dengue" },
  { code: "ILI", label: "Influenza-like illness (ILI)" },
  { code: "AWD", label: "Acute Watery Diarrhea" }
];

const FIRST_NAMES_M = [
  "Juan", "Pedro", "Jose", "Mark", "Carlo", "Allan", "Reynaldo", "Edgar",
  "Rolando", "Arnel", "Joseph", "Miguel", "Ramon", "Cesar", "Bryan",
  "Joel", "Romeo", "Ariel", "Dante", "Lito", "Renato", "Nestor"
];
const FIRST_NAMES_F = [
  "Maria", "Rosa", "Anna", "Cristina", "Liza", "Mae", "Joy", "Grace",
  "Lorna", "Imelda", "Marites", "Aileen", "Catherine", "Hazel", "Janet",
  "Ruby", "Sheila", "Trisha", "Carmen", "Daisy", "Evelyn", "Annaliza"
];
const SURNAMES = [
  "Dela Cruz", "Reyes", "Santos", "Cruz", "Garcia", "Mendoza", "Torres",
  "Aquino", "Castillo", "Ramos", "Flores", "Rivera", "Gonzales", "Lim",
  "Bautista", "Villanueva", "Domingo", "Castro", "Pascual", "Sarmiento"
];
const CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated"];
const PUROKS = [
  "Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5", "Purok 6",
  "Purok 7", "Purok 8", "P-1", "P-2", "P-3", "PUROK 10", "Sitio Malinawon"
];
const CASE_CLASS = [
  ["Confirmed", 0.52],
  ["Suspect", 0.33],
  ["Probable", 0.15]
];

const WATER_BY_DISEASE = {
  DENGUE: [["piped", 0.55], ["shared", 0.27], ["unimproved", 0.13], ["none", 0.05]],
  ILI: [["piped", 0.58], ["shared", 0.25], ["unimproved", 0.12], ["none", 0.05]],
  AWD: [["piped", 0.25], ["shared", 0.30], ["unimproved", 0.30], ["none", 0.15]]
};
const SANITATION_BY_DISEASE = {
  DENGUE: [["flush", 0.55], ["pit", 0.30], ["open", 0.08], ["none", 0.07]],
  ILI: [["flush", 0.55], ["pit", 0.30], ["open", 0.08], ["none", 0.07]],
  AWD: [["flush", 0.32], ["pit", 0.40], ["open", 0.20], ["none", 0.08]]
};

function parseArgs(argv) {
  const opts = { dryRun: false, purge: false, seed: 20260610 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") opts.dryRun = true;
    else if (argv[i] === "--purge") opts.purge = true;
    else if (argv[i] === "--seed" && argv[i + 1]) {
      opts.seed = Number(argv[i + 1]) >>> 0;
      i += 1;
    }
  }
  return opts;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function normal(rng, mu = 0, sigma = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function bernoulli(rng, p) {
  return rng() < clamp(p, 0, 1) ? 1 : 0;
}

function categorical(rng, choices) {
  const total = choices.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [v, w] of choices) {
    r -= w;
    if (r <= 0) return v;
  }
  return choices[choices.length - 1][0];
}

function parseYmd(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function ymd(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function randomDateInWeek(rng) {
  const start = parseYmd(WEEK_START);
  const end = parseYmd(WEEK_END);
  const span = Math.round((end - start) / 86400000);
  return ymd(addDays(start, randInt(rng, 0, span)));
}

function birthdateFromAge(ageYears, onsetYmd) {
  const onset = parseYmd(onsetYmd);
  if (!onset || !Number.isFinite(ageYears)) return null;
  const d = new Date(onset);
  d.setUTCFullYear(d.getUTCFullYear() - Math.floor(ageYears));
  d.setUTCMonth(d.getUTCMonth() - Math.round((ageYears % 1) * 12));
  return ymd(d);
}

function sampleAge(rng, diseaseCode) {
  let age;
  if (diseaseCode === "DENGUE") age = Math.round(normal(rng, 22, 12));
  else if (diseaseCode === "ILI") age = Math.round(normal(rng, 24, 18));
  else age = Math.round(normal(rng, 15, 16));
  return clamp(age, 0, 92);
}

function samplePatient(rng, diseaseCode) {
  const sex = rng() < 0.51 ? "Female" : "Male";
  const first =
    sex === "Female"
      ? FIRST_NAMES_F[randInt(rng, 0, FIRST_NAMES_F.length - 1)]
      : FIRST_NAMES_M[randInt(rng, 0, FIRST_NAMES_M.length - 1)];
  const last = SURNAMES[randInt(rng, 0, SURNAMES.length - 1)];
  const age = sampleAge(rng, diseaseCode);
  const civilStatus =
    age >= 18 ? CIVIL_STATUS[randInt(rng, 0, CIVIL_STATUS.length - 1)] : "Single";
  return { fullName: `${first} ${last}`, age, sex, civilStatus };
}

function sampleEnvironment(rng, diseaseCode) {
  const rainBoost = rng();
  let pStagnant;
  let pRecentRain;
  let pCrowding;
  if (diseaseCode === "DENGUE") {
    pStagnant = 0.55 + 0.2 * rainBoost;
    pRecentRain = 0.45 + 0.35 * rainBoost;
    pCrowding = 0.18;
  } else if (diseaseCode === "ILI") {
    pStagnant = 0.15 + 0.05 * rainBoost;
    pRecentRain = 0.4 + 0.3 * rainBoost;
    pCrowding = 0.62;
  } else {
    pStagnant = 0.3 + 0.15 * rainBoost;
    pRecentRain = 0.55 + 0.3 * rainBoost;
    pCrowding = 0.28;
  }
  return {
    stagnant_water: bernoulli(rng, pStagnant),
    recent_heavy_rain: bernoulli(rng, pRecentRain),
    indoor_crowding: bernoulli(rng, pCrowding),
    wash_water_source: categorical(rng, WATER_BY_DISEASE[diseaseCode]),
    wash_sanitation: categorical(rng, SANITATION_BY_DISEASE[diseaseCode]),
    flood_history_4wk: bernoulli(rng, 0.12 + 0.35 * rainBoost),
    drought_water_shortage: bernoulli(rng, 0.06),
    exposure_notes: null
  };
}

function allocateExact(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remaining; k += 1) floors[order[k].i] += 1;
  return floors;
}

async function loadGeography() {
  const [muniRows] = await pool.query(
    `SELECT m.id, m.name
     FROM municipalities m
     JOIN provinces p ON p.id = m.province_id
     WHERE p.name = 'Davao de Oro'
     ORDER BY m.id`
  );
  const [bgys] = await pool.query(
    `SELECT b.id, b.municipality_id AS municipalityId, b.name, m.name AS municipalityName
     FROM barangays b
     JOIN municipalities m ON m.id = b.municipality_id
     JOIN provinces p ON p.id = m.province_id
     WHERE p.name = 'Davao de Oro'
     ORDER BY b.municipality_id, b.id`
  );
  const munis = muniRows.map((m) => ({
    ...m,
    barangays: bgys.filter((b) => b.municipalityId === m.id)
  }));
  return { munis, barangays: bgys };
}

async function loadBhuUsers() {
  const [rows] = await pool.query(
    `SELECT id, role, municipality_id AS municipalityId, barangay_id AS barangayId
     FROM users
     WHERE is_active = 1 AND role IN ('barangay', 'municipality')`
  );
  const byBarangay = new Map();
  const byMunicipality = new Map();
  for (const r of rows) {
    if (r.role === "barangay" && r.barangayId) byBarangay.set(r.barangayId, r.id);
    if (r.role === "municipality" && r.municipalityId && !byMunicipality.has(r.municipalityId)) {
      byMunicipality.set(r.municipalityId, r.id);
    }
  }
  return { byBarangay, byMunicipality };
}

function buildPlan(barangays, rng) {
  const weights = barangays.map(() => 0.6 + rng() * 0.8);
  const counts = allocateExact(TARGET_PER_DISEASE, weights);
  const buckets = [];
  for (let i = 0; i < barangays.length; i += 1) {
    if (!counts[i]) continue;
    buckets.push({ barangay: barangays[i], count: counts[i] });
  }
  return buckets;
}

async function purgePrior() {
  const [r] = await pool.query(`DELETE FROM patients WHERE patient_number LIKE ?`, [
    `${IMPORT_PREFIX}%`
  ]);
  return r.affectedRows ?? 0;
}

async function insertPatientBatch(rows) {
  if (!rows.length) return { firstId: null, affected: 0 };
  const placeholders = rows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
  const params = [];
  for (const r of rows) {
    params.push(
      r.name,
      r.patient_number,
      String(r.age),
      r.sex,
      r.birthdate,
      r.civil_status,
      "Davao de Oro",
      r.municipality_id,
      r.barangay_id,
      r.purok,
      r.birthplace,
      r.disease_type,
      r.case_classification,
      r.case_status,
      r.date_started,
      r.created_by,
      r.created_at
    );
  }
  const [res] = await pool.query(
    `INSERT INTO patients (
       name, patient_number, age, sex, birthdate, civil_status, province,
       municipality_id, barangay_id, purok, birthplace, disease_type,
       case_classification, case_status, date_started, created_by, created_at
     ) VALUES ${placeholders}`,
    params
  );
  return { firstId: res.insertId, affected: res.affectedRows ?? rows.length };
}

async function insertEnvironmentBatch(envRows) {
  if (!envRows.length) return 0;
  const placeholders = envRows.map(() => "(?,?,?,?,?,?,?,?,?)").join(",");
  const params = [];
  for (const r of envRows) {
    params.push(
      r.patient_id,
      r.stagnant_water,
      r.recent_heavy_rain,
      r.indoor_crowding,
      r.wash_water_source,
      r.wash_sanitation,
      r.flood_history_4wk,
      r.drought_water_shortage,
      r.exposure_notes
    );
  }
  const [res] = await pool.query(
    `INSERT INTO case_environmental (
       patient_id, stagnant_water, recent_heavy_rain, indoor_crowding,
       wash_water_source, wash_sanitation, flood_history_4wk,
       drought_water_shortage, exposure_notes
     ) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE patient_id = patient_id`,
    params
  );
  return res.affectedRows ?? 0;
}

async function main() {
  const opts = parseArgs(process.argv);
  const rng = mulberry32(opts.seed);

  console.log(
    `[jun2026] Planning ${TARGET_PER_DISEASE} cases/disease (${TARGET_PER_DISEASE * 3} total)`
  );
  console.log(`[jun2026] Reporting week: ${WEEK_START} to ${WEEK_END}`);

  const { munis, barangays } = await loadGeography();
  if (!barangays.length) {
    console.error("[jun2026] No barangays found. Run database migrations first.");
    process.exit(1);
  }
  console.log(`[jun2026] Geography: ${munis.length} municipalities, ${barangays.length} barangays`);

  const users = await loadBhuUsers();
  if (!users.byBarangay.size && !users.byMunicipality.size) {
    console.error("[jun2026] No BHU users found. Run migration 03_seed_users.sql first.");
    process.exit(1);
  }

  const planByDisease = {};
  for (const d of DISEASES) {
    planByDisease[d.code] = buildPlan(barangays, rng);
    const total = planByDisease[d.code].reduce((acc, b) => acc + b.count, 0);
    console.log(`[jun2026]   ${d.code}: ${total} cases across ${planByDisease[d.code].length} barangays`);
  }

  if (opts.dryRun) {
    console.log("[jun2026] Dry run — no database changes.");
    process.exit(0);
  }

  if (opts.purge) {
    const removed = await purgePrior();
    console.log(`[jun2026] Purged ${removed} prior ${IMPORT_PREFIX}* rows`);
  }

  const seq = { DENGUE: 0, ILI: 0, AWD: 0 };
  let inserted = 0;
  let envInserted = 0;
  let pendingPatients = [];
  let pendingEnv = [];

  async function flush() {
    if (!pendingPatients.length) return;
    const { firstId, affected } = await insertPatientBatch(pendingPatients);
    const envBatch = [];
    for (let i = 0; i < affected; i += 1) {
      envBatch.push({ patient_id: firstId + i, ...pendingEnv[i] });
    }
    envInserted += await insertEnvironmentBatch(envBatch);
    inserted += affected;
    pendingPatients = [];
    pendingEnv = [];
  }

  for (const disease of DISEASES) {
    for (const bucket of planByDisease[disease.code]) {
      const b = bucket.barangay;
      const createdBy =
        users.byBarangay.get(b.id) ?? users.byMunicipality.get(b.municipalityId) ?? null;
      if (!createdBy) continue;

      for (let i = 0; i < bucket.count; i += 1) {
        seq[disease.code] += 1;
        const patient = samplePatient(rng, disease.code);
        const dateStarted = randomDateInWeek(rng);
        const hour = String(randInt(rng, 7, 18)).padStart(2, "0");
        const minute = String(randInt(rng, 0, 59)).padStart(2, "0");
        const createdAt = `${dateStarted} ${hour}:${minute}:00`;

        pendingPatients.push({
          name: patient.fullName,
          patient_number: `${IMPORT_PREFIX}${disease.code}-${String(seq[disease.code]).padStart(6, "0")}`,
          age: patient.age,
          sex: patient.sex,
          birthdate: birthdateFromAge(patient.age, dateStarted),
          civil_status: patient.civilStatus,
          municipality_id: b.municipalityId,
          barangay_id: b.id,
          purok: PUROKS[randInt(rng, 0, PUROKS.length - 1)],
          birthplace: b.municipalityName,
          disease_type: disease.label,
          case_classification: categorical(rng, CASE_CLASS),
          case_status: rng() < 0.97 ? "active" : "closed",
          date_started: dateStarted,
          created_by: createdBy,
          created_at: createdAt
        });
        pendingEnv.push(sampleEnvironment(rng, disease.code));

        if (pendingPatients.length >= BATCH_SIZE) await flush();
      }
    }
  }

  await flush();

  console.log(`[jun2026] Inserted ${inserted} patient rows (${IMPORT_PREFIX}*).`);
  console.log(`[jun2026] Inserted ${envInserted} case_environmental rows.`);
  console.log("[jun2026] Refresh the app — filter Cases Logs by disease or date of onset.");
}

main().catch((err) => {
  console.error("[jun2026] FATAL:", err);
  process.exitCode = 1;
});
