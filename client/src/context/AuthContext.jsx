import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi } from '../api/client.js'

const AuthContext = createContext(null)

// Temporary stand-in so the protected dashboard is previewable before the
// backend OAuth flow exists. Remove once /api/auth/me/ is live.
const DEMO_USER = {
  id: 0,
  login: 'demo-employee',
  name: 'Demo Employee',
  avatar_url: null,
  email: 'demo@mysticdie.example',
  demo: true,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On load: restore a demo session, else probe the real backend session.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const demo = localStorage.getItem('demoUser')
      if (demo) {
        if (!cancelled) {
          setUser(JSON.parse(demo))
          setLoading(false)
        }
        return
      }
      try {
        const me = await authApi.me()
        if (!cancelled) setUser(me)
      } catch {
        // Not authenticated (or backend not ready yet) — stay logged out.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const loginWithGitHub = useCallback(() => {
    // Hand off to the backend, which redirects to GitHub and back to /dashboard.
    window.location.href = authApi.githubLoginUrl()
  }, [])

  const loginAsDemo = useCallback(() => {
    localStorage.setItem('demoUser', JSON.stringify(DEMO_USER))
    setUser(DEMO_USER)
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem('demoUser')
    if (user && !user.demo) {
      try {
        await authApi.logout()
      } catch {
        // ignore — clear local state regardless
      }
    }
    setUser(null)
  }, [user])

  const value = { user, loading, loginWithGitHub, loginAsDemo, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
