// Admin → Settings. Server config snapshot, env hints, profile shortcuts.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth.jsx';

export default function AdminSettings() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => {});
    api('/auth/config').then(setConfig).catch(() => {});
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

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
