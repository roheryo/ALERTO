import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { AuthProvider } from "@/context/AuthContext";
import { PatientsProvider } from "@/context/PatientsContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleRoute from "@/components/auth/RoleRoute";

import Login from "@/pages/auth/Login";
import DashboardLayout from "@/layout/DashboardLayout";

import Dashboard from "@/pages/dashboard/Dashboard";
import MunicipalSurveillanceMap from "@/pages/dashboard/MunicipalSurveillanceMap";
import ProvincialRankings from "@/pages/dashboard/ProvincialRankings";
import ProvincialMapPage from "@/pages/dashboard/ProvincialMapPage";
import ProvincialCoordination from "@/pages/dashboard/ProvincialCoordination";
import CasesLogs from "@/pages/cases/CasesLogs";
import Reports from "@/pages/reports/Reports";
import AddPatient from "@/pages/patients/AddPatient";

import AccountManagement from "@/pages/admin/AccountManagement";
import MunicipalAlerts from "@/pages/alerts/MunicipalAlerts";

function App() {
  return (
    <Router>
      <AuthProvider>
        <PatientsProvider>
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

            <Route
              path="surveillance-map"
              element={(
                <RoleRoute allow={["municipality"]}>
                  <MunicipalSurveillanceMap />
                </RoleRoute>
              )}
            />

            <Route
              path="alerts"
              element={(
                <RoleRoute allow={["municipality"]}>
                  <MunicipalAlerts />
                </RoleRoute>
              )}
            />

            <Route
              path="province-rankings"
              element={(
                <RoleRoute allow={["province"]}>
                  <ProvincialRankings />
                </RoleRoute>
              )}
            />
            <Route
              path="province-map"
              element={(
                <RoleRoute allow={["province"]}>
                  <ProvincialMapPage />
                </RoleRoute>
              )}
            />
            <Route
              path="province-coordination"
              element={(
                <RoleRoute allow={["province"]}>
                  <ProvincialCoordination />
                </RoleRoute>
              )}
            />

            <Route
              path="add-patient"
              element={(
                <RoleRoute allow={["barangay"]}>
                  <AddPatient />
                </RoleRoute>
              )}
            />
            <Route
              path="report-case"
              element={(
                <RoleRoute allow={["barangay"]}>
                  <AddPatient />
                </RoleRoute>
              )}
            />

            <Route path="cases" element={<CasesLogs />} />

            <Route path="reports" element={<Reports />} />

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
        </PatientsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
