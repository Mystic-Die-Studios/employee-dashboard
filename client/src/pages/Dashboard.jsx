import { Navigate, useOutletContext } from "react-router-dom";
import Workspace from "../components/Workspace";

export default function DashboardPage() {
  const { user, logout } = useOutletContext();
  if (!user) return <Navigate to="/" replace />;
  return <Workspace user={user} onLogout={logout} />;
}
