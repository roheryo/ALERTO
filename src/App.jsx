import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./Components/LoginPage/login";
import Dashboard from "./Components/DashboardPage/dashboard";
import PatientInfo from "./Components/PatientPage/PatientInfo";
import PatientLogs from "./Components/LogsPage/PatientLogs";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<PatientInfo />} />
        <Route path="/logs" element={<PatientLogs />} />
      </Routes>
    </Router>
  );
}

export default App;
