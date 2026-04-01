import { useState } from "react";
import "./Login.css";

import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";

function Login() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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

  const handleLogin = (e) => {

    e.preventDefault();

    console.log({
      username,
      password,
      municipality,
      barangay
    });

    alert("Login button clicked");

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
        <div className="tab-container">

          <button className="tab active">
            LOGIN
          </button>

          <button className="tab">
            ABOUT
          </button>

        </div>

        <p className="subtitle">
          Sign in to your account
        </p>

        <form onSubmit={handleLogin}>

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

          {/* Municipality + Barangay Side-by-Side */}

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

          {/* Button */}
        <button
            type="submit"
            className="login-button"
            >
            SIGN IN
            </button>

            {/* Sign Up Section */}
            <div className="signup-section">

            <span>
                Don't have an account?
            </span>

            <button
                type="button"
                className="signup-link"
                onClick={() => alert("Go to Sign Up Page")}
            >
                Sign Up
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

export default Login;