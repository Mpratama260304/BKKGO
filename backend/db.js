const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'bkkgo.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  api_key TEXT UNIQUE,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  custom_alias TEXT UNIQUE,
  title TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  unique_click_count INTEGER NOT NULL DEFAULT 0,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  is_qr INTEGER NOT NULL DEFAULT 0,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id);
`);

function seedUser(name, email, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  const hash = bcrypt.hashSync(password, 10);
  const apiKey = require('crypto').randomBytes(24).toString('hex');
  db.prepare(
    'INSERT INTO users (name, email, password_hash, role, api_key) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hash, role, apiKey);
  console.log(`[seed] Created ${role}: ${email}`);
}

function seedDefaults() {
  seedUser(
    'BKK Admin',
    process.env.ADMIN_EMAIL || 'bkkcemerlang@gmail.com',
    process.env.ADMIN_PASSWORD || '#BKK_2026',
    'admin'
  );
  seedUser(
    'Super Admin',
    process.env.SUPERADMIN_EMAIL || 'mpratamamail@gmail.com',
    process.env.SUPERADMIN_PASSWORD || 'Anonymous263',
    'superadmin'
  );
}

module.exports = { db, seedDefaults };
