import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Gate for authenticated routes. Redirects to the landing/login page when
// there is no session. Renders nested routes via <Outlet /> once authenticated.
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  return <Outlet />
}
