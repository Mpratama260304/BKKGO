// Admin → Settings. Server config snapshot, env hints, profile shortcuts.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../../api';
import { useAuth } from '../../auth.jsx';

export default function AdminSettings() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [sys, setSys] = useState(null);          // superadmin-only system flags
  const [savingSys, setSavingSys] = useState(false);
  const [sysMsg, setSysMsg] = useState('');

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => {});
    api('/auth/config').then(setConfig).catch(() => {});
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
    if (user?.role === 'superadmin') {
      api('/admin/system-settings').then(setSys).catch(() => {});
    }
  }, [user?.role]);

  async function toggleRegistration(next) {
    setSavingSys(true); setSysMsg('');
    try {
      await api('/admin/system-settings', {
        method: 'PUT',
        body: { registration_enabled: next },
      });
      setSys((s) => ({ ...(s || {}), registration_enabled: next }));
      setSysMsg(next ? 'Registration enabled.' : 'Registration disabled.');
    } catch (e) {
      setSysMsg(e.message || 'Failed to update');
    } finally {
      setSavingSys(false);
    }
  }

  async function toggleGuestShorten(next) {
    setSavingSys(true); setSysMsg('');
    try {
      await api('/admin/system-settings', {
        method: 'PUT',
        body: { guest_shorten_enabled: next },
      });
      setSys((s) => ({ ...(s || {}), guest_shorten_enabled: next }));
      setSysMsg(next ? 'Guest shortening enabled.' : 'Guest shortening disabled.');
    } catch (e) {
      setSysMsg(e.message || 'Failed to update');
    } finally {
      setSavingSys(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

      <section className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-3">Account</h2>
        {me ? (
          <dl className="text-sm grid grid-cols-3 gap-y-2">
            <dt className="text-slate-500">Name</dt><dd className="col-span-2">{me.name}</dd>
            <dt className="text-slate-500">Email</dt><dd className="col-span-2">{me.email}</dd>
            <dt className="text-slate-500">Role</dt><dd className="col-span-2"><code className="px-1.5 py-0.5 bg-slate-100 rounded">{me.role}</code></dd>
            <dt className="text-slate-500">Joined</dt><dd className="col-span-2">{new Date(me.created_at).toLocaleString()}</dd>
          </dl>
        ) : <div className="text-slate-500 text-sm">Loading…</div>}
        <div className="mt-4">
          <Link to="/settings" className="btn-outline text-sm">Manage profile / password / API key →</Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-3">System</h2>
        <dl className="text-sm grid grid-cols-3 gap-y-2">
          <dt className="text-slate-500">API health</dt>
          <dd className="col-span-2">
            {health?.ok
              ? <span className="text-emerald-600">● Online</span>
              : <span className="text-red-600">● Offline</span>}
          </dd>
          <dt className="text-slate-500">reCAPTCHA</dt>
          <dd className="col-span-2">
            {config?.recaptchaEnabled
              ? <span className="text-emerald-600">Enabled</span>
              : <span className="text-slate-500">Disabled (set <code>RECAPTCHA_SECRET</code> in backend env)</span>}
          </dd>
        </dl>
      </section>

      {user?.role === 'superadmin' && (
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800 mb-1">User registration</h2>
              <p className="text-sm text-slate-500">
                When disabled, the public <code>/register</code> form is hidden and any direct
                POST to the API is rejected. Existing users are unaffected.
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={savingSys || !sys}
                checked={!!sys?.registration_enabled}
                onChange={(e) => toggleRegistration(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-300 peer-checked:bg-emerald-500 rounded-full relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sys?.registration_enabled ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          </div>
          <div className="mt-3 text-sm">
            {sys ? (
              <span className={sys.registration_enabled ? 'text-emerald-700' : 'text-amber-700'}>
                Status: <strong>{sys.registration_enabled ? 'Enabled' : 'Disabled'}</strong>
              </span>
            ) : <span className="text-slate-400">Loading…</span>}
            {sysMsg && <span className="ml-3 text-slate-500">{sysMsg}</span>}
          </div>
        </section>
      )}

      {user?.role === 'superadmin' && (
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800 mb-1">Guest / anonymous shortening</h2>
              <p className="text-sm text-slate-500">
                When disabled, the public homepage shortener form is hidden and any
                unauthenticated POST to <code>/api/links/public</code> is rejected.
                Visitors must sign in to create short links.
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={savingSys || !sys}
                checked={!!sys?.guest_shorten_enabled}
                onChange={(e) => toggleGuestShorten(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-300 peer-checked:bg-emerald-500 rounded-full relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sys?.guest_shorten_enabled ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          </div>
          <div className="mt-3 text-sm">
            {sys ? (
              <span className={sys.guest_shorten_enabled ? 'text-emerald-700' : 'text-amber-700'}>
                Status: <strong>{sys.guest_shorten_enabled ? 'Enabled' : 'Disabled'}</strong>
              </span>
            ) : <span className="text-slate-400">Loading…</span>}
          </div>
        </section>
      )}

      {user?.role === 'superadmin' && <DataMigrationSection />}

      <section className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-3">Operational notes</h2>
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>Set <code>JWT_SECRET</code> and <code>BASE_URL</code> in <code>backend/.env</code> for production.</li>
          <li>Default DB is SQLite. Switch to Postgres by replacing <code>backend/db.js</code> driver.</li>
          <li>Rate limits are enforced on auth, link creation, public shorten, and redirects.</li>
          <li>All admin actions are recorded in <Link className="text-brand-600" to="/admin/logs">Activity Logs</Link>.</li>
          {user?.role === 'superadmin' && <li>You can <Link className="text-brand-600" to="/admin/users">impersonate</Link> any user for debugging.</li>}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Superadmin-only: export the entire database snapshot to a JSON file, and
// re-import it later (e.g. after a redeploy or migration). Import supports
// "merge" (insert only new rows) and "overwrite" (wipe and restore) modes.
// All import work happens inside a server-side transaction so partial writes
// can never corrupt the database.
// ---------------------------------------------------------------------------
function DataMigrationSection() {
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [mode, setMode] = useState('merge'); // 'merge' | 'overwrite'
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState(null);

  // Trigger a download of the JSON snapshot from the secure endpoint.
  async function handleExport() {
    setExporting(true); setMsg(''); setErr(''); setSummary(null);
    try {
      const res = await fetch('/api/superadmin/export-data', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Try to honor the server-provided filename; fallback to a sensible default.
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="?([^"]+)"?/i.exec(cd);
      const filename = m ? m[1] : `bkkgo-export-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Exported snapshot as ${filename}.`);
    } catch (e) {
      setErr(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // First step: user picks a file. We don't import yet — we open a confirm modal.
  function handleFilePick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.json$/i.test(f.name)) {
      setErr('Please choose a .json snapshot file.');
      e.target.value = '';
      return;
    }
    setErr(''); setMsg(''); setSummary(null);
    setPendingFile(f);
    setConfirmOpen(true);
  }

  // Second step: user confirmed in modal — actually upload and import.
  async function handleImportConfirmed() {
    if (!pendingFile) return;
    setImporting(true); setErr(''); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('mode', mode);
      const res = await fetch('/api/superadmin/import-data', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSummary(data.summary || null);
      setMsg(`Import complete (${data.mode}). You may need to log out and back in if your account was replaced.`);
    } catch (e) {
      setErr(e.message || 'Import failed');
    } finally {
      setImporting(false);
      setConfirmOpen(false);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function cancelImport() {
    setConfirmOpen(false);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <section className="card p-6">
      <h2 className="font-semibold text-slate-800 mb-1">Data migration (Superadmin)</h2>
      <p className="text-sm text-slate-500 mb-4">
        Download a full JSON snapshot of users, links, clicks, banners, CAPTCHA settings,
        admin logs, and system settings. Re-import the file after a redeploy to restore
        everything without data loss.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          className="btn-primary"
          disabled={exporting}
          onClick={handleExport}
        >
          {exporting ? 'Exporting…' : 'Export Data'}
        </button>

        <button
          type="button"
          className="btn-outline"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? 'Importing…' : 'Import Data'}
        </button>

        {/* Hidden file picker — opened by the Import button above. */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFilePick}
        />
      </div>

      {/* Status / feedback area */}
      {msg && <div className="mt-3 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="mt-3 text-sm text-red-700">{err}</div>}

      {summary && (
        <div className="mt-4 text-xs">
          <div className="font-medium text-slate-700 mb-1">Import summary</div>
          <div className="overflow-x-auto">
            <table className="min-w-[420px] text-left">
              <thead className="text-slate-500">
                <tr><th className="pr-4">Table</th><th className="pr-4">Inserted</th><th>Skipped</th></tr>
              </thead>
              <tbody>
                {Object.entries(summary).map(([t, s]) => (
                  <tr key={t} className="border-t border-slate-100">
                    <td className="pr-4 py-1 font-mono">{t}</td>
                    <td className="pr-4 py-1">{s.inserted}</td>
                    <td className="py-1">{s.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation modal — shown after a file is chosen. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-800 mb-2">Confirm import</h3>
            <p className="text-sm text-slate-600">
              You are about to import <code className="px-1 bg-slate-100 rounded">{pendingFile?.name}</code>.
              Choose how to handle existing data:
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio" name="mode" value="merge"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-1"
                />
                <span>
                  <strong>Merge</strong> — keep existing rows, only insert rows from the
                  snapshot that don't already exist (safe).
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio" name="mode" value="overwrite"
                  checked={mode === 'overwrite'}
                  onChange={() => setMode('overwrite')}
                  className="mt-1"
                />
                <span>
                  <strong>Overwrite</strong> — wipe all current data and replace it with
                  the snapshot. <span className="text-red-600">Destructive.</span>
                </span>
              </label>
            </div>

            {mode === 'overwrite' && (
              <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Warning: this will permanently delete every user, link, click, log, and
                setting currently in the database before restoring from the file.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={cancelImport} disabled={importing}>
                Cancel
              </button>
              <button
                type="button"
                className={mode === 'overwrite'
                  ? 'inline-flex items-center justify-center px-4 py-2 rounded-md font-medium text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                  : 'btn-primary'}
                onClick={handleImportConfirmed}
                disabled={importing}
              >
                {importing ? 'Importing…' : (mode === 'overwrite' ? 'Overwrite & Import' : 'Merge & Import')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}