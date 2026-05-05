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
// We use the /r/ prefix so the link works both in:
//   - dev (Vite proxies /r → backend on :4000)
//   - production single-process (backend serves /r/:code AND /:code)
// Backend also accepts the bare /:code form for compatibility / external use.
export function shortUrl(code) {
  return `${window.location.origin}/r/${code}`;
}
