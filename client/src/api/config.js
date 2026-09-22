// In production the API is served from the same origin as the app, so the base
// URL is empty and every request goes out as a relative path. In dev, Vite and
// Django run on different ports, so VITE_API_BASE_URL points at Django.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
