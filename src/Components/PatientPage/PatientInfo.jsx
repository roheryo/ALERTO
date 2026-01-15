import React from "react";
import "./PatientInformation.css";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const PatientInformation = () => {
  const navigate = useNavigate();

  return (
    <div className="patient-container">
      {/* BACK BUTTON */}
      <button className="back-btn" onClick={() => navigate("/dashboard")}>
        <FaArrowLeft /> Back to Dashboard
      </button>

      <h1>Patient Information Management</h1>

      <form className="patient-form">
        {/* PATIENT DETAILS */}
        <div className="form-section">
          <h2>Patient Details</h2>

          <div className="form-row">
            <label>Patient Name</label>
            <input type="text" />
          </div>

          <div className="form-row">
            <label>Patient Age</label>
            <input type="number" />
          </div>

          <div className="form-row">
            <label>Sex</label>
            <select>
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>

          <div className="form-row">
            <label>Date of Birth</label>
            <input type="date" />
          </div>
        </div>

        {/* ADDRESS INFORMATION */}
        <div className="form-section">
          <h2>Address Information</h2>

          <div className="form-row">
            <label>Municipality</label>
            <input type="text" />
          </div>

          <div className="form-row">
            <label>Street / Purok</label>
            <input type="text" />
          </div>

          <div className="form-row">
            <label>Barangay</label>
            <input type="text" />
          </div>
        </div>

        {/* ADMISSION & DISEASE INFO */}
        <div className="form-section">
          <h2>Admission & Disease Information</h2>

          <div className="form-row">
            <label>Disease Type</label>
            <select>
              <option value="">Select Disease</option>
              <option>AWD</option>
              <option>DENGUE</option>
              <option>ILI</option>
            </select>
          </div>

          <div className="form-row">
            <label>Admitted Times</label>
            <input type="number" />
          </div>

          <div className="form-row">
            <label>Date of Admit</label>
            <input type="date" />
          </div>

          <div className="form-row">
            <label>Date of Onset</label>
            <input type="date" />
          </div>

          <div className="form-row">
            <label>Laboratory Result</label>
            <input type="text" placeholder="Positive / Negative / Pending" />
          </div>

          <div className="form-row">
            <label>Date of Entry</label>
            <input type="date" />
          </div>
        </div>

        {/* SUBMIT */}
        <div className="form-actions">
          <button type="submit">Save Patient Record</button>
        </div>
      </form>
    </div>
  );
};

export default PatientInformation;
