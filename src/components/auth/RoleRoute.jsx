import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RoleRoute({ allow, children }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
