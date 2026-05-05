import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, shortUrl, getToken } from '../api';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import LinkOptionsModal from '../components/LinkOptionsModal.jsx';
import QrPreviewModal from '../components/QrPreviewModal.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ original_url: '', custom_alias: '', title: '' });
  const [error, setError] = useState('');
  const [optionsLink, setOptionsLink] = useState(null);
  const [qrLink, setQrLink] = useState(null);

  async function load() {
    setLinks(await api('/links'));
    setStats(await api(`/users/${user.id}/stats`));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/links', { method: 'POST', body: form });
      setForm({ original_url: '', custom_alias: '', title: '' });
      push('Shortlink created', 'success');
      load();
    } catch (err) {
      setError(err.message);
      push(err.message, 'error');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this link?')) return;
    await api(`/links/${id}`, { method: 'DELETE' });
    push('Link deleted', 'success');
    load();
  }

  function downloadQR(id) {
    // Kept for API key/CLI parity — direct download endpoint
    const token = getToken();
    fetch(`/api/links/${id}/qrcode/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = `bkkgo-qr-${id}.png`;
        a.click();
        URL.revokeObjectURL(u);
      });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.name}</h1>

      {stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Total Links" value={stats.total_links} />
          <Stat label="Total Clicks" value={stats.total_clicks} />
          <Stat label="Unique Visitors" value={stats.unique_clicks} />
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Create a new shortlink</h2>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-12">
          <input
            className="input sm:col-span-6"
            type="url"
            required
            placeholder="https://your-long-url.com/..."
            value={form.original_url}
            onChange={(e) => setForm({ ...form, original_url: e.target.value })}
          />
          <input
            className="input sm:col-span-3"
            placeholder="custom-alias (optional)"
            value={form.custom_alias}
            onChange={(e) => setForm({ ...form, custom_alias: e.target.value })}
          />
          <input
            className="input sm:col-span-2"
            placeholder="Title (optional)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <button className="btn-primary sm:col-span-1">Create</button>
          {error && <div className="sm:col-span-12 text-red-600 text-sm">{error}</div>}
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="p-3">Short URL</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Clicks</th>
              <th className="p-3">Unique</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-3">
                  <a className="text-brand-600 font-medium" href={shortUrl(l.short_code)} target="_blank" rel="noreferrer">
                    {shortUrl(l.short_code)}
                  </a>
                </td>
                <td className="p-3 max-w-xs truncate text-slate-600" title={l.original_url}>{l.original_url}</td>
                <td className="p-3">{l.click_count}</td>
                <td className="p-3">{l.unique_click_count}</td>
                <td className="p-3 text-slate-500">{new Date(l.created_at).toLocaleDateString()}</td>
                <td className="p-3 flex flex-wrap gap-2">
                  <Link to={`/links/${l.id}`} className="btn-outline text-xs">Stats</Link>
                  <button onClick={() => setQrLink(l)} className="btn-outline text-xs">QR</button>
                  <button onClick={() => setOptionsLink(l)} className="btn-outline text-xs">Options</button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(shortUrl(l.short_code)); push('Copied!', 'success'); }}
                    className="btn-outline text-xs"
                  >
                    Copy
                  </button>
                  <button onClick={() => remove(l.id)} className="btn-outline text-xs text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No links yet — create your first one above.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="text-right">
        <Link to="/settings" className="text-sm text-brand-600 font-medium">Profile & API key →</Link>
      </div>

      {optionsLink && <LinkOptionsModal link={optionsLink} onClose={() => setOptionsLink(null)} onSaved={load} />}
      {qrLink && <QrPreviewModal link={qrLink} onClose={() => setQrLink(null)} />}
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
