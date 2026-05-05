// Admin → Analytics. Multi-series traffic chart and category breakdown.
import { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/admin/analytics?days=${days}`).then(setData).finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`btn ${days === d ? 'btn-primary' : 'btn-outline'} text-xs`}>Last {d} days</button>
          ))}
        </div>
      </div>

      {loading && <div className="text-slate-500">Loading…</div>}
      {data && (
        <>
          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Traffic Trend</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={data.byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="clicks" stackId="1" stroke="#2563eb" fill="#93c5fd" />
                  <Area type="monotone" dataKey="unique_visitors" stackId="2" stroke="#059669" fill="#6ee7b7" />
                  <Area type="monotone" dataKey="qr_scans" stackId="3" stroke="#d97706" fill="#fcd34d" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Clicks by Category</h3>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="clicks" fill="#2563eb" />
                  <Bar dataKey="link_count" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
