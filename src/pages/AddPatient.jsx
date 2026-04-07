import { useState } from "react";
import "./AddPatient.css";
import logo from "../assets/images/ddoLOGO.jpg";

function AddPatient() {

  const [step, setStep] = useState(1);

  const [patientData, setPatientData] = useState({
    name: "",
    age: "",
    sex: "",
    birthdate: "",
    civilStatus: "",

    province: "",
    municipality: "",
    barangay: "",
    purok: "",
    birthplace: "",

    diseaseType: "",
    dateStarted: ""
  });

  const handleChange = (e) => {

    const { name, value } = e.target;

    setPatientData({
      ...patientData,
      [name]: value
    });

  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = (e) => {

    if (step !== 3) {
      e.preventDefault();
      return;
    }

    e.preventDefault();

    console.log(patientData);

    alert("Patient Saved Successfully!");

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

      {/* MAIN CONTENT */}

      <div className="patient-content">

        {/* LEFT SIDEBAR */}

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

        {/* PERSONAL DETAILS CONTAINER */}

        <div className="form-box">

          <h3>Personal Details</h3>

          <label>Full Name</label>
          <input
            type="text"
            name="name"
            value={patientData.name}
            onChange={handleChange}
          />

          <label>Age</label>
          <input
            type="number"
            name="age"
            value={patientData.age}
            onChange={handleChange}
          />

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

          <label>Birthdate</label>

          <input
            type="date"
            name="birthdate"
            value={patientData.birthdate}
            onChange={handleChange}
          />

          <label>Civil Status</label>

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

        {/* ADDRESS CONTAINER */}

        <div className="form-box">

          <h3>Address Details</h3>

          <label>Province</label>
          <input
            type="text"
            name="province"
            value={patientData.province}
            onChange={handleChange}
          />

          <label>Municipality</label>
          <input
            type="text"
            name="municipality"
            value={patientData.municipality}
            onChange={handleChange}
          />

          <label>Barangay</label>
          <input
            type="text"
            name="barangay"
            value={patientData.barangay}
            onChange={handleChange}
          />

          <label>Purok</label>
          <input
            type="text"
            name="purok"
            value={patientData.purok}
            onChange={handleChange}
          />

          <label>Birthplace</label>
          <input
            type="text"
            name="birthplace"
            value={patientData.birthplace}
            onChange={handleChange}
          />

        </div>

      </div>

      {/* BUTTON */}

      <div className="bottom-buttons">

        {step > 1 && (
          <button
            className="back-btn"
            onClick={prevStep}
          >
            ← Back
          </button>
        )}

        {step < 2 && (
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