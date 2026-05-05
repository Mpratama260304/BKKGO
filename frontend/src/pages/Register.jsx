// Public registration page.
// Backend exposes `registrationEnabled` in /auth/config; when it's explicitly
// false we hide the form and show a notice instead of a blank page.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api';
import Recaptcha from '../components/Recaptcha.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Register() {
  const { register } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [captchaToken, setCaptchaToken] = useState(null);
  const [config, setConfig] = useState({
    recaptchaSiteKey: null,
    recaptchaEnabled: false,
    registrationEnabled: true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/auth/config')
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (config.recaptchaEnabled && !captchaToken) {
      setError('Please complete the captcha.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, captchaToken);
      push('Account created!', 'success');
      nav('/dashboard');
    } catch (err) {
      setError(err.message);
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const disabled = config.registrationEnabled === false;

  return (
    <div className="max-w-md mx-auto p-6 mt-10 card">
      <h2 className="text-2xl font-bold text-slate-800">Create your account</h2>

      {disabled && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            Self-service registration is currently disabled by the administrator.
            Please contact your administrator to request an account.
          </div>
          <Link to="/login" className="btn-outline w-full text-center block">Back to login</Link>
        </div>
      )}

      {!disabled && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            className="input"
            placeholder="Name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password (min 6 chars)"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
          <Recaptcha siteKey={config.recaptchaSiteKey} onChange={setCaptchaToken} />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating…' : 'Sign Up'}
          </button>
        </form>
      )}

      {!disabled && (
        <div className="mt-4 text-sm text-slate-600">
          Already a member? <Link className="text-brand-600 font-medium" to="/login">Sign in</Link>
        </div>
      )}
    </div>
  );
}
