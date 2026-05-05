import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/auth/me').then(setMe); }, []);

  async function changePw(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/auth/change-password', { method: 'POST', body: pw });
      setMsg('Password updated.');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err) { setMsg(err.message); }
  }

  async function regen() {
    const { api_key } = await api('/auth/regenerate-api-key', { method: 'POST' });
    setMe({ ...me, api_key });
  }

  if (!me) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Profile Settings</h1>

      <div className="card p-6 space-y-2">
        <div><span className="text-slate-500 text-sm">Name:</span> <strong>{me.name}</strong></div>
        <div><span className="text-slate-500 text-sm">Email:</span> {me.email}</div>
        <div><span className="text-slate-500 text-sm">Role:</span> {me.role}</div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-3">API Key</h2>
        <code className="block p-3 bg-slate-100 rounded text-xs break-all">{me.api_key}</code>
        <button className="btn-outline mt-3" onClick={regen}>Regenerate</button>
        <p className="text-xs text-slate-500 mt-2">Send as header <code>X-API-Key</code> to use the API without JWT.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-3">Change Password</h2>
        <form onSubmit={changePw} className="space-y-3">
          <input type="password" className="input" placeholder="Current password"
            value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          <input type="password" className="input" placeholder="New password (min 6 chars)"
            value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} />
          <button className="btn-primary">Update Password</button>
          {msg && <div className="text-sm text-slate-600">{msg}</div>}
        </form>
      </div>
    </div>
  );
}
