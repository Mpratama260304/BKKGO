import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, shortUrl } from '../api';
import { useAuth } from '../auth.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function Admin() {
  const { user, impersonate } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);

  async function loadAll() {
    setStats(await api('/admin/stats'));
    setUsers(await api('/admin/users'));
    setLinks(await api('/admin/links'));
  }
  useEffect(() => { loadAll(); }, []);

  async function blockUser(u, val) {
    await api(`/admin/users/${u.id}`, { method: 'PUT', body: { is_blocked: val } });
    loadAll();
  }
  async function delUser(u) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    await api(`/admin/users/${u.id}`, { method: 'DELETE' });
    loadAll();
  }
  async function blockLink(l, val) {
    await api(`/admin/links/${l.id}/block`, { method: 'PUT', body: { is_blocked: val } });
    loadAll();
  }
  async function delLink(l) {
    if (!confirm('Delete link?')) return;
    await api(`/admin/links/${l.id}`, { method: 'DELETE' });
    loadAll();
  }
  async function impersonateUser(u) {
    const { token, user } = await api(`/admin/impersonate/${u.id}`, { method: 'POST' });
    impersonate(token, user);
    nav('/dashboard');
  }

  if (!stats) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <div className="text-sm text-slate-600">Logged in as <strong>{user.role}</strong></div>
      </div>

      <div className="flex gap-2">
        {['overview', 'users', 'links'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="Users" value={stats.users} />
            <Stat label="Links" value={stats.links} />
            <Stat label="Total Clicks" value={stats.clicks} />
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Clicks (last 30 days)</h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Top Links</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th>Short</th><th>Owner</th><th>Destination</th><th>Clicks</th></tr>
              </thead>
              <tbody>
                {stats.topLinks.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-2"><a className="text-brand-600" href={shortUrl(l.short_code)} target="_blank" rel="noreferrer">/{l.short_code}</a></td>
                    <td>{l.owner}</td>
                    <td className="truncate max-w-xs">{l.original_url}</td>
                    <td>{l.click_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="p-3">Email</th><th>Name</th><th>Role</th><th>Links</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="p-3">{u.email}</td>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td>{u.link_count}</td>
                  <td>{u.is_blocked ? <span className="text-red-600">Blocked</span> : <span className="text-emerald-600">Active</span>}</td>
                  <td className="text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3 flex flex-wrap gap-2">
                    <button onClick={() => blockUser(u, !u.is_blocked)} className="btn-outline text-xs">
                      {u.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                    {user.role === 'superadmin' && u.id !== user.id && (
                      <>
                        <button onClick={() => impersonateUser(u)} className="btn-outline text-xs">Impersonate</button>
                        <button onClick={() => delUser(u)} className="btn-outline text-xs text-red-600">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'links' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="p-3">Short</th><th>Owner</th><th>Destination</th><th>Clicks</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="p-3"><a className="text-brand-600" href={shortUrl(l.short_code)} target="_blank" rel="noreferrer">/{l.short_code}</a></td>
                  <td>{l.owner}</td>
                  <td className="truncate max-w-xs" title={l.original_url}>{l.original_url}</td>
                  <td>{l.click_count}</td>
                  <td>{l.is_blocked ? <span className="text-red-600">Blocked</span> : <span className="text-emerald-600">Active</span>}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => blockLink(l, !l.is_blocked)} className="btn-outline text-xs">
                      {l.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                    <button onClick={() => delLink(l)} className="btn-outline text-xs text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
