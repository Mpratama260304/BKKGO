// Reset-password page. Reads ?token=... from the URL and posts the new password.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (pwd.length < 6) return setError('Password must be at least 6 characters');
    if (pwd !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: pwd } });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) {
      setError(e.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-12">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Choose a new password</h1>
        {!token && <div className="text-sm text-red-600 mb-4">Missing reset token in URL.</div>}
        {done ? (
          <div className="text-sm text-emerald-700">
            Password updated. Redirecting to login…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input type="password" required placeholder="New password (min 6 chars)"
              value={pwd} onChange={(e) => setPwd(e.target.value)} className="input w-full" />
            <input type="password" required placeholder="Confirm new password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input w-full" />
            <button disabled={busy || !token} className="btn w-full">
              {busy ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}
        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        <div className="mt-6 text-sm text-center text-slate-500">
          <Link to="/login" className="text-brand-600 hover:underline">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
