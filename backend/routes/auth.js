// Authentication routes — register, login, profile, password & API key.
// Optional Google reCAPTCHA on register/login (active only when RECAPTCHA_SECRET is set).
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const { cleanStr } = require('../utils/sanitize');
const { verifyCaptcha } = require('../utils/captcha');

const router = express.Router();

// Public config so frontend knows whether to render the captcha widget.
router.get('/config', (req, res) => {
  res.json({
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null,
    recaptchaEnabled: !!process.env.RECAPTCHA_SECRET,
  });
});

router.post('/register', async (req, res) => {
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
  // Stub: in production, send email with reset token (SMTP / SES).
  res.json({ ok: true, message: 'If the email exists, a reset link has been sent.' });
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
