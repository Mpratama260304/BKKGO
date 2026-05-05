// DB-driven CAPTCHA verification.
// Reads enabled provider from `captcha_settings` table; falls back to env (legacy reCAPTCHA).
// Supports: recaptcha (Google v2/v3), hcaptcha, turnstile (Cloudflare).
const { db } = require('../db');

function getEnabledProvider() {
  const row = db.prepare('SELECT * FROM captcha_settings WHERE enabled = 1 LIMIT 1').get();
  if (row) return row;
  if (process.env.RECAPTCHA_SECRET) {
    return {
      provider: 'recaptcha',
      site_key: process.env.RECAPTCHA_SITE_KEY || null,
      secret_key: process.env.RECAPTCHA_SECRET,
      enabled: 1,
    };
  }
  return null;
}

function getPublicConfig() {
  const p = getEnabledProvider();
  if (!p) return { enabled: false, provider: null, siteKey: null };
  return { enabled: true, provider: p.provider, siteKey: p.site_key };
}

const VERIFY_URLS = {
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  hcaptcha: 'https://hcaptcha.com/siteverify',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
};

async function verifyCaptcha(token, ip) {
  const cfg = getEnabledProvider();
  if (!cfg) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'Missing captcha token' };
  const url = VERIFY_URLS[cfg.provider];
  if (!url) return { ok: false, error: 'Unknown captcha provider' };
  try {
    const params = new URLSearchParams({ secret: cfg.secret_key || '', response: token });
    if (ip) params.set('remoteip', ip);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await res.json();
    if (!json.success) return { ok: false, error: 'Captcha failed' };
    if (json.score != null && json.score < 0.4) return { ok: false, error: 'Captcha score too low' };
    return { ok: true };
  } catch (err) {
    console.error('[captcha] verify error:', err.message);
    return { ok: false, error: 'Captcha service unavailable' };
  }
}

module.exports = { verifyCaptcha, getPublicConfig, getEnabledProvider };
