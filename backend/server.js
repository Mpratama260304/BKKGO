require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { db, seedDefaults } = require('./db');
const { enrichClickAsync } = require('./utils/geoip');

// Production safety check — if JWT_SECRET is missing/weak, auto-generate a
// random one and warn loudly. Tokens won't survive a restart in this mode,
// which forces operators to set a real secret. We do NOT crash, so the
// container still becomes healthy on hosting platforms.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
  console.warn(
    '[warn] JWT_SECRET was missing or too short. A random secret was generated for this process.\n' +
    '       Tokens will be invalidated on restart. Set JWT_SECRET (>=32 chars) in your environment.'
  );
}
const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const adminConfigRoutes = require('./routes/adminConfig');
const landingRoutes = require('./routes/landing');

seedDefaults();

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(
  helmet({
    // Disable CSP here; the React app + inline Vite assets need their own policy.
    // Tighten via a reverse proxy or extend this config for production.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow QR/banner images
  })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limit auth POSTs (login/register/forgot/reset). GET /config is not
// sensitive and is fetched on every page load, so we exclude it.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});
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

  const ins = db.prepare(
    `INSERT INTO clicks (link_id, ip_address, user_agent, referrer, country, is_qr)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(link.id, ip, ua, referrer, null, isQr);
  enrichClickAsync(ins.lastInsertRowid, ip);

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
