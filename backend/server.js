const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function pickFirst(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return undefined;
}

function normalizeUser(rawUser) {
  const u = rawUser || {};
  const role = pickFirst(u, ["role", "Role", "userRole", "user_role", "accountRole", "account_role"]);
  const municipality = pickFirst(u, ["municipality", "Municipality", "mun", "Mun", "city", "City"]);
  const barangay = pickFirst(u, ["barangay", "Barangay", "brgy", "Brgy"]);

  const inferredRole = (() => {
    if (role && String(role).trim()) return String(role).trim();
    if (barangay && String(barangay).trim()) return "Barangay Employee";
    if (municipality && String(municipality).trim()) return "Municipal Employee";
    return "Provincial Employee";
  })();

  return {
    ...u,
    role: inferredRole,
    municipality: municipality ?? u.municipality,
    barangay: barangay ?? u.barangay
  };
}

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Backend is running");
});

/* =========================
   SIGNUP
========================= */
app.post("/signup", async (req, res) => {
  const body = req.body || {};
  const fullName = pickFirst(body, ["fullName", "fullname", "FullName", "name"]);
  const email = pickFirst(body, ["email", "Email"]);
  const contactNumber = pickFirst(body, ["contactNumber", "contact_number", "ContactNumber", "contact"]);
  const username = pickFirst(body, ["username", "userName", "Username"]);
  const password = pickFirst(body, ["password", "Password"]);
  const role = pickFirst(body, ["role", "Role", "userRole", "user_role"]);
  const municipality = pickFirst(body, ["municipality", "Municipality"]);
  const barangay = pickFirst(body, ["barangay", "Barangay"]);

  try {
    if (!fullName || !email || !contactNumber || !username || !password || !role) {
      return res.status(400).json({
        error: "Missing required fields. Please complete the signup form."
      });
    }

    const [existing] = await db.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    await db.query(
      `INSERT INTO users 
      (fullName, email, contactNumber, username, password, role, municipality, barangay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullName ?? null,
        email ?? null,
        contactNumber ?? null,
        username ?? null,
        password ?? null,
        role ?? null,
        municipality ?? null,
        barangay ?? null
      ]
    );

    res.json({ message: "User registered successfully!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = normalizeUser(rows[0]);

    // ✅ RETURN FULL USER (IMPORTANT)
    res.json({
      message: "Login successful",
      user: user
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   PATIENTS
========================= */
app.post("/add-patient", async (req, res) => {
  const {
    name,
    age,
    sex,
    birthdate,
    civilStatus,
    province,
    municipality,
    barangay,
    purok,
    birthplace,
    diseaseType,
    dateStarted
  } = req.body || {};

  try {
    await db.query(
      `INSERT INTO patients
      (name, age, sex, birthdate, civilStatus, province, municipality, barangay, purok, birthplace, diseaseType, dateStarted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name ?? null,
        age ?? null,
        sex ?? null,
        birthdate ?? null,
        civilStatus ?? null,
        province ?? null,
        municipality ?? null,
        barangay ?? null,
        purok ?? null,
        birthplace ?? null,
        diseaseType ?? null,
        dateStarted ?? null
      ]
    );

    res.json({ message: "Patient saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/patients", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM patients ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SERVER
========================= */
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});