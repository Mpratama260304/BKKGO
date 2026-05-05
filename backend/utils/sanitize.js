// Lightweight server-side input helpers.
// We don't strip user content silently — only neutralize HTML in user-controlled
// strings that are echoed back into UI/admin tables (titles, names, aliases).
function escapeHtml(str) {
  if (str == null) return str;
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip control characters and trim. Returns null if string becomes empty.
function cleanStr(str, max = 500) {
  if (str == null) return null;
  let s = String(str).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (max && s.length > max) s = s.slice(0, max);
  return s.length ? s : null;
}

module.exports = { escapeHtml, cleanStr };
