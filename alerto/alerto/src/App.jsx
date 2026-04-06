import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CasesLogs from "./pages/CasesLogs";
import Reports from "./pages/Reports";
import Notification from "./pages/Notification";

function App() {

  return (

    <Router>

      <Routes>

        <Route
          path="/"
          element={<Dashboard />}
        />
        
        /* Login Page */
        <Route path="/" element={<Login />} />

        /* Signup Page */
        <Route path="/signup" element={<Signup />} />

         /*Dashboard PAGE */
         <Route path="/dashboard" element={<Dashboard />} />

        <Route index element={<Dashboard />} />

        <Route path="cases" element={<CasesLogs />} />

        <Route path="reports" element={<Reports />} />

        <Route path="notification" element={<Notification />} />
      </Routes>

    </Router>

  );

}

export default App;