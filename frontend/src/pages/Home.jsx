import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, shortUrl } from '../api';

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function shorten(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const link = await api('/links/public', { method: 'POST', body: { original_url: url } });
      setResult(link);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Shorten. Share. Track.
          </h1>
          <p className="mt-4 text-lg text-brand-100">
            BKKGO is a fast, self-hosted shortlink platform with QR codes & analytics.
          </p>

          <form onSubmit={shorten} className="mt-10 bg-white rounded-2xl p-3 shadow-lg flex flex-col sm:flex-row gap-2">
            <input
              required
              type="url"
              placeholder="Paste a long URL — https://example.com/..."
              className="flex-1 px-4 py-3 text-slate-800 rounded-lg focus:outline-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button disabled={loading} className="btn-primary px-6 py-3 text-base">
              {loading ? 'Shortening…' : 'Shorten URL'}
            </button>
          </form>

          {error && <div className="mt-4 text-red-200">{error}</div>}
          {result && (
            <div className="mt-6 bg-white text-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <a className="text-brand-600 font-semibold" href={shortUrl(result.short_code)} target="_blank" rel="noreferrer">
                {shortUrl(result.short_code)}
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(shortUrl(result.short_code))}
                className="btn-outline"
              >
                Copy
              </button>
            </div>
          )}

          <div className="mt-6 text-sm text-brand-100">
            Want analytics & QR codes?{' '}
            <Link to="/register" className="underline font-semibold">Create a free account</Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid gap-6 sm:grid-cols-3">
        {[
          { t: 'Custom Aliases', d: 'Pick your own short code or let nanoid generate one.' },
          { t: 'QR Codes', d: 'Download print-ready PNG/SVG QR codes for every link.' },
          { t: 'Analytics', d: 'Total clicks, unique visitors, referrers, and CSV export.' },
        ].map((f) => (
          <div key={f.t} className="card p-6">
            <h3 className="font-semibold text-lg text-slate-800">{f.t}</h3>
            <p className="text-slate-600 mt-2 text-sm">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
