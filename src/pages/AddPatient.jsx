import { useState } from "react";
import "./AddPatient.css";
import logo from "../assets/images/ddoLOGO.jpg";

function AddPatient() {

  // STEP STATE
  const [step, setStep] = useState(1);

  // FORM DATA
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
    e.preventDefault();

    console.log("Patient Data:", patientData);
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

      {/* CONTENT */}

      <div className="patient-content">

        {/* STEP PANEL */}

        <div className="step-panel">

          <h4>Add Patient</h4>

          <ul>

            <li
              className={step === 1 ? "active" : ""}
              onClick={() => setStep(1)}
            >
              Patient Personal Details
            </li>

            <li
              className={step === 2 ? "active" : ""}
              onClick={() => setStep(2)}
            >
              Address Details
            </li>

            <li
              className={step === 3 ? "active" : ""}
              onClick={() => setStep(3)}
            >
              Medical Details
            </li>

          </ul>

        </div>

        {/* FORM PANEL */}

        <form
          className="form-panel"
          onSubmit={handleSubmit}
        >

          {/* STEP 1 */}

          {step === 1 && (
            <>

              <h3>Patient Personal Details</h3>

              <label>Name</label>
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

                <option value="">
                  Select Civil Status
                </option>

                <option value="Single">
                  Single
                </option>

                <option value="Married">
                  Married
                </option>

                <option value="Widowed">
                  Widowed
                </option>

                <option value="Separated">
                  Separated
                </option>


              </select>

            </>
          )}

          {/* STEP 2 */}

          {step === 2 && (
            <>

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

            </>
          )}

          {/* STEP 3 */}

          {step === 3 && (
            <>

              <h3>Medical Details</h3>

              <label>Disease Type</label>

              <select
                name="diseaseType"
                value={patientData.diseaseType}
                onChange={handleChange}
              >

                <option value="">
                  Select Disease
                </option>

                <option value="ILI">
                  ILI
                </option>

                <option value="Dengue">
                  Dengue
                </option>

                <option value="AWD">
                  AWD
                </option>

              </select>

              <label>
                When did the signs start?
              </label>

              <input
                type="date"
                name="dateStarted"
                value={patientData.dateStarted}
                onChange={handleChange}
              />

            </>
          )}

          {/* BUTTONS */}

          <div className="form-buttons">

            {step > 1 && (
              <button
                type="button"
                className="back-btn"
                onClick={prevStep}
              >
                ← Back
              </button>
            )}

            {step < 3 ? (

              <button
                type="button"
                className="continue-btn"
                onClick={nextStep}
              >
                Continue →
              </button>

            ) : (

              <button
                type="submit"
                className="continue-btn"
              >
                Save Patient
              </button>

            )}

          </div>

        </form>

      </div>

    </div>

  );

}

export default AddPatient;