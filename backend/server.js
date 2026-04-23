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
   ADD PATIENT
========================= */
app.post("/add-patient", async (req, res) => {
  try {
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
    } = req.body;

    const sql = `
      INSERT INTO patients 
      (name, age, sex, birthdate, civilStatus, province, municipality, barangay, purok, birthplace, diseaseType, dateStarted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
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
    ]);

    res.json({ message: "Patient added!" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET PATIENTS
========================= */
app.get("/patients", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM patients");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SIGNUP (UPDATED ✅)
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
    // 🔥 CHECK IF USER EXISTS
    const [existing] = await db.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 🔥 INSERT USER WITH ROLE + LOCATION
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

    res.json({ message: "User registered!" });

  } catch (err) {
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

    res.json({
      message: "Login successful",
      user: rows[0] // 🔥 includes role, municipality, etc
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SERVER START
========================= */
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});