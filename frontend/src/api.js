const TOKEN_KEY = 'bkkgo_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Build the public short URL.
// In production the backend serves the bare /:code redirect (clean short links
// like https://bkkgo.link/abc123). In Vite dev mode (port 5173) the dev server
// would intercept bare paths, so we fall back to the /r/ prefix which is
// proxied to the backend. Backend supports BOTH /:code and /r/:code.
export function shortUrl(code) {
  const origin = window.location.origin;
  const isViteDev = window.location.port === '5173';
  return isViteDev ? `${origin}/r/${code}` : `${origin}/${code}`;
}
