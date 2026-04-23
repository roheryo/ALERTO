import { useEffect, useState } from "react";
import "./AddPatient.css";
import logo from "../assets/images/ddoLOGO.jpg";
import { useNavigate } from "react-router-dom";

function AddPatient() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [patientData, setPatientData] = useState({
    name: "",
    age: "",
    sex: "",
    birthdate: "",
    civilStatus: "",

    province: "Davao de Oro",
    municipality: "",
    barangay: "",
    purok: "",
    birthplace: "",

    diseaseType: "",
    dateStarted: ""
  });

  const user = JSON.parse(localStorage.getItem("user"));
  const role = String(user?.role ?? "").toLowerCase();
  const inferredRole = (() => {
    if (role) return role;
    if (user?.barangay && String(user.barangay).trim()) return "barangay employee";
    if (user?.municipality && String(user.municipality).trim()) return "municipal employee";
    return "provincial employee";
  })();

  useEffect(() => {
    if (String(inferredRole).includes("provincial")) {
      navigate("/dashboard");
    }
  }, [inferredRole, navigate]);

  // Municipality → Barangay mapping (Davao de Oro)
  const barangayData = {
    Nabunturan: ["Basak", "Bayabas", "Bukal", "Cabidianan", "Katipunan", "Magsaysay", "San Isidro", "San Vicente"],
    Monkayo: ["Awao", "Babag", "Banlag", "Haguimitan", "Union", "Oro", "Poblacion"],
    Compostela: ["Bagongon", "Gabi", "Lagab", "Mangayon", "Osmena", "Poblacion"],
    Mawab: ["Andap", "Concepcion", "Nuevo Iloco", "Poblacion", "Salvacion"],
    Maco: ["Anibongan", "Anislagan", "Bucana", "Calabcab", "Concepcion", "Dumlan", "Hijo", "Lapu-lapu", "Poblacion", "San Juan", "Taglawig"],
    Maragusan: ["Bagong Silang", "Coronobe", "Katipunan", "Mahayahay", "New Albay", "Poblacion"],
    Montevista: ["Banagbanag", "Banglasan", "Camansi", "Canidkid", "Concepcion", "Poblacion"],
    Pantukan: ["Kingking", "Magnaga", "Napnapan", "Poblacion", "Tagdanua"],
    NewBataan: ["Andap", "Cabinuangan", "Camanlangan", "Poblacion", "San Roque"],
    Laak: ["Amorcruz", "Anitap", "Datu Ampunan", "Longanapan", "Poblacion"],
    Mabini: ["Cadunan", "Golden Valley", "Pindasan", "San Antonio", "Tagnanan"]
  };

  const handleChange = (e) => {

    const { name, value } = e.target;

    setPatientData({
      ...patientData,
      [name]: value
    });

  };

  const handleMunicipalityChange = (e) => {
    const value = e.target.value;
    setPatientData((prev) => ({
      ...prev,
      municipality: value,
      barangay: ""
    }));
  };

  const nextStep = () => {
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const res = await fetch("http://localhost:5000/add-patient", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patientData)
    });

    const data = await res.json();
    console.log(data);

    alert("Patient Saved Successfully!");

  } catch (err) {
    console.error(err);
    alert("Error saving patient");
  }
};

  return (

    <div className="add-patient-container">

      {/* HEADER */}

      <div className="dashboard-header">

        <h2>Add Patient</h2>

        <div className="header-right">

          <div className="header-text">
            <h3>Davao de Oro</h3>
            <p>Provincial Health Office</p>
          </div>

          <img
            src={logo}
            alt="logo"
            className="header-logo"
          />

        </div>

      </div>

     

      <div className="patient-content">

       

        <div className="step-panel">
          <h4>Add Patient</h4>
          <ul>
            <li className={step === 1 ? "active" : ""}>
              Personal Details
            </li>
            <li className={step === 2 ? "active" : ""}>
              Medical Details
            </li>

          </ul>

        </div>


        

        {step === 1 && (
        <>

        <div className="form-box">

          <h3>Personal Details</h3>

          

          <div className="input-group">

            <label>Full Name</label>

            <div className="input-with-icon">

              <span className="input-icon">
                {/* Put icon here later */}
              </span>

              <input
                type="text"
                name="name"
                value={patientData.name}
                onChange={handleChange}
                placeholder="Enter full name"
              />

            </div>

          </div>


         

          <div className="input-group">

            <label>Age</label>

            <div className="input-with-icon">

              <span className="input-icon"></span>

              <input
                type="number"
                name="age"
                value={patientData.age}
                onChange={handleChange}
                placeholder="Enter age"
              />

            </div>

          </div>


          {/* Sex stays same */}

          <label>Sex</label>

          <div className="radio-group">

            <label>
              <input
                type="radio"
                name="sex"
                value="Male"
                onChange={handleChange}
              />
              Male
            </label>

            <label>
              <input
                type="radio"
                name="sex"
                value="Female"
                onChange={handleChange}
              />
              Female
            </label>

          </div>


         

          <div className="input-group">
            <label>Birthdate</label>
            <div className="input-with-icon">
              <span className="input-icon"></span>
              <input
                type="date"
                name="birthdate"
                value={patientData.birthdate}
                onChange={handleChange}
              />

            </div>

          </div>

          <div className="input-group">
            <label>Civil Status</label>
            <div className="input-with-icon">
              <span className="input-icon"></span>
              <select
                name="civilStatus"
                value={patientData.civilStatus}
                onChange={handleChange}
              >
                <option value="">Select Civil Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-box">
          
          <h3>Address Details</h3>

            {/* Province */}
            <div className="input-group">
              <label>Province</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  
                </span>
                <input
                  type="text"
                  name="province"
                  value={patientData.province}
                  onChange={handleChange}
                  placeholder="Enter province"
                />
              </div>
            </div>
            {/* Municipality */}
            <div className="input-group">
              <label>Municipality</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>
                <select
                  name="municipality"
                  value={patientData.municipality}
                  onChange={handleMunicipalityChange}
                >
                  <option value="">Select municipality</option>
                  {Object.keys(barangayData).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Barangay */}
            <div className="input-group">
              <label>Barangay</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>
                <select
                  name="barangay"
                  value={patientData.barangay}
                  onChange={handleChange}
                  disabled={!patientData.municipality}
                >
                  <option value="">Select barangay</option>
                  {(barangayData[patientData.municipality] ?? []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Purok */}
            <div className="input-group">

              <label>Purok</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>
                <input
                  type="text"
                  name="purok"
                  value={patientData.purok}
                  onChange={handleChange}
                  placeholder="Enter purok"
                />

              </div>

            </div>
            {/* Birthplace */}
            <div className="input-group">
              <label>Birthplace</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>
                <input
                  type="text"
                  name="birthplace"
                  value={patientData.birthplace}
                  onChange={handleChange}
                  placeholder="Enter birthplace"
                />
              </div>
            </div>
        </div>
        </>
        )}



        {step === 2 && (
          <div className="form-box">

           <h3>Medical Details</h3>
              {/* Disease Type */}
              <div className="input-group">
                <label>Disease Type</label>
                <div className="input-with-icon">
                  <span className="input-icon"></span>

                  <select
                    name="diseaseType"
                    value={patientData.diseaseType}
                    onChange={handleChange}
                  >
                    <option value="">Select disease</option>
                    <option value="Dengue">Dengue</option>
                    <option value="Influenza-Like Illness">Influenza Like Illness</option>
                    <option value="Acute Watery Diarrhea">Acute Watery Diarrhea</option>
                  </select>
                </div>
              </div>
              {/* Date Started */}
              <div className="input-group">
                <label>Date Started</label>
                <div className="input-with-icon">
                  <span className="input-icon"></span>

                  <input
                    type="date"
                    name="dateStarted"
                    value={patientData.dateStarted}
                    onChange={handleChange}
                  />
                </div>
              </div>
          </div>

        )}

      </div>

      <div className="bottom-buttons">

        {step === 2 && (
          <button
            className="back-btn"
            onClick={prevStep}
          >
            ← Back
          </button>
        )}

        {step === 1 && (
          <button
            className="continue-btn"
            onClick={nextStep}
          >
            Next →
          </button>
        )}

        {step === 2 && (
          <button
            className="continue-btn"
            onClick={handleSubmit}
          >
            Save Patient
          </button>
        )}

      </div>

    </div>

  );

}

export default AddPatient;