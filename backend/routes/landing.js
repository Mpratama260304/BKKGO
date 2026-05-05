// Public route: returns minimal info needed to render the landing/countdown page.
// Frontend at /l/:code calls this, then JS performs window.location = original_url after countdown.
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/landing/:code', (req, res) => {
  const code = req.params.code;
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(code)) return res.status(400).json({ error: 'Invalid code' });

  const link = db.prepare(`
    SELECT l.id, l.short_code, l.original_url, l.title, l.is_blocked, l.expires_at,
           l.landing_delay_enabled, l.banner_ad_enabled, l.banner_id,
           b.image_path AS banner_image, b.link_url AS banner_link,
           b.width AS banner_width, b.height AS banner_height
    FROM links l
    LEFT JOIN banners b ON b.id = l.banner_id AND b.enabled = 1
    WHERE l.short_code = ? OR l.custom_alias = ?
  `).get(code, code);

  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.is_blocked) return res.status(410).json({ error: 'blocked' });
  if (link.expires_at && new Date(link.expires_at) < new Date())
    return res.status(410).json({ error: 'expired' });

  res.json({
    id: link.id,
    short_code: link.short_code,
    original_url: link.original_url,
    title: link.title,
    landing_delay_enabled: !!link.landing_delay_enabled,
    banner_ad_enabled: !!link.banner_ad_enabled,
    banner: link.banner_ad_enabled && link.banner_image ? {
      image_path: link.banner_image,
      link_url: link.banner_link,
      width: link.banner_width,
      height: link.banner_height,
    } : null,
  });
});

// Record click separately when landing page actually performs the redirect.
router.post('/landing/:code/click', (req, res) => {
  const code = req.params.code;
  const link = db.prepare('SELECT * FROM links WHERE short_code = ? OR custom_alias = ?').get(code, code);
  if (!link) return res.status(404).json({ error: 'Not found' });

  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || '';

  const seen = db.prepare('SELECT 1 FROM clicks WHERE link_id = ? AND ip_address = ? LIMIT 1').get(link.id, ip);
  db.prepare(
    `INSERT INTO clicks (link_id, ip_address, user_agent, referrer, country, is_qr) VALUES (?, ?, ?, ?, ?, 0)`
  ).run(link.id, ip, ua, referrer, null);
  if (seen) {
    db.prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?').run(link.id);
  } else {
    db.prepare('UPDATE links SET click_count = click_count + 1, unique_click_count = unique_click_count + 1 WHERE id = ?').run(link.id);
  }
  res.json({ ok: true });
});

module.exports = router;
