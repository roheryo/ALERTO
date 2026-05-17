import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sessionUserFromAuth } from "../../lib/authUser";
import ReportCaseForm from "../../components/report/ReportCaseForm";
import "./AddPatient.css";

/**
 * Report case route — barangay BHU encoding only (guarded by RoleRoute in App.jsx).
 */
export default function AddPatient() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = sessionUserFromAuth(authUser);

  const formUser = useMemo(
    () => ({
      ...user,
      province: user?.provinceName ?? user?.province ?? "Davao de Oro"
    }),
    [user]
  );

  return (
    <div className="add-patient-page">
      <ReportCaseForm
        user={formUser}
        onSubmitted={() => {
          navigate("/dashboard/cases");
        }}
      />
    </div>
  );
}
