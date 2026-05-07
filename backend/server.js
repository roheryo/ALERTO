const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

const MUNICIPALITY_COORDS = {
  nabunturan: { lat: 7.6075, lon: 125.9667, label: "Nabunturan" },
  monkayo: { lat: 7.8175, lon: 126.0503, label: "Monkayo" },
  compostela: { lat: 7.6731, lon: 126.0886, label: "Compostela" },
  mawab: { lat: 7.5592, lon: 125.9928, label: "Mawab" },
  maco: { lat: 7.3619, lon: 125.8553, label: "Maco" },
  maragusan: { lat: 7.3853, lon: 126.1069, label: "Maragusan" },
  montevista: { lat: 7.695, lon: 125.9869, label: "Montevista" },
  pantukan: { lat: 7.1242, lon: 126.0078, label: "Pantukan" },
  "new bataan": { lat: 7.5325, lon: 126.1428, label: "New Bataan" },
  newbataan: { lat: 7.5325, lon: 126.1428, label: "New Bataan" },
  laak: { lat: 7.9703, lon: 125.9994, label: "Laak" },
  mabini: { lat: 7.3122, lon: 125.8533, label: "Mabini" }
};

function normalizeMunicipalityName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mapOpenMeteoCodeToCondition(code) {
  const n = Number(code);
  if (n === 0) return "Clear";
  if ([1, 2, 3].includes(n)) return "Cloudy";
  if ([45, 48].includes(n)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(n)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return "Rain";
  if ([95, 96, 99].includes(n)) return "Thunderstorm";
  return "Unknown";
}

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
   WEATHER BY MUNICIPALITY
========================= */
app.get("/weather/:municipality", async (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const rawMunicipality = req.params.municipality;
  const key = normalizeMunicipalityName(rawMunicipality);
  const coords = MUNICIPALITY_COORDS[key];

  if (!coords) {
    return res.status(404).json({ error: `No coordinates mapped for municipality: ${rawMunicipality}` });
  }

  try {
    // 1) Primary provider: OpenWeatherMap
    if (apiKey) {
      const url =
        `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}` +
        `&units=metric&appid=${apiKey}`;

      const weatherRes = await fetch(url);
      const weatherData = await weatherRes.json();

      if (weatherRes.ok) {
        return res.json({
          municipality: coords.label,
          temperature: Number(weatherData?.main?.temp ?? 0),
          humidity: Number(weatherData?.main?.humidity ?? 0),
          condition: String(weatherData?.weather?.[0]?.main ?? "Unknown"),
          provider: "openweathermap"
        });
      }
    }

    // 2) Fallback provider: Open-Meteo (no API key required)
    const fallbackUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code`;
    const fallbackRes = await fetch(fallbackUrl);
    const fallbackData = await fallbackRes.json();

    if (!fallbackRes.ok || !fallbackData?.current) {
      return res.status(502).json({ error: "Failed to fetch weather from providers" });
    }

    return res.json({
      municipality: coords.label,
      temperature: Number(fallbackData.current.temperature_2m ?? 0),
      humidity: Number(fallbackData.current.relative_humidity_2m ?? 0),
      condition: mapOpenMeteoCodeToCondition(fallbackData.current.weather_code),
      provider: "open-meteo"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Weather API request failed" });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});