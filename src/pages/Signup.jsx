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

const MUNICIPALITY_DATA = {
  Compostela: [
    "Aurora","Bagongon","Gabi","Lagab","Mangayon","Mapaca","Maparat",
    "New Alegria","Ngan","Osmeña","Panansalan","Poblacion",
    "San Jose","San Miguel","Siocon","Tamia"
  ],
  Maragusan: [
    "Bagong Silang","Bahi","Cambawan","Coronobe","Katipunan","Lahi",
    "Langgawisan","Mabugnao","Magcagong","Mahayahay","Mapawa",
    "Maragusan (Poblacion)","Mauswagon","New Albay","New Katipunan",
    "New Manay","New Panay","Paloc","Parasanon","Talian","Tandik",
    "Tigbao","Tupaz","Tupaz Proper"
  ],
  Monkayo: [
    "Awao","Babag","Banlag","Baylo","Casoon","Haguimitan","Inambatan",
    "Macopa","Mamunga","Mount Diwata","Naboc","Olaycon","Pasian",
    "Poblacion","Rizal","Salvacion","San Isidro","San Jose",
    "Tubo-tubo","Union","Upper Ulip"
  ],
  Montevista: [
    "Banagbanag","Banglasan","Bankerohan Norte","Bankerohan Sur",
    "Camansi","Camantangan","Concepcion","Dauman","Kapatagan",
    "Lebanon","Linoan","Mayaon","New Eagle","New Visayas",
    "Prosperidad","San Jose","San Vicente","Santa Maria","Tapasan","Poblacion"
  ],
  "New Bataan": [
    "Andap","Bantacan","Batinao","Cabinuangan (Poblacion)","Camanlangan",
    "Cogonon","Fatima","Kahayag","Katipunan","Magangit","Magsaysay",
    "Manurigao","Pagsabangan","Panag","San Roque","Tandawan"
  ],
  Nabunturan: [
    "Anislagan","Antiquera","Basak","Bayabas","Bukal","Cabacungan",
    "Cabidianan","Katipunan","Libasan","Linda","Magading","Magsaysay",
    "Mainit","Manat","Matilo","Mipangi","New Dauis","New Sibonga",
    "Ogao","Pangutosan","Poblacion","San Isidro","San Roque",
    "San Vicente","Santa Maria","Santo Niño (Kao)","Sasa","Tagnocon"
  ],
  Laak: [
    "Aguinaldo","Amor Cruz","Ampawid","Andap","Anitap","Bagong Silang",
    "Banbanon","Belmonte","Binasbas","Bullucan","Cebulida","Concepcion",
    "Datu Ampunan","Datu Davao","Doña Josefa","El Katipunan","Il Papa",
    "Imelda","Inacayan","Kaligutan","Kapatagan","Kidawa","Kilagding",
    "Kiokmay","Laak (Poblacion)","Langtud","Longanapan","Mabuhay",
    "Macopa","Malinao","Mangloy","Melale","Naga","New Bethlehem",
    "Panamoren","Sabud","San Antonio","Santa Emilia","Santo Niño","Sisimon"
  ],
  Mabini: [
    "Cadunan","Concepcion","Cuvia","Golden Valley (Maraut)","Libodon",
    "Pindasan","Poblacion","San Antonio","San Vicente",
    "Tagnanan (Mabini)","Del Pilar"
  ],
  Maco: [
    "Anibongan","Anislagan","Binuangan","Bucana","Calabcab","Concepcion",
    "Dumlan","Elizalde (Somil)","Gubatan","Hijo","Kinuban","Langgam",
    "Lapu-lapu","Libay-libay","Limbo","Lumatab","Magangit","Mainit",
    "Malamodao","Manipongol","Mapaang","Masara","New Asturias",
    "New Barili","Panibasan","Panoraon","Pangi (Gaudencio Antonio)",
    "Poblacion","San Juan","San Roque","Sangab","Taglawig"
  ],
  Mawab: [
    "Andili","Bawani","Concepcion","Malinawon","Nueva Visayas",
    "Nuevo Iloco","Poblacion","Salvacion","Saosao","Sawangan","Tuboran"
  ],
  Pantukan: [
    "Araibo","Bongabong","Bongbong","Kingking (Poblacion)",
    "Las Arenas","Magnaga","Matiao","Napnapan","P. Fuentes",
    "Tag-ugpo","Tagdangua","Tambongon","Tibagon"
  ]
};

  const handleSignup = (e) => {
    e.preventDefault();

    if (password !== confirmPassword) return alert("Passwords do not match!");
    if (contactNumber.length !== 11) return alert("Contact must be 11 digits!");
    if (!role) return alert("Select a role!");

    alert(
      "Sign-up needs your own backend. After you add an API, wire it in Signup.jsx (see form fields you already collect)."
    );
    navigate("/login");
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
                {Object.keys(MUNICIPALITY_DATA).map(m => (
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
                  MUNICIPALITY_DATA[municipality]?.map(b => (
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