import { useState } from "react";
import "./Login.css";

import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";
import { useNavigate } from "react-router-dom";

function Signup() {

  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  /* ✅ NEW: Contact Number State */
  const [contactNumber, setContactNumber] = useState("");

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");

  /* Municipality → Barangay Mapping */
  const barangayData = {

    Nabunturan: [
      "Basak",
      "Bayabas",
      "Bukal",
      "Cabidianan",
      "Katipunan"
    ],

    Monkayo: [
      "Awao",
      "Babag",
      "Banlag",
      "Haguimitan"
    ],

    Compostela: [
      "Bagongon",
      "Gabi",
      "Lagab",
      "Mangayon"
    ],

    Mawab: [
      "Andap",
      "Concepcion",
      "Nuevo Iloco"
    ]

  };

  const handleSignup = (e) => {

    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (contactNumber.length !== 11) {
      alert("Contact Number must be 11 digits!");
      return;
    }

    console.log({
      fullName,
      email,
      contactNumber,
      username,
      password,
      municipality,
      barangay
    });

    alert("Signup Successful!");

  };

  return (

    <div
      className="login-container"
      style={{
        backgroundImage: `url(${bgImage})`
      }}
    >

      <div className="login-card">

        {/* Logo */}
        <div className="logo-placeholder">

          <img
            src={logo}
            alt="Davao de Oro Logo"
            className="logo-image"
          />

        </div>

        {/* Title */}
        <h2 className="system-title">
          ALERTO: Davao de Oro
          <br />
          Disease Surveillance:
          <br />
          Dengue, ILI, AWD
        </h2>

        {/* Tabs */}
        <div
          className={`tab-container ${
            isSignup ? "signup-active" : ""
          }`}
        >

          {/* LOGIN */}
          <button
            className="tab"
            onClick={() => {

              setIsSignup(false);

              setTimeout(() => {

                navigate("/");

              }, 300);

            }}
          >
            LOGIN
          </button>

          {/* SIGNUP */}
          <button className="tab">
            SIGN UP
          </button>

        </div>

        <p className="subtitle">
          Create your account
        </p>

        <form onSubmit={handleSignup}>

          {/* Full Name */}
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Enter Full Name"
            value={fullName}
            onChange={(e) =>
              setFullName(e.target.value)
            }
            required
          />

          {/* Email */}
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter Email Address"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          {/* ✅ FIXED Contact Number */}
          <label>Contact Number</label>
          <input
            type="tel"
            placeholder="Enter Contact Number"
            value={contactNumber}
            maxLength="11"

            onChange={(e) => {

              /* Allow numbers only */
              const value =
                e.target.value.replace(/\D/g, "");

              if (value.length <= 11) {
                setContactNumber(value);
              }

            }}

            required
          />

          {/* Username */}
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            required
          />

          {/* Password */}
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />

          {/* Confirm Password */}
          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            required
          />

          {/* Municipality + Barangay */}
          <div className="location-row">

            {/* Municipality */}
            <div className="location-group">

              <label>Municipality</label>

              <select
                value={municipality}
                onChange={(e) => {

                  setMunicipality(e.target.value);
                  setBarangay("");

                }}
                className="dropdown"
                required
              >

                <option value="">
                  Select Municipality
                </option>

                {Object.keys(barangayData).map((muni) => (

                  <option
                    key={muni}
                    value={muni}
                  >
                    {muni}
                  </option>

                ))}

              </select>

            </div>

            {/* Barangay */}
            <div className="location-group">

              <label>Barangay</label>

              <select
                value={barangay}
                onChange={(e) =>
                  setBarangay(e.target.value)
                }
                className="dropdown"
                required
              >

                <option value="">
                  Select Barangay
                </option>

                {municipality &&
                  barangayData[municipality].map((brgy) => (

                    <option
                      key={brgy}
                      value={brgy}
                    >
                      {brgy}
                    </option>

                  ))}

              </select>

            </div>

          </div>

          {/* Signup Button */}
          <button
            type="submit"
            className="login-button"
          >
            CREATE ACCOUNT
          </button>

          {/* Back to Login */}
          <div className="signup-section">

            <span>
              Already have an account?
            </span>

            <button
              type="button"
              className="signup-link"
              onClick={() =>
                navigate("/")
              }
            >
              Login
            </button>

          </div>

        </form>

        <p className="footer-text">
          Secure authentication for ALERTO Disease Surveillance
        </p>

      </div>

    </div>

  );

}

export default Signup;