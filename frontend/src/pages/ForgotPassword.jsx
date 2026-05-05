// Forgot-password page. Submits email to /api/auth/forgot-password.
// Backend returns a generic message (to prevent enumeration), and in dev also
// returns a reset URL we display so the flow can be tested without SMTP.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setError(''); setDevUrl('');
    try {
      const r = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg(r.message || 'Check your email.');
      if (r.dev_reset_url) setDevUrl(r.dev_reset_url);
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Forgot password?</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your account email and we'll issue a one-time reset link valid for 30 minutes.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input w-full"
          />
          <button disabled={busy} className="btn w-full">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        {msg && <div className="mt-4 text-sm text-emerald-700">{msg}</div>}
        {devUrl && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 break-all">
            <div className="font-semibold mb-1">Dev mode — reset link:</div>
            <a href={devUrl} className="underline">{devUrl}</a>
          </div>
        )}
        <div className="mt-6 text-sm text-center text-slate-500">
          <Link to="/login" className="text-brand-600 hover:underline">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
