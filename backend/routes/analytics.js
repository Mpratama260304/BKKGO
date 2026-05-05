const express = require('express');
const { db } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

function ownsOrAdmin(req, link) {
  return link && (link.user_id === req.user.id || ['admin', 'superadmin'].includes(req.user.role));
}

router.get('/links/:id/stats', authRequired, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (!ownsOrAdmin(req, link)) return res.status(403).json({ error: 'Forbidden' });

  const total = link.click_count;
  const unique = link.unique_click_count;
  const qrScans = db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE link_id = ? AND is_qr = 1').get(link.id).c;
  const byDay = db
    .prepare(
      `SELECT date(clicked_at) AS day, COUNT(*) AS clicks
       FROM clicks WHERE link_id = ?
       GROUP BY day ORDER BY day DESC LIMIT 30`
    )
    .all(link.id);
  const topReferrers = db
    .prepare(
      `SELECT COALESCE(NULLIF(referrer,''),'Direct') AS referrer, COUNT(*) AS c
       FROM clicks WHERE link_id = ?
       GROUP BY referrer ORDER BY c DESC LIMIT 10`
    )
    .all(link.id);
  const recent = db
    .prepare('SELECT ip_address, user_agent, referrer, country, is_qr, clicked_at FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT 25')
    .all(link.id);

  res.json({ link, total, unique, qrScans, byDay: byDay.reverse(), topReferrers, recent });
});

router.get('/users/:id/stats', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Forbidden' });
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total_links,
              COALESCE(SUM(click_count),0) AS total_clicks,
              COALESCE(SUM(unique_click_count),0) AS unique_clicks
       FROM links WHERE user_id = ?`
    )
    .get(id);
  const top = db
    .prepare(
      `SELECT id, short_code, original_url, click_count
       FROM links WHERE user_id = ? ORDER BY click_count DESC LIMIT 5`
    )
    .all(id);
  res.json({ ...totals, top });
});

// Export user clicks as CSV
router.get('/links/:id/export.csv', authRequired, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (!ownsOrAdmin(req, link)) return res.status(403).json({ error: 'Forbidden' });
  const rows = db.prepare('SELECT clicked_at, ip_address, country, referrer, is_qr, user_agent FROM clicks WHERE link_id = ?').all(link.id);
  const header = 'clicked_at,ip,country,referrer,is_qr,user_agent\n';
  const csv = rows
    .map(r =>
      [r.clicked_at, r.ip_address, r.country, r.referrer, r.is_qr, JSON.stringify(r.user_agent || '')]
        .map(v => (v == null ? '' : String(v).replace(/,/g, ' ')))
        .join(',')
    )
    .join('\n');
  res.type('text/csv').send(header + csv);
});

module.exports = router;
