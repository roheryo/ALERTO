const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      user: rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
   ADD PATIENT
========================= */
app.post("/add-patient", async (req, res) => {
  const data = req.body;

  try {
    await db.query(
      `INSERT INTO patients 
      (name, age, sex, birthdate, civilStatus, province, municipality, barangay, purok, birthplace, diseaseType, dateStarted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.age,
        data.sex,
        data.birthdate,
        data.civilStatus,
        data.province,
        data.municipality,
        data.barangay,
        data.purok,
        data.birthplace,
        data.diseaseType,
        data.dateStarted
      ]
    );

    res.json({ message: "Patient added!" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET PATIENTS (ROLE FILTER)
========================= */
app.get("/patients", async (req, res) => {
  const { role, municipality, barangay } = req.query;

  try {
    let sql = "SELECT * FROM patients";
    let params = [];

    if (role === "Municipal Employee") {
      sql += " WHERE municipality = ?";
      params.push(municipality);
    }

    if (role === "Barangay Employee") {
      sql += " WHERE barangay = ?";
      params.push(barangay);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, params);

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE PATIENT
========================= */
app.put("/patients/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    await db.query(
      `UPDATE patients SET
        name=?, age=?, sex=?, municipality=?, barangay=?, diseaseType=?, dateStarted=?
       WHERE id=?`,
      [
        data.name,
        data.age,
        data.sex,
        data.municipality,
        data.barangay,
        data.diseaseType,
        data.dateStarted,
        id
      ]
    );

    res.json({ message: "Updated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE PATIENT
========================= */
app.delete("/patients/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM patients WHERE id=?", [id]);
    res.json({ message: "Deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});