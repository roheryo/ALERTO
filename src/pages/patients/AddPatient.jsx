import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sessionUserFromAuth } from "../../lib/authUser";
import ReportCaseForm from "../../components/report/ReportCaseForm";
import "./AddPatient.css";

/**
 * Report case route — hosts the multi-step wizard (reference layout lives in ReportCaseForm).
 * Provincial users are redirected to the dashboard; barangay/municipal users stay here.
 */
export default function AddPatient() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = sessionUserFromAuth(authUser);

  const role = String(user?.role ?? "").toLowerCase();
  const roleKey = role.includes("barangay")
    ? "barangay"
    : role.includes("municipal")
      ? "municipal"
      : "provincial";

  useEffect(() => {
    if (roleKey === "provincial") {
      navigate("/dashboard", { replace: true });
    }
  }, [roleKey, navigate]);

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
