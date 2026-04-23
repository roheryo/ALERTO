const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

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
  const {
    fullName,
    email,
    contactNumber,
    username,
    password,
    role,
    municipality,
    barangay
  } = req.body;

  try {
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
        fullName,
        email,
        contactNumber,
        username,
        password,
        role,
        municipality,
        barangay
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

    const user = rows[0];

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