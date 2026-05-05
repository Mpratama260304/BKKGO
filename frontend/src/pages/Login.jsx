import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api';
import Recaptcha from '../components/Recaptcha.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [config, setConfig] = useState({ recaptchaSiteKey: null, recaptchaEnabled: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api('/auth/config').then(setConfig).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (config.recaptchaEnabled && !captchaToken) {
      setError('Please complete the captcha.');
      return;
    }
    setLoading(true);
    try {
      const u = await login(email, password, captchaToken);
      push('Welcome back!', 'success');
      nav(u.role === 'user' ? '/dashboard' : '/admin');
    } catch (err) {
      setError(err.message);
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-10 card">
      <h2 className="text-2xl font-bold text-slate-800">Login to BKKGO</h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" type="email" placeholder="Email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Recaptcha siteKey={config.recaptchaSiteKey} onChange={setCaptchaToken} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        No account? <Link className="text-brand-600 font-medium" to="/register">Sign up</Link>
      </div>
    </div>
  );
}
