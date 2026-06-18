import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./config/db.js";
import { authMiddleware, signToken } from "./middleware/auth.js";
import {
  bootstrapSchema,
  formatAutoPatientNumber,
  normalizeCaseClassification,
  persistCaseClassification,
  persistCaseEnvironment,
  persistPatientNumber
} from "./bootstrap/schema.js";
import { createWeatherRouter } from "./routes/weather.js";
import { createForecastsRouter } from "./routes/forecasts.js";
import { createAlertsRouter } from "./routes/alerts.js";
import { riskConfigPayload } from "./lib/riskConfig.js";
import { scheduleMunicipalityEvaluation, startAlertScheduler } from "./jobs/evaluateAlerts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

if (JWT_SECRET === "dev-only-change-me") {
  console.warn("[ALERTO API] Using default JWT_SECRET; set JWT_SECRET in .env for production.");
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "64kb" }));

const api = express.Router();

api.post("/auth/login", async (req, res) => {
  try {
  const loginId = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!loginId || !password) {
    return res.status(400).json({ error: "Username or email and password are required" });
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name AS fullName, u.email, u.contact_number AS contactNumber,
            u.role, u.province_id AS provinceId, u.municipality_id AS municipalityId, u.barangay_id AS barangayId,
            p.name AS provinceName, m.name AS municipalityName, b.name AS barangayName, u.password_hash AS passwordHash
     FROM users u
     LEFT JOIN provinces p ON p.id = u.province_id
     LEFT JOIN municipalities m ON m.id = u.municipality_id
     LEFT JOIN barangays b ON b.id = u.barangay_id
     WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
     LIMIT 1`,
    [loginId, loginId]
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const storedHash = user.passwordHash;
  const hashStr = Buffer.isBuffer(storedHash)
    ? storedHash.toString("utf8")
    : String(storedHash ?? "");

  const ok = await bcrypt.compare(password, hashStr);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  delete user.passwordHash;
  const token = signToken({
    id: user.id,
    role: user.role,
    province_id: user.provinceId,
    municipality_id: user.municipalityId,
    barangay_id: user.barangayId
  });

  return res.json({ token, user });
  } catch (err) {
    console.error(err);
    if (err?.code === "ER_ACCESS_DENIED_ERROR") {
      return res.status(503).json({
        error:
          "Cannot connect to MySQL: access denied. Set DB_USER and DB_PASS in backend/.env to match your MySQL account (root often has a password on Windows)."
      });
    }
    if (err?.code === "ER_BAD_DB_ERROR") {
      return res.status(503).json({
        error:
          `Database "${process.env.DB_NAME ?? "ALERTO"}" does not exist. Create it and run the SQL scripts in database/migrations/.`
      });
    }
    if (err?.code === "ECONNREFUSED") {
      return res.status(503).json({
        error:
          "Cannot connect to MySQL (connection refused). Start MySQL and check DB_HOST in backend/.env."
      });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

/** Municipality: barangay accounts under their municipality only. */
api.get("/admin/barangay-accounts", authMiddleware, async (req, res) => {
  try {
  const { role, municipalityId, provinceId } = req.auth;

  if (role === "municipality") {
    if (!municipalityId) return res.status(403).json({ error: "Forbidden" });
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name AS fullName, u.email, u.contact_number AS contactNumber,
              u.role, b.name AS barangayName, m.name AS municipalityName
       FROM users u
       JOIN barangays b ON b.id = u.barangay_id
       JOIN municipalities m ON m.id = b.municipality_id
       WHERE u.role = 'barangay' AND b.municipality_id = ?
       ORDER BY b.name`,
      [municipalityId]
    );
    return res.json({ accounts: rows, readOnly: false });
  }

  if (role === "province") {
    if (!provinceId) return res.status(403).json({ error: "Forbidden" });
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name AS fullName, u.email, u.contact_number AS contactNumber,
              u.role, b.name AS barangayName, m.name AS municipalityName
       FROM users u
       JOIN barangays b ON b.id = u.barangay_id
       JOIN municipalities m ON m.id = b.municipality_id
       WHERE u.role = 'barangay' AND m.province_id = ?
       ORDER BY m.name, b.name`,
      [provinceId]
    );
    return res.json({ accounts: rows, readOnly: true });
  }

  return res.status(403).json({ error: "Forbidden" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** Shared risk-indicator config (thresholds, weights, bands) for the UI. */
api.get("/risk-config", authMiddleware, (_req, res) => {
  return res.json(riskConfigPayload());
});

api.use("/weather", createWeatherRouter(authMiddleware));
api.use("/forecasts", createForecastsRouter(authMiddleware));
api.use("/alerts", createAlertsRouter(authMiddleware));

/**
 * Case log rows for dashboard / cases / reports (RBAC).
 * - barangay: own barangay only
 * - municipality: all patients in municipality
 * - province: all patients in province
 */
api.get("/patients", authMiddleware, async (req, res) => {
  try {
    const { role, provinceId, municipalityId, barangayId, sub: userId } = req.auth;

    let where = "";
    const params = [];

    if (role === "barangay") {
      if (!barangayId) return res.status(403).json({ error: "Barangay scope missing" });
      where = "WHERE (p.barangay_id = ? OR p.created_by = ?)";
      params.push(barangayId, userId);
    } else if (role === "municipality") {
      if (!municipalityId) return res.status(403).json({ error: "Municipality scope missing" });
      where = "WHERE (p.municipality_id = ? OR p.created_by = ?)";
      params.push(municipalityId, userId);
    } else if (role === "province") {
      if (!provinceId) return res.status(403).json({ error: "Province scope missing" });
      where = "WHERE m.province_id = ?";
      params.push(provinceId);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const baseFrom = `FROM patients p
        JOIN municipalities m ON m.id = p.municipality_id
        JOIN barangays b ON b.id = p.barangay_id`;

    const selectSqlWithPatientNum = `SELECT
          p.id,
          p.name,
          p.patient_number AS patientNumber,
          p.age,
          p.sex,
          DATE_FORMAT(p.birthdate, '%Y-%m-%d') AS birthdate,
          p.civil_status AS civilStatus,
          p.province,
          p.municipality_id AS municipalityId,
          p.barangay_id AS barangayId,
          m.name AS municipality,
          b.name AS barangay,
          p.purok,
          p.birthplace,
          p.disease_type AS diseaseType,
          p.case_classification AS caseClassification,
          p.case_status AS caseStatus,
          DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
          p.created_at AS createdAt
        ${baseFrom}
        ${where}
        ORDER BY p.date_started DESC, p.id DESC`;

    const selectSqlWithCase = `SELECT
          p.id,
          p.name,
          p.age,
          p.sex,
          DATE_FORMAT(p.birthdate, '%Y-%m-%d') AS birthdate,
          p.civil_status AS civilStatus,
          p.province,
          p.municipality_id AS municipalityId,
          p.barangay_id AS barangayId,
          m.name AS municipality,
          b.name AS barangay,
          p.purok,
          p.birthplace,
          p.disease_type AS diseaseType,
          p.case_classification AS caseClassification,
          p.case_status AS caseStatus,
          DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
          p.created_at AS createdAt
        ${baseFrom}
        ${where}
        ORDER BY p.date_started DESC, p.id DESC`;

    const selectSqlLegacy = `SELECT
          p.id,
          p.name,
          p.age,
          p.sex,
          DATE_FORMAT(p.birthdate, '%Y-%m-%d') AS birthdate,
          p.civil_status AS civilStatus,
          p.province,
          p.municipality_id AS municipalityId,
          p.barangay_id AS barangayId,
          m.name AS municipality,
          b.name AS barangay,
          p.purok,
          p.birthplace,
          p.disease_type AS diseaseType,
          NULL AS caseClassification,
          'active' AS caseStatus,
          DATE_FORMAT(p.date_started, '%Y-%m-%d') AS dateStarted,
          p.created_at AS createdAt
        ${baseFrom}
        ${where}
        ORDER BY p.date_started DESC, p.id DESC`;

    let rows;
    try {
      [rows] = await pool.query(selectSqlWithPatientNum, params);
    } catch (qErr) {
      if (qErr?.code === "ER_BAD_FIELD_ERROR") {
        try {
          [rows] = await pool.query(selectSqlWithCase, params);
        } catch (qErr2) {
          if (qErr2?.code === "ER_BAD_FIELD_ERROR") {
            [rows] = await pool.query(selectSqlLegacy, params);
          } else {
            throw qErr2;
          }
        }
      } else {
        throw qErr;
      }
    }

    for (const row of rows) {
      if (!row.patientNumber && row.id != null) {
        row.patientNumber = formatAutoPatientNumber(row.id);
      }
    }

    return res.json({ patients: rows });
  } catch (err) {
    console.error(err);
    if (err?.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({ error: "Database schema not installed (missing patients table)." });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Create a new case (barangay BHU encoding only).
 */
api.post("/patients", authMiddleware, async (req, res) => {
  try {
    const auth = req.auth;
    const { role, provinceId, municipalityId, barangayId, sub: userId } = auth;
    const b = req.body ?? {};

    const name = String(b.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Patient name is required" });

    const diseaseType = String(b.diseaseType ?? "").trim();
    if (!diseaseType) return res.status(400).json({ error: "Disease type is required" });

    const dateStarted = String(b.dateStarted ?? "").trim();
    if (!dateStarted) return res.status(400).json({ error: "Date started (onset) is required" });

    const muniName = String(b.municipality ?? "").trim();
    const brgyName = String(b.barangay ?? "").trim();
    if (!muniName || !brgyName) {
      return res.status(400).json({ error: "Municipality and barangay are required" });
    }

    if (role !== "barangay") {
      return res.status(403).json({ error: "Only barangay accounts can report new cases" });
    }

    let scopeProvinceId = provinceId;
    if (!scopeProvinceId && municipalityId) {
      const [muniRow] = await pool.query(
        `SELECT province_id AS pid FROM municipalities WHERE id = ? LIMIT 1`,
        [municipalityId]
      );
      scopeProvinceId = muniRow[0]?.pid;
    }
    if (!scopeProvinceId && barangayId) {
      const [brgyRow] = await pool.query(
        `SELECT m.province_id AS pid
         FROM barangays b
         JOIN municipalities m ON m.id = b.municipality_id
         WHERE b.id = ? LIMIT 1`,
        [barangayId]
      );
      scopeProvinceId = brgyRow[0]?.pid;
    }
    if (!scopeProvinceId) {
      return res.status(403).json({ error: "Province scope missing" });
    }

    const [geoRows] = await pool.query(
      `SELECT b.id AS bid, m.id AS mid
       FROM barangays b
       JOIN municipalities m ON m.id = b.municipality_id
       WHERE m.province_id = ? AND m.name = ? AND b.name = ?
       LIMIT 1`,
      [scopeProvinceId, muniName, brgyName]
    );
    if (!geoRows[0]) {
      return res.status(400).json({
        error: "Municipality/barangay not found in your province. Check spelling matches the official list."
      });
    }

    const targetMunicipalityId = geoRows[0].mid;
    const targetBarangayId = geoRows[0].bid;

    const age = b.age != null && b.age !== "" ? String(b.age) : null;
    const sexRaw = String(b.sex ?? "").trim();
    const sex =
      sexRaw === "M"
        ? "Male"
        : sexRaw === "F"
          ? "Female"
          : sexRaw === "Male" || sexRaw === "Female"
            ? sexRaw
            : sexRaw || null;
    const birthdate = String(b.birthdate ?? "").trim() || null;
    const civilStatus = String(b.civilStatus ?? "").trim() || null;
    const province = String(b.province ?? "Davao de Oro").trim() || "Davao de Oro";
    const purok = String(b.purok ?? "").trim() || null;
    const birthplace = String(b.birthplace ?? "").trim() || null;
    const caseClassification = normalizeCaseClassification(b.caseClassification);
    if (!caseClassification) {
      return res.status(400).json({ error: "Case classification (Suspect, Probable, or Confirmed) is required" });
    }
    const outcome = String(b.outcome ?? "").trim();
    const caseStatus =
      outcome === "D" || String(b.caseStatus ?? "").toLowerCase() === "closed" ? "closed" : "active";
    const patientNumberInput = String(b.patientNumber ?? b.patientNum ?? "").trim().slice(0, 40) || null;

    const insertParamsWithPatientNum = [
      name,
      patientNumberInput,
      age,
      sex,
      birthdate,
      civilStatus,
      province,
      targetMunicipalityId,
      targetBarangayId,
      purok,
      birthplace,
      diseaseType,
      caseClassification,
      caseStatus,
      dateStarted,
      userId
    ];

    const insertParamsFull = [
      name,
      age,
      sex,
      birthdate,
      civilStatus,
      province,
      targetMunicipalityId,
      targetBarangayId,
      purok,
      birthplace,
      diseaseType,
      caseClassification,
      caseStatus,
      dateStarted,
      userId
    ];

    const insertParamsLegacy = [
      name,
      age,
      sex,
      birthdate,
      civilStatus,
      province,
      targetMunicipalityId,
      targetBarangayId,
      purok,
      birthplace,
      diseaseType,
      dateStarted,
      userId
    ];

    let ins;
    let usedPatientNumberColumn = false;
    try {
      [ins] = await pool.query(
        `INSERT INTO patients (
        name, patient_number, age, sex, birthdate, civil_status, province, municipality_id, barangay_id,
        purok, birthplace, disease_type, case_classification, case_status, date_started, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        insertParamsWithPatientNum
      );
      usedPatientNumberColumn = true;
    } catch (qErr) {
      if (qErr?.code === "ER_BAD_FIELD_ERROR") {
        try {
          [ins] = await pool.query(
            `INSERT INTO patients (
        name, age, sex, birthdate, civil_status, province, municipality_id, barangay_id,
        purok, birthplace, disease_type, case_classification, case_status, date_started, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            insertParamsFull
          );
        } catch (qErr2) {
          if (qErr2?.code === "ER_BAD_FIELD_ERROR") {
            [ins] = await pool.query(
              `INSERT INTO patients (
        name, age, sex, birthdate, civil_status, province, municipality_id, barangay_id,
        purok, birthplace, disease_type, date_started, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              insertParamsLegacy
            );
          } else {
            throw qErr2;
          }
        }
      } else {
        throw qErr;
      }
    }

    const newId = ins.insertId;
    const patientNumber = patientNumberInput || formatAutoPatientNumber(newId);
    if (!patientNumberInput || !usedPatientNumberColumn) {
      await persistPatientNumber(newId, patientNumber);
    }
    await persistCaseClassification(newId, caseClassification);

    if (b.environment && typeof b.environment === "object") {
      await persistCaseEnvironment(newId, b.environment);
    }

    // Fire-and-forget: re-evaluate this municipality's Early-Warning alerts.
    scheduleMunicipalityEvaluation(targetMunicipalityId);

    const year = dateStarted.slice(0, 4) || String(new Date().getFullYear());
    const caseRef = `DDO-${year}-${newId}`;

    return res.status(201).json({ ok: true, id: newId, caseRef, patientNumber, caseClassification });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Update case classification only (same RBAC scope as GET /patients).
 */
api.patch("/patients/:id", authMiddleware, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    if (!Number.isFinite(patientId) || patientId < 1) {
      return res.status(400).json({ error: "Invalid patient id" });
    }

    const caseClassification = normalizeCaseClassification(req.body?.caseClassification);
    if (!caseClassification) {
      return res.status(400).json({
        error: "Case classification (Suspect, Probable, or Confirmed) is required"
      });
    }

    const { role, provinceId, municipalityId, barangayId, sub: userId } = req.auth;

    let scopeWhere = "WHERE p.id = ?";
    const scopeParams = [patientId];

    if (role === "barangay") {
      if (!barangayId) return res.status(403).json({ error: "Barangay scope missing" });
      scopeWhere += " AND (p.barangay_id = ? OR p.created_by = ?)";
      scopeParams.push(barangayId, userId);
    } else if (role === "municipality") {
      if (!municipalityId) return res.status(403).json({ error: "Municipality scope missing" });
      scopeWhere += " AND (p.municipality_id = ? OR p.created_by = ?)";
      scopeParams.push(municipalityId, userId);
    } else if (role === "province") {
      if (!provinceId) return res.status(403).json({ error: "Province scope missing" });
      scopeWhere += " AND m.province_id = ?";
      scopeParams.push(provinceId);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows] = await pool.query(
      `SELECT p.id
       FROM patients p
       JOIN municipalities m ON m.id = p.municipality_id
       JOIN barangays b ON b.id = p.barangay_id
       ${scopeWhere}
       LIMIT 1`,
      scopeParams
    );
    if (!rows[0]) return res.status(404).json({ error: "Case not found" });

    const saved = await persistCaseClassification(patientId, caseClassification);
    if (!saved) {
      return res.status(503).json({ error: "Case classification could not be saved (database schema)" });
    }

    if (req.body?.environment && typeof req.body.environment === "object") {
      await persistCaseEnvironment(patientId, req.body.environment);
    }

    return res.json({ ok: true, id: patientId, caseClassification });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Permanently delete a case (same RBAC scope as GET /patients).
 */
api.delete("/patients/:id", authMiddleware, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    if (!Number.isFinite(patientId) || patientId < 1) {
      return res.status(400).json({ error: "Invalid patient id" });
    }

    const { role, provinceId, municipalityId, barangayId, sub: userId } = req.auth;

    let scopeWhere = "WHERE p.id = ?";
    const scopeParams = [patientId];

    if (role === "barangay") {
      if (!barangayId) return res.status(403).json({ error: "Barangay scope missing" });
      scopeWhere += " AND (p.barangay_id = ? OR p.created_by = ?)";
      scopeParams.push(barangayId, userId);
    } else if (role === "municipality") {
      if (!municipalityId) return res.status(403).json({ error: "Municipality scope missing" });
      scopeWhere += " AND (p.municipality_id = ? OR p.created_by = ?)";
      scopeParams.push(municipalityId, userId);
    } else if (role === "province") {
      if (!provinceId) return res.status(403).json({ error: "Province scope missing" });
      scopeWhere += " AND m.province_id = ?";
      scopeParams.push(provinceId);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows] = await pool.query(
      `SELECT p.id
       FROM patients p
       JOIN municipalities m ON m.id = p.municipality_id
       JOIN barangays b ON b.id = p.barangay_id
       ${scopeWhere}
       LIMIT 1`,
      scopeParams
    );
    if (!rows[0]) return res.status(404).json({ error: "Case not found" });

    const [result] = await pool.query("DELETE FROM patients WHERE id = ?", [patientId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: "Case not found" });
    }

    return res.json({ ok: true, id: patientId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** Province: municipality accounts in their province. */
api.get("/admin/municipality-accounts", authMiddleware, async (req, res) => {
  try {
  if (req.auth.role !== "province") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const provinceId = req.auth.provinceId;
  if (!provinceId) return res.status(403).json({ error: "Forbidden" });

  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name AS fullName, u.email, u.contact_number AS contactNumber,
            u.role, m.name AS municipalityName
     FROM users u
     JOIN municipalities m ON m.id = u.municipality_id
     WHERE u.role = 'municipality' AND m.province_id = ?
     ORDER BY m.name`,
    [provinceId]
  );
  return res.json({ accounts: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Password update (RBAC enforced):
 * - municipality -> only barangay users in same municipality
 * - province -> only municipality users in same province
 */
api.patch("/admin/users/:userId/password", authMiddleware, async (req, res) => {
  try {
  const targetId = Number(req.params.userId);
  const newPassword = String(req.body?.newPassword ?? "");
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const actor = req.auth;

  const [targets] = await pool.query(
    `SELECT u.id, u.role, u.municipality_id AS municipalityId, m.province_id AS provinceId
     FROM users u
     LEFT JOIN municipalities m ON m.id = u.municipality_id
     WHERE u.id = ? AND u.is_active = 1
     LIMIT 1`,
    [targetId]
  );
  const target = targets[0];
  if (!target) return res.status(404).json({ error: "User not found" });

  if (actor.role === "municipality") {
    if (target.role !== "barangay") {
      return res.status(403).json({ error: "Municipality accounts may only reset barangay passwords" });
    }
    if (target.municipalityId !== actor.municipalityId) {
      return res.status(403).json({ error: "Outside your jurisdiction" });
    }
  } else if (actor.role === "province") {
    if (target.role !== "municipality") {
      return res.status(403).json({ error: "Province accounts may only reset municipality passwords" });
    }
    if (target.provinceId !== actor.provinceId) {
      return res.status(403).json({ error: "Outside your jurisdiction" });
    }
  } else {
    return res.status(403).json({ error: "Forbidden" });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(`UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    hash,
    targetId
  ]);

  return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.use("/api", api);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

bootstrapSchema().catch((err) => {
  console.warn("[ALERTO API] Schema bootstrap:", err.message);
});

const server = app.listen(PORT, () => {
  console.log(`ALERTO API listening on http://localhost:${PORT}`);
  startAlertScheduler();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[ALERTO API] Port ${PORT} is already in use. Another backend (or app) is listening.\n` +
        "Stop it first, then retry. Examples:\n" +
        "  • Close the other terminal running `npm run dev` or `node server.js` in backend/\n" +
        "  • From repo root: npx kill-port 3001\n" +
        "  • Windows: netstat -ano | findstr :3001   then   taskkill /PID <pid> /F\n"
    );
    process.exit(1);
  }
  throw err;
});
