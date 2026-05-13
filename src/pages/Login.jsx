import React, { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";

function Login() {

  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      alert("Enter username and password.");
      return;
    }

    // Client-only session for UI testing. Replace with your auth API when the backend exists.
    localStorage.setItem(
      "user",
      JSON.stringify({
        username,
        fullName: username,
        role: "Provincial Employee",
        municipality: "Nabunturan",
        barangay: ""
      })
    );

    navigate("/dashboard");
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

        <div className={`tab-container ${isSignup ? "signup-active" : ""}`}>

          <button
            className="tab"
            type="button"
            disabled
          >
            LOGIN
          </button>

          <button
            className="tab"
            type="button"
            disabled
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
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
          </div>

          <button
            type="submit"
            className="login-button"
          >
            SIGN IN
          </button>

          <div className="signup-section">
            <span>Don't have an account?</span>

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