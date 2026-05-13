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

app.listen(PORT, () => {
  console.log(`ALERTO API listening on http://localhost:${PORT}`);
});
