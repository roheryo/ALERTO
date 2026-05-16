import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

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

function signToken(userRow) {
  return jwt.sign(
    {
      sub: userRow.id,
      role: userRow.role,
      provinceId: userRow.province_id,
      municipalityId: userRow.municipality_id,
      barangayId: userRow.barangay_id
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return res.status(401).json({ error: "Missing bearer token" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

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
          `Database "${process.env.DB_NAME ?? "ALERTO"}" does not exist. Create it and run the SQL scripts in database/.`
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

/**
 * Case log rows for dashboard / cases / reports (RBAC).
 * - barangay: own barangay only
 * - municipality: all patients in municipality
 * - province: all patients in province
 */
api.get("/patients", authMiddleware, async (req, res) => {
  try {
    const { role, provinceId, municipalityId, barangayId } = req.auth;

    let where = "";
    const params = [];

    if (role === "barangay") {
      if (!barangayId) return res.status(403).json({ error: "Barangay scope missing" });
      where = "WHERE p.barangay_id = ?";
      params.push(barangayId);
    } else if (role === "municipality") {
      if (!municipalityId) return res.status(403).json({ error: "Municipality scope missing" });
      where = "WHERE p.municipality_id = ?";
      params.push(municipalityId);
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
      [rows] = await pool.query(selectSqlWithCase, params);
    } catch (qErr) {
      if (qErr?.code === "ER_BAD_FIELD_ERROR") {
        [rows] = await pool.query(selectSqlLegacy, params);
      } else {
        throw qErr;
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
 * Create a new case (barangay / municipality / province — same geography rules as GET /patients).
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

    let targetMunicipalityId;
    let targetBarangayId;

    if (role === "barangay") {
      if (!barangayId) return res.status(403).json({ error: "Barangay scope missing" });
      const [r0] = await pool.query(
        `SELECT b.id AS bid, b.municipality_id AS mid FROM barangays b WHERE b.id = ? LIMIT 1`,
        [barangayId]
      );
      const row0 = r0[0];
      if (!row0) return res.status(403).json({ error: "Invalid account scope" });
      targetBarangayId = row0.bid;
      targetMunicipalityId = row0.mid;
    } else if (role === "municipality") {
      if (!municipalityId) return res.status(403).json({ error: "Municipality scope missing" });
      const brgyName = String(b.barangay ?? "").trim();
      if (!brgyName) return res.status(400).json({ error: "Barangay is required" });
      const [r0] = await pool.query(
        `SELECT b.id AS bid FROM barangays b WHERE b.municipality_id = ? AND b.name = ? LIMIT 1`,
        [municipalityId, brgyName]
      );
      if (!r0[0]) return res.status(400).json({ error: "Barangay not found in your municipality" });
      targetMunicipalityId = municipalityId;
      targetBarangayId = r0[0].bid;
    } else if (role === "province") {
      if (!provinceId) return res.status(403).json({ error: "Province scope missing" });
      const muniName = String(b.municipality ?? "").trim();
      const brgyName = String(b.barangay ?? "").trim();
      if (!muniName || !brgyName) {
        return res.status(400).json({ error: "Municipality and barangay are required" });
      }
      const [r0] = await pool.query(
        `SELECT b.id AS bid, m.id AS mid
         FROM barangays b
         JOIN municipalities m ON m.id = b.municipality_id
         WHERE m.province_id = ? AND m.name = ? AND b.name = ?
         LIMIT 1`,
        [provinceId, muniName, brgyName]
      );
      if (!r0[0]) return res.status(400).json({ error: "Municipality/barangay not found in your province" });
      targetMunicipalityId = r0[0].mid;
      targetBarangayId = r0[0].bid;
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

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
    const caseClassification = String(b.caseClassification ?? "").trim().slice(0, 40) || null;
    const outcome = String(b.outcome ?? "").trim();
    const caseStatus =
      outcome === "D" || String(b.caseStatus ?? "").toLowerCase() === "closed" ? "closed" : "active";

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
    try {
      [ins] = await pool.query(
        `INSERT INTO patients (
        name, age, sex, birthdate, civil_status, province, municipality_id, barangay_id,
        purok, birthplace, disease_type, case_classification, case_status, date_started, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        insertParamsFull
      );
    } catch (qErr) {
      if (qErr?.code === "ER_BAD_FIELD_ERROR") {
        [ins] = await pool.query(
          `INSERT INTO patients (
        name, age, sex, birthdate, civil_status, province, municipality_id, barangay_id,
        purok, birthplace, disease_type, date_started, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          insertParamsLegacy
        );
      } else {
        throw qErr;
      }
    }

    const newId = ins.insertId;
    const year = dateStarted.slice(0, 4) || String(new Date().getFullYear());
    const caseRef = `DDO-${year}-${newId}`;

    return res.status(201).json({ ok: true, id: newId, caseRef });
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

const server = app.listen(PORT, () => {
  console.log(`ALERTO API listening on http://localhost:${PORT}`);
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
