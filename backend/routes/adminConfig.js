// Admin: CAPTCHA settings (recaptcha / hcaptcha / turnstile) and banner ad management.
// All routes require admin or superadmin.
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');
const { cleanStr } = require('../utils/sanitize');

const router = express.Router();
router.use(authRequired, requireRole('admin', 'superadmin'));

// ----- CAPTCHA settings ---------------------------------------------------------
const PROVIDERS = ['recaptcha', 'hcaptcha', 'turnstile'];

router.get('/captcha-settings', (req, res) => {
  const rows = db.prepare('SELECT id, provider, site_key, secret_key, enabled, updated_at FROM captcha_settings').all();
  // Mask secret in response
  rows.forEach(r => { if (r.secret_key) r.secret_key_masked = '••••' + r.secret_key.slice(-4); delete r.secret_key; });
  res.json(rows);
});

router.post('/captcha-settings', (req, res) => {
  const provider = cleanStr(req.body?.provider, 20);
  const site_key = cleanStr(req.body?.site_key, 200);
  const secret_key = cleanStr(req.body?.secret_key, 200);
  const enabled = req.body?.enabled ? 1 : 0;
  if (!PROVIDERS.includes(provider))
    return res.status(400).json({ error: 'Unsupported provider' });

  // Upsert by provider
  const existing = db.prepare('SELECT id FROM captcha_settings WHERE provider = ?').get(provider);
  if (existing) {
    db.prepare(`
      UPDATE captcha_settings
      SET site_key = ?, secret_key = COALESCE(?, secret_key), enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE provider = ?
    `).run(site_key, secret_key || null, enabled, provider);
  } else {
    db.prepare('INSERT INTO captcha_settings (provider, site_key, secret_key, enabled) VALUES (?, ?, ?, ?)')
      .run(provider, site_key, secret_key || null, enabled);
  }

  // Enforce single-active-provider: if enabling this one, disable others
  if (enabled) {
    db.prepare('UPDATE captcha_settings SET enabled = 0 WHERE provider != ?').run(provider);
  }

  logActivity(req, 'captcha.update', 'captcha', null, { provider, enabled });
  res.json({ ok: true });
});

router.delete('/captcha-settings/:provider', (req, res) => {
  db.prepare('DELETE FROM captcha_settings WHERE provider = ?').run(req.params.provider);
  logActivity(req, 'captcha.delete', 'captcha', null, { provider: req.params.provider });
  res.json({ ok: true });
});

// ----- Banner ads ---------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'banners');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) ? ext : '.png';
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    cb(null, `${id}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
});

router.get('/banners', (req, res) => {
  const rows = db.prepare('SELECT * FROM banners ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/banners', upload.single('image'), (req, res) => {
  const name = cleanStr(req.body?.name, 100) || 'Untitled banner';
  const link_url = cleanStr(req.body?.link_url, 2048);
  const width = req.body?.width ? Number(req.body.width) : null;
  const height = req.body?.height ? Number(req.body.height) : null;
  const enabled = req.body?.enabled === 'false' ? 0 : 1;
  if (!req.file) return res.status(400).json({ error: 'Image file required (field: image)' });
  const image_path = `/uploads/banners/${req.file.filename}`;
  const info = db
    .prepare('INSERT INTO banners (name, image_path, link_url, width, height, enabled) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, image_path, link_url || null, width, height, enabled);
  logActivity(req, 'banner.create', 'banner', info.lastInsertRowid, { name });
  res.json(db.prepare('SELECT * FROM banners WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/banners/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const name = cleanStr(req.body?.name, 100);
  const link_url = cleanStr(req.body?.link_url, 2048);
  const enabled = req.body?.enabled == null ? null : (req.body.enabled ? 1 : 0);
  db.prepare('UPDATE banners SET name = COALESCE(?, name), link_url = COALESCE(?, link_url), enabled = COALESCE(?, enabled) WHERE id = ?')
    .run(name || null, link_url || null, enabled, b.id);
  logActivity(req, 'banner.update', 'banner', b.id, req.body);
  res.json({ ok: true });
});

router.delete('/banners/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM banners WHERE id = ?').run(b.id);
  // Best-effort filesystem cleanup
  try {
    const fp = path.join(__dirname, '..', b.image_path.replace(/^\//, ''));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {}
  logActivity(req, 'banner.delete', 'banner', b.id);
  res.json({ ok: true });
});

module.exports = router;
