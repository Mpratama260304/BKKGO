// Optional Google reCAPTCHA v2/v3 verification.
// If RECAPTCHA_SECRET is not configured, verification is skipped and a flag
// is exposed via /api/auth/config so the frontend knows whether to render the widget.
const SECRET = () => process.env.RECAPTCHA_SECRET || '';

async function verifyCaptcha(token, ip) {
  if (!SECRET()) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'Missing captcha token' };
  try {
    const params = new URLSearchParams({ secret: SECRET(), response: token });
    if (ip) params.set('remoteip', ip);
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await res.json();
    if (!json.success) return { ok: false, error: 'Captcha failed' };
    // For v3, also check score
    if (json.score != null && json.score < 0.4) return { ok: false, error: 'Captcha score too low' };
    return { ok: true };
  } catch (err) {
    console.error('[captcha] verify error:', err.message);
    return { ok: false, error: 'Captcha service unavailable' };
  }
}

module.exports = { verifyCaptcha };
