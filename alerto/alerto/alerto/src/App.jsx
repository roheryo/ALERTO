import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import DashboardLayout from "./layout/DashboardLayout";

import Dashboard from "./pages/Dashboard";
import CasesLogs from "./pages/CasesLogs";
import Reports from "./pages/Reports";
import Notification from "./pages/Notification";

function App() {
  return (
    <Router>

      <Routes>

        {/* Public Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Dashboard Layout */}
        <Route path="/" element={<DashboardLayout />}>

          {/* Default page */}
          <Route index element={<Dashboard />} />

          <Route path="cases" element={<CasesLogs />} />

          <Route path="reports" element={<Reports />} />

          <Route path="notification" element={<Notification />} />

        </Route>

      </Routes>

    </Router>
  );
}

export default App;