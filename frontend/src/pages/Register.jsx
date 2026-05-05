import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      nav('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-10 card">
      <h2 className="text-2xl font-bold text-slate-800">Create your account</h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating…' : 'Sign Up'}</button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        Already a member? <Link className="text-brand-600 font-medium" to="/login">Sign in</Link>
      </div>
    </div>
  );
}
