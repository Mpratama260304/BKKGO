const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authRequired, requireRole, signToken } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, requireRole('admin', 'superadmin'));

router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const links = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
  const clicks = db.prepare('SELECT COALESCE(SUM(click_count),0) AS c FROM links').get().c;
  const topLinks = db
    .prepare(
      `SELECT l.id, l.short_code, l.original_url, l.click_count, u.email AS owner
       FROM links l JOIN users u ON u.id = l.user_id
       ORDER BY l.click_count DESC LIMIT 10`
    )
    .all();
  const byDay = db
    .prepare(
      `SELECT date(clicked_at) AS day, COUNT(*) AS clicks
       FROM clicks GROUP BY day ORDER BY day DESC LIMIT 30`
    )
    .all()
    .reverse();
  res.json({ users, links, clicks, topLinks, byDay });
});

router.get('/users', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.is_blocked, u.created_at,
              (SELECT COUNT(*) FROM links WHERE user_id = u.id) AS link_count
       FROM users u ORDER BY u.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.put('/users/:id', (req, res) => {
  const { is_blocked, role } = req.body || {};
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  // Only superadmin can change roles or touch other admins
  if (target.role !== 'user' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can modify admin accounts' });
  if (role && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can change roles' });

  db.prepare('UPDATE users SET is_blocked = COALESCE(?, is_blocked), role = COALESCE(?, role) WHERE id = ?')
    .run(is_blocked == null ? null : is_blocked ? 1 : 0, role || null, target.id);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.role !== 'user' && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Only superadmin can delete admins' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

router.get('/links', (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, u.email AS owner FROM links l
       JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT 500`
    )
    .all();
  res.json(rows);
});

router.put('/links/:id/block', (req, res) => {
  const { is_blocked } = req.body || {};
  db.prepare('UPDATE links SET is_blocked = ? WHERE id = ?').run(is_blocked ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/links/:id', (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Impersonate: returns a JWT for the target user (superadmin only)
router.post('/impersonate/:id', requireRole('superadmin'), (req, res) => {
  const target = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  const token = signToken(target);
  res.json({ token, user: target });
});

module.exports = router;
