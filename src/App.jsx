import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleRoute from "@/components/auth/RoleRoute";

import Login from "@/pages/auth/Login";
import DashboardLayout from "@/layout/DashboardLayout";

import Dashboard from "@/pages/dashboard/Dashboard";
import CasesLogs from "@/pages/cases/CasesLogs";
import Reports from "@/pages/reports/Reports";
import Notification from "@/pages/notifications/Notification";
import AddPatient from "@/pages/patients/AddPatient";
import AccountManagement from "@/pages/admin/AccountManagement";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />

          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            )}
          >
            <Route index element={<Dashboard />} />

            <Route path="add-patient" element={<AddPatient />} />
            <Route path="report-case" element={<AddPatient />} />

            <Route path="cases" element={<CasesLogs />} />

            <Route path="reports" element={<Reports />} />

            <Route path="notification" element={<Notification />} />

            <Route
              path="account-management"
              element={(
                <RoleRoute allow={["province", "municipality"]}>
                  <AccountManagement />
                </RoleRoute>
              )}
            />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
