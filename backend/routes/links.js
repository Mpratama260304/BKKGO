const express = require('express');
const { customAlphabet } = require('nanoid');
const QRCode = require('qrcode');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const { cleanStr } = require('../utils/sanitize');

const router = express.Router();
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);

function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function aliasTaken(alias) {
  return !!db
    .prepare('SELECT id FROM links WHERE short_code = ? OR custom_alias = ?')
    .get(alias, alias);
}

// Create shortlink (auth required)
router.post('/', authRequired, (req, res) => {
  const original_url = cleanStr(req.body?.original_url, 2048);
  const custom_alias = cleanStr(req.body?.custom_alias, 32);
  const title = cleanStr(req.body?.title, 200);
  const expires_at = cleanStr(req.body?.expires_at, 40);
  const category_id = req.body?.category_id ? Number(req.body.category_id) : null;

  if (!isValidUrl(original_url)) return res.status(400).json({ error: 'Invalid URL' });

  let code;
  if (custom_alias) {
    const a = String(custom_alias).trim();
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(a))
      return res.status(400).json({ error: 'Invalid alias format' });
    if (aliasTaken(a)) return res.status(409).json({ error: 'Alias already in use' });
    code = a;
  } else {
    do {
      code = nanoid();
    } while (aliasTaken(code));
  }

  const info = db
    .prepare(
      `INSERT INTO links (user_id, original_url, short_code, custom_alias, title, expires_at, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, original_url, code, custom_alias || null, title || null, expires_at || null, category_id || null);

  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(info.lastInsertRowid);
  res.json(link);
});

// Public quick-shorten (no auth) - tagged is_guest=1 so admin UI doesn't
// misattribute the link to the system owner shown in the FK column.
router.post('/public', (req, res) => {
  // Gate via system_settings.guest_shorten_enabled (default ON).
  const flagRow = db.prepare("SELECT value FROM system_settings WHERE key = 'guest_shorten_enabled'").get();
  const guestEnabled = flagRow ? (flagRow.value === '1' || flagRow.value === 'true') : true;
  if (!guestEnabled) {
    return res.status(403).json({ error: 'Guest shortening is currently disabled. Please sign in to create links.' });
  }

  const { original_url } = req.body || {};
  if (!isValidUrl(original_url)) return res.status(400).json({ error: 'Invalid URL' });
  const owner = db.prepare("SELECT id FROM users WHERE role IN ('admin','superadmin') ORDER BY id LIMIT 1").get();
  if (!owner) return res.status(500).json({ error: 'No system owner configured' });

  let code;
  do {
    code = nanoid();
  } while (aliasTaken(code));

  const info = db
    .prepare(
      `INSERT INTO links (user_id, original_url, short_code, is_guest) VALUES (?, ?, ?, 1)`
    )
    .run(owner.id, original_url, code);
  const link = db.prepare('SELECT id, original_url, short_code, created_at FROM links WHERE id = ?').get(info.lastInsertRowid);
  res.json(link);
});

// List banners enabled (for users to select when toggling banner_ad_enabled)
router.get('/banners/available', authRequired, (req, res) => {
  const rows = db.prepare('SELECT id, name, image_path, width, height FROM banners WHERE enabled = 1 ORDER BY name').all();
  res.json(rows);
});

// List user links (excludes guest-created links so the system-owner admin
// account doesn't see anonymous public shortens in their personal dashboard).
router.get('/', authRequired, (req, res) => {
  const links = db
    .prepare('SELECT * FROM links WHERE user_id = ? AND is_guest = 0 ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(links);
});

router.get('/:id', authRequired, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });
  res.json(link);
});

router.put('/:id', authRequired, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });

  const original_url = cleanStr(req.body?.original_url, 2048);
  const custom_alias = cleanStr(req.body?.custom_alias, 32);
  const title = cleanStr(req.body?.title, 200);
  const expires_at = cleanStr(req.body?.expires_at, 40);
  const landing_delay_enabled = req.body?.landing_delay_enabled;
  const banner_ad_enabled = req.body?.banner_ad_enabled;
  const banner_id = req.body?.banner_id ? Number(req.body.banner_id) : null;

  if (original_url && !isValidUrl(original_url))
    return res.status(400).json({ error: 'Invalid URL' });

  if (custom_alias && custom_alias !== link.custom_alias) {
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(custom_alias))
      return res.status(400).json({ error: 'Invalid alias' });
    if (aliasTaken(custom_alias)) return res.status(409).json({ error: 'Alias taken' });
  }

  db.prepare(
    `UPDATE links SET
       original_url = COALESCE(?, original_url),
       custom_alias = COALESCE(?, custom_alias),
       title = COALESCE(?, title),
       expires_at = ?,
       landing_delay_enabled = COALESCE(?, landing_delay_enabled),
       banner_ad_enabled = COALESCE(?, banner_ad_enabled),
       banner_id = COALESCE(?, banner_id)
     WHERE id = ?`
  ).run(
    original_url || null,
    custom_alias || null,
    title || null,
    expires_at || link.expires_at || null,
    landing_delay_enabled == null ? null : landing_delay_enabled ? 1 : 0,
    banner_ad_enabled == null ? null : banner_ad_enabled ? 1 : 0,
    banner_id,
    link.id
  );
  res.json(db.prepare('SELECT * FROM links WHERE id = ?').get(link.id));
});

router.delete('/:id', authRequired, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
  res.json({ ok: true });
});

// QR code — default returns image inline for browser preview.
router.get('/:id/qrcode', authRequired, async (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}/${link.short_code}?qr=1`;
  const format = (req.query.format || 'png').toLowerCase();
  if (format === 'svg') {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 320 });
    res.type('svg').send(svg);
  } else {
    const buf = await QRCode.toBuffer(url, { margin: 1, width: 512 });
    res.type('png').send(buf);
  }
});

// Forced-download variant
router.get('/:id/qrcode/download', authRequired, async (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}/${link.short_code}?qr=1`;
  const buf = await QRCode.toBuffer(url, { margin: 1, width: 512 });
  res.set('Content-Disposition', `attachment; filename="bkkgo-${link.short_code}.png"`);
  res.type('png').send(buf);
});

module.exports = router;
