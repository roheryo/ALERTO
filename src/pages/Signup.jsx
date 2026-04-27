import { useState } from "react";
import "./Login.css";
import { Eye, EyeOff } from "lucide-react";
import logo from "../assets/images/ddoLOGO.JPG";
import bgImage from "../assets/images/ddoBG.jpg";
import { useNavigate } from "react-router-dom";

function Signup() {

  const navigate = useNavigate();
  const [isSignup] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [role, setRole] = useState("");

  const barangayData = {
    Nabunturan: ["Basak", "Bayabas", "Bukal", "Cabidianan", "Katipunan", "Magsaysay", "San Isidro", "San Vicente"],
    Monkayo: ["Awao", "Babag", "Banlag", "Haguimitan", "Union", "Oro", "Poblacion"],
    Compostela: ["Bagongon", "Gabi", "Lagab", "Mangayon", "Osmena", "Poblacion"],
    Mawab: ["Andap", "Concepcion", "Nuevo Iloco", "Poblacion", "Salvacion"],
    Maco: ["Anibongan", "Anislagan", "Bucana", "Calabcab", "Concepcion", "Dumlan", "Hijo", "Lapu-lapu", "Poblacion", "San Juan", "Taglawig"],
    Maragusan: ["Bagong Silang", "Coronobe", "Katipunan", "Mahayahay", "New Albay", "Poblacion"],
    Montevista: ["Banagbanag", "Banglasan", "Camansi", "Canidkid", "Concepcion", "Poblacion"],
    Pantukan: ["Kingking", "Magnaga", "Napnapan", "Poblacion", "Tagdanua"],
    NewBataan: ["Andap", "Cabinuangan", "Camanlangan", "Poblacion", "San Roque"],
    Laak: ["Amorcruz", "Anitap", "Datu Ampunan", "Longanapan", "Poblacion"],
    Mabini: ["Cadunan", "Golden Valley", "Pindasan", "San Antonio", "Tagnanan"]
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) return alert("Passwords do not match!");
    if (contactNumber.length !== 11) return alert("Contact must be 11 digits!");
    if (!role) return alert("Select a role!");

    try {
      const res = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName, email, contactNumber, username, password, role, municipality, barangay
        })
      });

      const data = await res.json();
      if (!res.ok) return alert(data.error);

      alert(data.message);
      navigate("/login");

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="login-container" style={{ backgroundImage: `url(${bgImage})` }}>

      <div className="login-card wide-card">

        <div className="logo-placeholder">
          <img src={logo} alt="Logo" className="logo-image" />
        </div>

        <h2 className="system-title">
          ALERTO: Davao de Oro <br />
          Disease Surveillance: <br />
          Dengue, ILI, AWD
        </h2>

        {/* TABS */}
        <div className={`tab-container ${isSignup ? "signup-active" : ""}`}>
          <button className="tab" type="button" disabled>
            LOGIN
          </button>
          <button className="tab" type="button" disabled>
            SIGN UP
          </button>
        </div>

        <p className="subtitle">Create your account</p>

        <form onSubmit={handleSignup}>

          <div className="form-grid">

            {/* LEFT */}
            <div>
              <label>Full Name</label>
              <input
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Contact Number</label>
              <input
                placeholder="09XXXXXXXXX"
                value={contactNumber}
                maxLength="11"
                onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            {/* RIGHT */}
            <div>
              <label>Username</label>
              <input
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <span onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </span>
              </div>

              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <span onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </span>
              </div>
            </div>

          </div>

          {/* CENTERED DROPDOWNS */}
          <div className="top-row">

            <div>
              <label>User Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} required>
                <option value="">Select Role</option>
                <option>Municipal Employee</option>
                <option>Barangay Employee</option>
                <option>Provincial Employee</option>
              </select>
            </div>

            <div>
              <label>Municipality</label>
              <select
                value={municipality}
                onChange={(e) => {
                  setMunicipality(e.target.value);
                  setBarangay("");
                }}
                required
              >
                <option value="">Select Municipality</option>
                {Object.keys(barangayData).map(m => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Barangay</label>
              <select
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                required
              >
                <option value="">Select Barangay</option>
                {municipality &&
                  barangayData[municipality]?.map(b => (
                    <option key={b}>{b}</option>
                  ))}
              </select>
            </div>

          </div>

          <button className="login-button">CREATE ACCOUNT</button>

        </form>

        <div className="signup-section">
          <span>I already have an account</span>
          <button
            type="button"
            className="signup-link"
            onClick={() => navigate("/login")}
          >
            Log In
          </button>
        </div>

      </div>
    </div>
  );
}

export default Signup;