import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, shortUrl, getToken } from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function LinkStats() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/links/${id}/stats`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Loading…</div>;

  const { link, total, unique, qrScans, byDay, topReferrers, recent } = data;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <Link to="/dashboard" className="text-sm text-brand-600">← Back to dashboard</Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-800">{link.title || link.short_code}</h1>
        <a href={shortUrl(link.short_code)} target="_blank" rel="noreferrer" className="text-brand-600">
          {shortUrl(link.short_code)}
        </a>
        <div className="text-sm text-slate-500 mt-1 break-all">→ {link.original_url}</div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total Clicks" value={total} />
        <Stat label="Unique Visitors" value={unique} />
        <Stat label="QR Scans" value={qrScans} />
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Clicks (last 30 days)</h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-3">Top Referrers</h3>
          <ul className="text-sm divide-y divide-slate-100">
            {topReferrers.map((r) => (
              <li key={r.referrer} className="flex justify-between py-2">
                <span className="truncate">{r.referrer}</span>
                <span className="font-semibold">{r.c}</span>
              </li>
            ))}
            {topReferrers.length === 0 && <li className="text-slate-500 py-2">No data yet</li>}
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-3">Recent Clicks</h3>
          <ul className="text-xs divide-y divide-slate-100">
            {recent.map((r, i) => (
              <li key={i} className="py-2">
                <div className="text-slate-700">{new Date(r.clicked_at).toLocaleString()}{r.is_qr ? ' • QR' : ''}</div>
                <div className="text-slate-500 truncate">{r.ip_address} — {r.user_agent}</div>
              </li>
            ))}
            {recent.length === 0 && <li className="text-slate-500 py-2">No clicks yet</li>}
          </ul>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={`/api/links/${link.id}/export.csv`}
          onClick={(e) => {
            e.preventDefault();
            fetch(`/api/links/${link.id}/export.csv`, { headers: { Authorization: `Bearer ${getToken()}` } })
              .then((r) => r.blob())
              .then((b) => {
                const u = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = u; a.download = `bkkgo-${link.short_code}.csv`; a.click();
                URL.revokeObjectURL(u);
              });
          }}
          className="btn-outline"
        >
          Export CSV
        </a>
      </div>
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
