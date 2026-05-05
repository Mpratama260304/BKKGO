// Authentication routes — register, login, profile, password & API key.
// Optional Google reCAPTCHA on register/login (active only when RECAPTCHA_SECRET is set).
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const { cleanStr } = require('../utils/sanitize');
const { verifyCaptcha, getPublicConfig } = require('../utils/captcha');

const router = express.Router();

// Helper: read a system_settings flag with default.
function getFlag(key, fallback) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  return row.value === '1' || row.value === 'true';
}

// Public config so frontend knows whether to render the captcha widget
// and whether to show the registration form.
router.get('/config', (req, res) => {
  const c = getPublicConfig();
  res.json({
    recaptchaEnabled: c.enabled,
    recaptchaSiteKey: c.siteKey,
    captcha: c, // { enabled, provider, siteKey }
    registrationEnabled: getFlag('registration_enabled', true),
  });
});

router.post('/register', async (req, res) => {
  // Superadmin can disable self-service registration entirely.
  if (!getFlag('registration_enabled', true)) {
    return res.status(403).json({ error: 'Registration is currently disabled' });
  }
  const name = cleanStr(req.body?.name, 80);
  const email = cleanStr(req.body?.email, 200)?.toLowerCase();
  const password = req.body?.password;
  const captchaToken = req.body?.captchaToken;

  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

  const captcha = await verifyCaptcha(captchaToken, req.ip);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const apiKey = crypto.randomBytes(24).toString('hex');
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role, api_key) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, hash, 'user', apiKey);

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  res.json({ token, user });
});

router.post('/login', async (req, res) => {
  const email = cleanStr(req.body?.email, 200)?.toLowerCase();
  const password = req.body?.password;
  const captchaToken = req.body?.captchaToken;

  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const captcha = await verifyCaptcha(captchaToken, req.ip);
  if (!captcha.ok) return res.status(400).json({ error: captcha.error });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || user.is_blocked) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.post('/forgot-password', (req, res) => {
  // Generate a single-use reset token. The token itself is returned ONLY in the
  // response (and logged server-side) so an admin can deliver it manually until
  // an SMTP integration is wired up. The DB stores only the SHA-256 hash.
  const email = cleanStr(req.body?.email, 200)?.toLowerCase();
  // Always respond identically to prevent email enumeration.
  const generic = { ok: true, message: 'If the email exists, a reset link has been issued.' };
  if (!email) return res.json(generic);

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  if (!user) return res.json(generic);

  const token = crypto.randomBytes(24).toString('hex'); // 48 chars
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  // Invalidate any prior outstanding tokens for this user.
  db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id);
  db.prepare(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, tokenHash, expiresAt);

  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${base}/reset-password?token=${token}`;
  console.log(`[password-reset] ${user.email} → ${resetUrl}`);

  // In dev / when no SMTP is configured, return the token so it can be tested.
  if (process.env.NODE_ENV !== 'production') {
    return res.json({ ...generic, dev_token: token, dev_reset_url: resetUrl });
  }
  res.json(generic);
});

router.post('/reset-password', (req, res) => {
  const token = (req.body?.token || '').toString();
  const newPassword = req.body?.newPassword;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Invalid token or password too short' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`
    SELECT pr.*, u.id AS uid FROM password_resets pr
    JOIN users u ON u.id = pr.user_id
    WHERE pr.token_hash = ?
  `).get(tokenHash);
  if (!row) return res.status(400).json({ error: 'Invalid or expired token' });
  if (row.used_at) return res.status(400).json({ error: 'Token already used' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Token expired' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.uid);
  db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// Logout is client-side (token discard). Endpoint kept for symmetry / future server-side blacklist.
router.post('/logout', (req, res) => res.json({ ok: true }));

router.get('/me', authRequired, (req, res) => {
  const u = db
    .prepare('SELECT id, name, email, role, api_key, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(u);
});

router.post('/change-password', authRequired, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password too short' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash))
    return res.status(401).json({ error: 'Current password incorrect' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

router.post('/regenerate-api-key', authRequired, (req, res) => {
  const apiKey = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(apiKey, req.user.id);
  res.json({ api_key: apiKey });
});

module.exports = router;
