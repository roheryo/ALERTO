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
  const [contactNumber, setContactNumber] = useState("");
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [role, setRole] = useState("");

  const barangayData = {
    Nabunturan: ["Basak","Bayabas","Bukal","Cabidianan","Katipunan"],
    Monkayo: ["Awao","Babag","Banlag","Haguimitan"],
    Compostela: ["Bagongon","Gabi","Lagab","Mangayon"],
    Mawab: ["Andap","Concepcion","Nuevo Iloco"]
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

    if (!role) {
      alert("Please select a role!");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          email,
          contactNumber,
          username,
          password,
          role,
          municipality,
          barangay
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

        {/* 🔥 LOGIN / SIGNUP TAB */}
        <div className={`tab-container ${isSignup ? "signup-active" : ""}`}>
          <button className="tab" onClick={() => navigate("/login")}>
            LOGIN
          </button>
          <button className="tab">
            SIGN UP
          </button>
        </div>

        <p className="subtitle">Create your account</p>

        <form onSubmit={handleSignup}>

          <div className="form-grid">

            {/* LEFT */}
            <div>

              <label>Full Name</label>
              <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required />

              <label>Email</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />

              <label>Contact Number</label>
              <input
                value={contactNumber}
                maxLength="11"
                onChange={(e)=>setContactNumber(e.target.value.replace(/\D/g,""))}
                required
              />

              {/* 🔥 TOP ROW ONLY */}
              <div className="top-row">

                <div>
                  <label>User Role</label>
                  <select value={role} onChange={(e)=>setRole(e.target.value)} required>
                    <option value="">Select Role</option>
                    <option>Municipal Employee</option>
                    <option>Barangay Employee</option>
                    <option>Provincial Employee</option>
                  </select>
                </div>

                <div>
                  <label>Municipality</label>
                  <select value={municipality} onChange={(e)=>{setMunicipality(e.target.value); setBarangay("");}} required>
                    <option value="">Select Municipality</option>
                    {Object.keys(barangayData).map((m)=>(
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Barangay</label>
                  <select value={barangay} onChange={(e)=>setBarangay(e.target.value)} required>
                    <option value="">Select Barangay</option>
                    {municipality && barangayData[municipality].map((b)=>(
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>

              </div>

            </div>

            {/* RIGHT */}
            <div>

              <label>Username</label>
              <input value={username} onChange={(e)=>setUsername(e.target.value)} required />

              <label>Password</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />

              <label>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} required />

            </div>

          </div>

          <button className="login-button">CREATE ACCOUNT</button>

        </form>

      </div>
    </div>
  );
}

export default Signup;