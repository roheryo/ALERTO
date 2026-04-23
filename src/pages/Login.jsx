import React, { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";

import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";
function Login() {

  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");

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

  const handleLogin = async (e) => {

    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));

      alert(data.message);

      navigate("/dashboard");

    } catch (err) {
      console.error(err);
    }

  };

  return (

    <div
      className="login-container"
      style={{
        backgroundImage: `url(${bgImage})`
      }}
    >

      <div className="login-card">

        <div className="logo-placeholder">

          <img
            src={logo}
            alt="Davao de Oro Logo"
            className="logo-image"
          />

        </div>

        <h2 className="system-title">
          ALERTO: Davao de Oro
          <br />
          Disease Surveillance:
          <br />
          Dengue, ILI, AWD
        </h2>

        <div
          className={`tab-container ${
            isSignup ? "signup-active" : ""
          }`}
        >

          <button
            className="tab"
            onClick={() => {
              setIsSignup(false);
            }}
          >
            LOGIN
          </button>

          <button
            className="tab"
            onClick={() => {
              setIsSignup(true);

              setTimeout(() => {
                navigate("/signup");
              }, 150);
            }}
          >
            SIGN UP
          </button>

        </div>

        <p className="subtitle">
          Sign in to your account
        </p>

        <form onSubmit={handleLogin}>

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

          <div className="location-row">

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

          <button
            type="submit"
            className="login-button"
          >
            SIGN IN
          </button>

          <div className="signup-section">

            <span>
              Don't have an account?
            </span>

            <button
              type="button"
              className="signup-link"
              onClick={() => navigate("/signup")}
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