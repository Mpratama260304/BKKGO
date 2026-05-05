// Centralized activity-logger so any admin action can be tracked uniformly.
// Usage: logActivity(req, 'user.block', 'user', targetId, { is_blocked: 1 });
const { db } = require('../db');

function logActivity(req, action, targetType, targetId, details) {
  try {
    const ip = (req?.headers?.['x-forwarded-for'] || req?.ip || '').toString().split(',')[0].trim();
    db.prepare(
      `INSERT INTO activity_logs (actor_id, actor_email, action, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req?.user?.id ?? null,
      req?.user?.email ?? null,
      action,
      targetType ?? null,
      targetId ?? null,
      details ? JSON.stringify(details) : null,
      ip || null
    );
  } catch (err) {
    // Logging must never break a request
    console.error('[activity-log] failed:', err.message);
  }
}

module.exports = { logActivity };
