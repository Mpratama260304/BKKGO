const jwt = require('jsonwebtoken');
const { db } = require('../db');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET(),
    { expiresIn: '7d' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const apiKey = req.headers['x-api-key'];

  if (token) {
    try {
      const payload = jwt.verify(token, SECRET());
      const user = db.prepare('SELECT id, name, email, role, is_blocked FROM users WHERE id = ?').get(payload.id);
      if (!user || user.is_blocked) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  if (apiKey) {
    const user = db.prepare('SELECT id, name, email, role, is_blocked FROM users WHERE api_key = ?').get(apiKey);
    if (!user || user.is_blocked) return res.status(401).json({ error: 'Invalid API key' });
    req.user = user;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { signToken, authRequired, requireRole };
