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

                <input
                  type="text"
                  name="municipality"
                  value={patientData.municipality}
                  onChange={handleChange}
                  placeholder="Enter municipality"
                />
              </div>
            </div>
            {/* Barangay */}
            <div className="input-group">
              <label>Barangay</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>

                <input
                  type="text"
                  name="barangay"
                  value={patientData.barangay}
                  onChange={handleChange}
                  placeholder="Enter barangay"
                />
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

                  <input
                    type="text"
                    name="diseaseType"
                    value={patientData.diseaseType}
                    onChange={handleChange}
                    placeholder="Enter disease type"
                  />
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