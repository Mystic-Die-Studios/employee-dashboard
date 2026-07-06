import axios from 'axios'

// Base URL of the Django backend. Override via client/.env -> VITE_API_URL.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Shared axios instance. withCredentials sends the session cookie cross-origin;
// the backend allows this dev origin with CORS_ALLOW_CREDENTIALS=True.
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

// Auth endpoints — confirmed backend contract (see AGENT_UPDATES.md).
export const authApi = {
  // Full-page redirect that starts GitHub OAuth on the backend.
  // GET /api/auth/github/login/ -> 302 to GitHub; callback returns to /dashboard.
  githubLoginUrl: () => `${API_BASE}/api/auth/github/login/`,

  // Current session user, or throws 401 when unauthenticated.
  // GET /api/auth/me/ -> { id, login, name, avatar_url, email } | 401
  me: async () => (await api.get('/api/auth/me/')).data,

  // Sets the csrftoken cookie and returns the token, required for unsafe requests.
  // GET /api/auth/csrf/ -> { csrfToken }
  getCsrf: async () => (await api.get('/api/auth/csrf/')).data.csrfToken,

  // Clear the server session. Django SessionAuthentication requires a CSRF token
  // on unsafe methods, so fetch one first and send it as X-CSRFToken.
  // POST /api/auth/logout/ -> 204
  logout: async () => {
    const csrfToken = await authApi.getCsrf()
    await api.post('/api/auth/logout/', null, { headers: { 'X-CSRFToken': csrfToken } })
  },
}
