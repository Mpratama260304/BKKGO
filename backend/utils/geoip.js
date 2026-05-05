// Lightweight async IP → country lookup.
// Uses the free ip-api.com endpoint (no key, ~45 req/min). Results are cached
// in-process so repeat visitors don't re-trigger the lookup. Failure is silent —
// click recording must never block the redirect.
const { db } = require('../db');

const cache = new Map(); // ip -> country (string or null)
const ENABLED = process.env.GEOIP_ENABLED === '1';

function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  );
}

/**
 * Fire-and-forget lookup of the country code for a recently-recorded click row.
 * Updates clicks.country once the lookup resolves.
 */
function enrichClickAsync(clickId, ip) {
  if (!ENABLED || !clickId || isPrivateIp(ip)) return;

  if (cache.has(ip)) {
    const country = cache.get(ip);
    if (country) {
      try {
        db.prepare('UPDATE clicks SET country = ? WHERE id = ?').run(country, clickId);
      } catch { /* swallow */ }
    }
    return;
  }

  // Defer to next tick so the response is sent first.
  setImmediate(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const resp = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`,
        { signal: ctrl.signal }
      );
      clearTimeout(t);
      const data = await resp.json();
      const country = data?.status === 'success' ? (data.countryCode || data.country || null) : null;
      cache.set(ip, country);
      if (country) {
        db.prepare('UPDATE clicks SET country = ? WHERE id = ?').run(country, clickId);
      }
    } catch {
      // Ignore — geolocation is best-effort.
    }
  });
}

module.exports = { enrichClickAsync };
