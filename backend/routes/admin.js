// =============================================================================
// Admin & Superadmin routes
// All endpoints here require role 'admin' or 'superadmin'.
// Superadmin-only actions: change roles, modify/delete other admins, impersonate.
// Every mutating action is recorded via logActivity() for the Activity Logs UI.
// =============================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { authRequired, requireRole, signToken } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();
router.use(authRequired, requireRole('admin', 'superadmin'));

// ----- Overview / global stats --------------------------------------------------
router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const links = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
  const clicks = db.prepare('SELECT COALESCE(SUM(click_count),0) AS c FROM links').get().c;
  const uniqueVisitors = db
    .prepare('SELECT COUNT(DISTINCT ip_address) AS c FROM clicks').get().c;

  const topLinks = db.prepare(`
    SELECT l.id, l.short_code, l.original_url, l.click_count, u.email AS owner
    FROM links l JOIN users u ON u.id = l.user_id
    ORDER BY l.click_count DESC LIMIT 10
  `).all();

  const byDay = db.prepare(`
    SELECT date(clicked_at) AS day, COUNT(*) AS clicks
    FROM clicks GROUP BY day ORDER BY day DESC LIMIT 30
  `).all().reverse();

  const recentLogs = db.prepare(`
    SELECT id, actor_email, action, target_type, target_id, created_at
    FROM activity_logs ORDER BY created_at DESC LIMIT 8
  `).all();

  const expiringSoon = db.prepare(`
    SELECT id, short_code, expires_at FROM links
    WHERE expires_at IS NOT NULL AND expires_at > datetime('now')
      AND expires_at < datetime('now', '+7 days')
    ORDER BY expires_at ASC LIMIT 10
  `).all();

  res.json({ users, links, clicks, uniqueVisitors, topLinks, byDay, recentLogs, expiringSoon });
});

// ----- Users --------------------------------------------------------------------
router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.is_blocked, u.created_at,
           (SELECT COUNT(*) FROM links WHERE user_id = u.id) AS link_count,
           (SELECT COALESCE(SUM(click_count),0) FROM links WHERE user_id = u.id) AS total_clicks
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json(rows);
});

router.put('/users/:id', (req, res) => {
  const { name, email, is_blocked, role } = req.body || {};
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });

  // Only superadmin may modify other admin/superadmin or change roles
  if (target.role !== 'user' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can modify admin accounts' });
  if (role && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can change roles' });

  if (email && email !== target.email) {
    const dupe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (dupe) return res.status(409).json({ error: 'Email already in use' });
  }

  db.prepare(`
    UPDATE users SET
      name        = COALESCE(?, name),
      email       = COALESCE(?, email),
      is_blocked  = COALESCE(?, is_blocked),
      role        = COALESCE(?, role)
    WHERE id = ?
  `).run(
    name || null,
    email || null,
    is_blocked == null ? null : is_blocked ? 1 : 0,
    role || null,
    target.id
  );

  logActivity(req, 'user.update', 'user', target.id, { name, email, is_blocked, role });
  res.json({ ok: true });
});

// Reset password — generates a temporary password and returns it once
router.post('/users/:id/reset-password', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.role !== 'user' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can reset admin passwords' });

  const tempPassword = crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
  const hash = bcrypt.hashSync(tempPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, target.id);
  logActivity(req, 'user.reset_password', 'user', target.id);
  res.json({ ok: true, temp_password: tempPassword });
});

router.delete('/users/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.role !== 'user' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can delete admins' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  logActivity(req, 'user.delete', 'user', target.id, { email: target.email });
  res.json({ ok: true });
});

// ----- Links --------------------------------------------------------------------
router.get('/links', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.email AS owner, c.name AS category_name, c.color AS category_color
    FROM links l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN categories c ON c.id = l.category_id
    ORDER BY l.created_at DESC
  `).all();
  res.json(rows);
});

router.put('/links/:id', (req, res) => {
  const { original_url, custom_alias, title, expires_at, category_id } = req.body || {};
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });

  if (custom_alias && custom_alias !== link.custom_alias) {
    const taken = db.prepare('SELECT id FROM links WHERE (short_code = ? OR custom_alias = ?) AND id != ?')
      .get(custom_alias, custom_alias, link.id);
    if (taken) return res.status(409).json({ error: 'Alias taken' });
  }

  db.prepare(`
    UPDATE links SET
      original_url = COALESCE(?, original_url),
      custom_alias = COALESCE(?, custom_alias),
      title        = COALESCE(?, title),
      expires_at   = ?,
      category_id  = ?
    WHERE id = ?
  `).run(
    original_url || null,
    custom_alias || null,
    title || null,
    expires_at || link.expires_at || null,
    category_id ?? link.category_id ?? null,
    link.id
  );

  logActivity(req, 'link.update', 'link', link.id, { original_url, custom_alias, category_id });
  res.json(db.prepare('SELECT * FROM links WHERE id = ?').get(link.id));
});

router.put('/links/:id/block', (req, res) => {
  const { is_blocked } = req.body || {};
  db.prepare('UPDATE links SET is_blocked = ? WHERE id = ?').run(is_blocked ? 1 : 0, req.params.id);
  logActivity(req, is_blocked ? 'link.block' : 'link.unblock', 'link', Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/links/:id', (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
  logActivity(req, 'link.delete', 'link', link.id, { short_code: link.short_code });
  res.json({ ok: true });
});

// ----- Categories ---------------------------------------------------------------
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM links WHERE category_id = c.id) AS link_count
    FROM categories c ORDER BY c.name
  `).all();
  res.json(rows);
});

router.post('/categories', (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
      .run(name.trim(), color || '#2563eb');
    logActivity(req, 'category.create', 'category', info.lastInsertRowid, { name });
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(409).json({ error: 'Category already exists' });
  }
});

router.put('/categories/:id', (req, res) => {
  const { name, color } = req.body || {};
  db.prepare('UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
    .run(name || null, color || null, req.params.id);
  logActivity(req, 'category.update', 'category', Number(req.params.id), { name, color });
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logActivity(req, 'category.delete', 'category', Number(req.params.id));
  res.json({ ok: true });
});

// ----- Activity logs ------------------------------------------------------------
router.get('/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`
    SELECT id, actor_id, actor_email, action, target_type, target_id, details, ip_address, created_at
    FROM activity_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

router.delete('/logs', requireRole('superadmin'), (req, res) => {
  db.prepare('DELETE FROM activity_logs').run();
  res.json({ ok: true });
});

// ----- Analytics over time (admin) ---------------------------------------------
router.get('/analytics', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const byDay = db.prepare(`
    SELECT date(clicked_at) AS day,
           COUNT(*) AS clicks,
           COUNT(DISTINCT ip_address) AS unique_visitors,
           SUM(CASE WHEN is_qr = 1 THEN 1 ELSE 0 END) AS qr_scans
    FROM clicks
    WHERE clicked_at > datetime('now', ?)
    GROUP BY day ORDER BY day ASC
  `).all(`-${days} days`);

  const byCategory = db.prepare(`
    SELECT COALESCE(c.name, 'Uncategorized') AS name,
           COUNT(l.id) AS link_count,
           COALESCE(SUM(l.click_count),0) AS clicks
    FROM links l LEFT JOIN categories c ON c.id = l.category_id
    GROUP BY c.id ORDER BY clicks DESC
  `).all();

  res.json({ byDay, byCategory });
});

// ----- Impersonation (superadmin only) ------------------------------------------
router.post('/impersonate/:id', requireRole('superadmin'), (req, res) => {
  const target = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  const token = signToken(target);
  logActivity(req, 'user.impersonate', 'user', target.id, { email: target.email });
  res.json({ token, user: target });
});

// ----- QR generation accessible to admins for any link -------------------------
router.get('/links/:id/qrcode', async (req, res) => {
  const QRCode = require('qrcode');
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}/${link.short_code}?qr=1`;
  const format = (req.query.format || 'png').toLowerCase();
  if (format === 'svg') {
    res.type('svg').send(await QRCode.toString(url, { type: 'svg', margin: 1, width: 320 }));
  } else {
    res.type('png').send(await QRCode.toBuffer(url, { margin: 1, width: 512 }));
  }
});

module.exports = router;
