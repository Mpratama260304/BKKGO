// =============================================================================
// Superadmin: Export & Import full database snapshot
// -----------------------------------------------------------------------------
// Endpoints (superadmin only):
//   GET  /api/superadmin/export-data   -> downloads a JSON snapshot of all
//                                         important tables (users, categories,
//                                         links, clicks, activity_logs,
//                                         captcha_settings, banners,
//                                         system_settings).
//   POST /api/superadmin/import-data   -> accepts the JSON snapshot back and
//                                         restores it. Two modes are supported:
//                                           - mode=merge     (default) keeps
//                                             existing rows, inserts only new
//                                             rows (INSERT OR IGNORE on PKs).
//                                           - mode=overwrite wipes the target
//                                             tables and reinserts everything
//                                             from the snapshot.
//
// All writes happen inside a single SQLite transaction so any error rolls back
// the entire import — preventing partial / corrupt restores. After an
// overwrite import we also re-run seedDefaults() so the system can never end
// up without a usable superadmin account.
// =============================================================================

const express = require('express');
const multer = require('multer');
const { db, seedDefaults } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();

// All routes here require an authenticated superadmin.
router.use(authRequired, requireRole('superadmin'));

// Tables included in the export, in insertion order so foreign keys resolve
// correctly during import (parents before children).
const EXPORT_TABLES = [
  'users',           // referenced by links, activity_logs, password_resets
  'categories',      // referenced by links
  'banners',         // referenced by links
  'links',           // references users, categories, banners
  'clicks',          // references links
  'activity_logs',   // references users
  'captcha_settings',// standalone
  'system_settings', // standalone
];

const EXPORT_VERSION = 1;

// In-memory upload (snapshots are small JSON files, capped at 50MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// GET /api/superadmin/export-data
// ---------------------------------------------------------------------------
router.get('/export-data', (req, res) => {
  try {
    const data = {};
    const counts = {};
    for (const table of EXPORT_TABLES) {
      // PRAGMA query first so an export still works even if a future migration
      // hasn't been applied to a particular environment.
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows;
      counts[table] = rows.length;
    }

    const payload = {
      meta: {
        app: 'BKKGO',
        version: EXPORT_VERSION,
        exported_at: new Date().toISOString(),
        exported_by: req.user.email,
        counts,
      },
      data,
    };

    logActivity(req, 'system.export', 'system', null, { counts });

    const filename = `bkkgo-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Pretty-print so admins can inspect / hand-edit the snapshot if needed.
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('[export-data] failed:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/superadmin/import-data
// Accepts either:
//   - multipart/form-data with `file` field (a JSON snapshot) and optional
//     `mode` field ("merge" | "overwrite"), or
//   - application/json with { mode, payload } in the body.
// ---------------------------------------------------------------------------
router.post('/import-data', upload.single('file'), (req, res) => {
  let payload;
  let mode = (req.body?.mode || 'merge').toString().toLowerCase();
  if (!['merge', 'overwrite'].includes(mode)) mode = 'merge';

  // Resolve the JSON payload from either upload or JSON body.
  try {
    if (req.file) {
      payload = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (req.body?.payload) {
      payload = typeof req.body.payload === 'string'
        ? JSON.parse(req.body.payload)
        : req.body.payload;
    } else {
      return res.status(400).json({ error: 'No import file or payload provided' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON: ' + err.message });
  }

  // ----- Validate snapshot shape -------------------------------------------
  if (!payload || typeof payload !== 'object' || !payload.data) {
    return res.status(400).json({ error: 'Invalid snapshot: missing "data" section' });
  }
  if (payload.meta?.app && payload.meta.app !== 'BKKGO') {
    return res.status(400).json({ error: 'Snapshot is not from BKKGO' });
  }
  if (payload.meta?.version && payload.meta.version > EXPORT_VERSION) {
    return res.status(400).json({
      error: `Snapshot version ${payload.meta.version} is newer than this server (${EXPORT_VERSION}).`,
    });
  }

  for (const table of Object.keys(payload.data)) {
    if (!EXPORT_TABLES.includes(table)) {
      return res.status(400).json({ error: `Unknown table in snapshot: ${table}` });
    }
    if (!Array.isArray(payload.data[table])) {
      return res.status(400).json({ error: `Snapshot table "${table}" must be an array` });
    }
  }

  // Build a quick lookup of allowed columns per table from PRAGMA so we can
  // safely drop unknown fields (forward/backward compatibility).
  const tableColumns = {};
  for (const table of EXPORT_TABLES) {
    tableColumns[table] = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  }

  // Run the entire import in one transaction — any error rolls back.
  const importTxn = db.transaction(() => {
    const summary = {};

    if (mode === 'overwrite') {
      // Disable FK checks temporarily so we can wipe in any order without the
      // engine complaining about transient referential gaps. Re-enabled at end.
      db.pragma('foreign_keys = OFF');
      // Delete in reverse dependency order.
      for (const table of [...EXPORT_TABLES].reverse()) {
        db.prepare(`DELETE FROM ${table}`).run();
        // Reset autoincrement sequence so imported IDs land cleanly.
        try { db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table); } catch {}
      }
    }

    for (const table of EXPORT_TABLES) {
      const rows = payload.data[table];
      if (!rows || rows.length === 0) { summary[table] = { inserted: 0, skipped: 0 }; continue; }

      const cols = tableColumns[table];
      // Strip unknown columns from each row (defensive against schema drift).
      const cleanRows = rows.map(row => {
        const out = {};
        for (const c of cols) if (c in row) out[c] = row[c];
        return out;
      });

      // Build INSERT OR REPLACE (overwrite) / INSERT OR IGNORE (merge).
      const verb = mode === 'overwrite' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      let inserted = 0, skipped = 0;
      for (const row of cleanRows) {
        const colNames = Object.keys(row);
        if (colNames.length === 0) { skipped++; continue; }
        const placeholders = colNames.map(() => '?').join(',');
        const values = colNames.map(c => row[c]);
        const stmt = db.prepare(
          `${verb} INTO ${table} (${colNames.join(',')}) VALUES (${placeholders})`
        );
        const info = stmt.run(...values);
        if (info.changes > 0) inserted++;
        else skipped++;
      }
      summary[table] = { inserted, skipped };
    }

    if (mode === 'overwrite') db.pragma('foreign_keys = ON');
    return summary;
  });

  let summary;
  try {
    summary = importTxn();
  } catch (err) {
    // Make sure FK checks are re-enabled even on failure.
    try { db.pragma('foreign_keys = ON'); } catch {}
    console.error('[import-data] failed, rolled back:', err);
    return res.status(500).json({ error: 'Import failed and rolled back: ' + err.message });
  }

  // Safety net: ensure default superadmin exists so the operator can still
  // log back in even after a destructive overwrite of an incomplete snapshot.
  try { seedDefaults(); } catch (err) { console.error('[import-data] reseed failed:', err); }

  logActivity(req, 'system.import', 'system', null, { mode, summary });
  res.json({ ok: true, mode, summary });
});

module.exports = router;
