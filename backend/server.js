require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { db, seedDefaults } = require('./db');
const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const adminConfigRoutes = require('./routes/adminConfig');
const landingRoutes = require('./routes/landing');

seedDefaults();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const publicShortenLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
// Per-IP rate limit for authenticated link creation to mitigate abuse via stolen API keys.
const createLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => req.method !== 'POST' || req.path !== '/',
});
// Generous limit on redirects so legitimate traffic isn't throttled but bots are slowed.
const redirectLimiter = rateLimit({ windowMs: 60 * 1000, max: 240 });

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'BKKGO' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/links/public', publicShortenLimiter);
app.use('/api/links', createLinkLimiter, linkRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', landingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminConfigRoutes);

// Static uploads (banner images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public redirect handler.
// Supports BOTH /:code AND /r/:code patterns. Apply the redirect rate limiter.
function handleRedirect(req, res, next) {
  const code = req.params.code;
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(code)) return next();

  const link = db
    .prepare('SELECT * FROM links WHERE short_code = ? OR custom_alias = ?')
    .get(code, code);
  if (!link) return next();
  if (link.is_blocked) return next();
  if (link.expires_at && new Date(link.expires_at) < new Date()) return next();

  // If landing page is enabled (or banner ad enabled), redirect to SPA landing route
  // and let the React landing page handle the countdown + click logging.
  if (link.landing_delay_enabled || link.banner_ad_enabled) {
    return res.redirect(302, `/l/${link.short_code}`);
  }

  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || '';
  const isQr = req.query.qr === '1' ? 1 : 0;

  const seen = db
    .prepare('SELECT 1 FROM clicks WHERE link_id = ? AND ip_address = ? LIMIT 1')
    .get(link.id, ip);

  db.prepare(
    `INSERT INTO clicks (link_id, ip_address, user_agent, referrer, country, is_qr)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(link.id, ip, ua, referrer, null, isQr);

  if (seen) {
    db.prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?').run(link.id);
  } else {
    db.prepare(
      'UPDATE links SET click_count = click_count + 1, unique_click_count = unique_click_count + 1 WHERE id = ?'
    ).run(link.id);
  }

  res.redirect(302, link.original_url);
}

app.get('/r/:code', redirectLimiter, handleRedirect);
app.get('/:code', redirectLimiter, handleRedirect);

// Optional: serve frontend build if present
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`BKKGO backend listening on http://localhost:${PORT}`);
});
