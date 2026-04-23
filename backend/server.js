const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express(); // ✅ THIS FIXES YOUR ERROR

app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// ADD PATIENT ROUTE
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
app.get("/patients", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM patients");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    await db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password]
    );

    res.json({ message: "User registered!" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    res.json({ message: "Login successful", user: rows[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});