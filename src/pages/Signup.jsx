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

  const handleSignup = async (e) => {

    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (contactNumber.length !== 11) {
      alert("Contact Number must be 11 digits!");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Signup failed");
        return;
      }

      alert(data.message);

      navigate("/login");

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

              setTimeout(() => {
                navigate("/login");
              }, 300);

            }}
          >
            LOGIN
          </button>

          <button className="tab">
            SIGN UP
          </button>

        </div>

        <p className="subtitle">
          Create your account
        </p>

        <form onSubmit={handleSignup}>

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

          
          <label>Contact Number</label>
          <input
            type="tel"
            placeholder="Enter Contact Number"
            value={contactNumber}
            maxLength="11"
            onChange={(e) => {

              const value =
                e.target.value.replace(/\D/g, "");

              if (value.length <= 11) {
                setContactNumber(value);
              }

            }}
            required
          />

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
            CREATE ACCOUNT
          </button>

          <div className="signup-section">

            <span>
              Already have an account?
            </span>

            <button
              type="button"
              className="signup-link"
              onClick={() =>
                navigate("/login")
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