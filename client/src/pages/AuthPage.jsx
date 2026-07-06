import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'

// Human-readable messages for the ?error= codes the backend redirects with
// (e.g. after a failed or blocked GitHub sign-in).
const ERROR_MESSAGES = {
  not_org_member:
    "That GitHub account isn't a member of the Mystic Die Studios organization.",
  invalid_state: 'Your sign-in session expired. Please try again.',
  token_exchange_failed: 'Could not complete GitHub sign-in. Please try again.',
  profile_fetch_failed: 'Could not read your GitHub profile. Please try again.',
  access_denied: 'GitHub sign-in was cancelled.',
}

// Public landing / login page. Sends already-authenticated users to /dashboard.
export default function AuthPage() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const error = params.get('error')

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-xl bg-violet-600 text-lg font-bold text-white">
          MD
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Employee Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Mystic Die Studios — sign in with your GitHub account to continue.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
            {ERROR_MESSAGES[error] || 'Sign-in failed. Please try again.'}
          </div>
        )}

        <div className="mt-8">
          <AuthForm />
        </div>
      </div>
    </div>
  )
}
