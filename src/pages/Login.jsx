import { useState, useEffect } from "react";
import "./Login.css";

import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { username, password }
      });

      login(data.token, data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
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

        <p className="subtitle">
          Sign in with your username or email
        </p>

        <p className="login-policy-note">
          Access is not self-service. Contact your municipality or province administrator if you need an account or a password reset.
        </p>

        {error ? <p className="login-error">{error}</p> : null}

        <form onSubmit={handleLogin}>
          <label htmlFor="login-username">Username or email</label>

          <input
            id="login-username"
            type="text"
            placeholder="e.g. ddo_province_admin or province.admin@alerto.local"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="login-password">Password</label>

          <input
            id="login-password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            className="login-button"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="footer-text">
          Secure authentication for ALERTO Disease Surveillance
        </p>
      </div>
    </div>
  );
}

export default Login;
