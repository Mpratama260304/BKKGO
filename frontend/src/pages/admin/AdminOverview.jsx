// Admin overview / dashboard with stat cards, traffic chart, top links and recent logs.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, shortUrl } from '../../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/admin/stats').then(setData).catch(e => setError(e.message)); }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Users" value={data.users} accent="bg-indigo-100 text-indigo-700" />
        <Stat label="Total Links" value={data.links} accent="bg-emerald-100 text-emerald-700" />
        <Stat label="Total Clicks" value={data.clicks} accent="bg-amber-100 text-amber-700" />
        <Stat label="Unique Visitors" value={data.uniqueVisitors} accent="bg-rose-100 text-rose-700" />
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-800 mb-3">Traffic — last 30 days</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-800">Top Links</h3>
            <Link to="/admin/links" className="text-sm text-brand-600">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 text-xs uppercase">
              <tr><th className="pb-2">Short</th><th>Owner</th><th>Destination</th><th className="text-right">Clicks</th></tr>
            </thead>
            <tbody>
              {data.topLinks.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2"><a className="text-brand-600 font-medium" href={shortUrl(l.short_code)} target="_blank" rel="noreferrer">/{l.short_code}</a></td>
                  <td className="text-slate-600">{l.owner}</td>
                  <td className="truncate max-w-xs text-slate-500" title={l.original_url}>{l.original_url}</td>
                  <td className="text-right font-semibold">{l.click_count}</td>
                </tr>
              ))}
              {data.topLinks.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No data yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <Link to="/admin/logs" className="text-sm text-brand-600">All logs →</Link>
          </div>
          <ul className="text-sm divide-y divide-slate-100">
            {data.recentLogs.map((l) => (
              <li key={l.id} className="py-2">
                <div className="text-slate-700"><strong>{l.action}</strong> {l.target_type ? `· ${l.target_type}#${l.target_id}` : ''}</div>
                <div className="text-xs text-slate-500">{l.actor_email} · {new Date(l.created_at).toLocaleString()}</div>
              </li>
            ))}
            {data.recentLogs.length === 0 && <li className="py-3 text-slate-500 text-sm">No activity yet</li>}
          </ul>
        </div>
      </div>

      {data.expiringSoon.length > 0 && (
        <div className="card p-6 border-amber-300">
          <h3 className="font-semibold text-amber-700 mb-2">⏰ Links expiring within 7 days</h3>
          <ul className="text-sm space-y-1">
            {data.expiringSoon.map((l) => (
              <li key={l.id}>/{l.short_code} — {new Date(l.expires_at).toLocaleString()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card p-5">
      <div className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${accent}`}>{label}</div>
      <div className="text-3xl font-bold text-slate-800 mt-2">{value}</div>
    </div>
  );
}
