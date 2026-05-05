// Admin → CAPTCHA settings. Configure Google reCAPTCHA / hCaptcha / Cloudflare Turnstile.
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useToast } from '../../components/Toast.jsx';

const PROVIDERS = [
  { id: 'recaptcha', label: 'Google reCAPTCHA', hint: 'v2 checkbox or v3 score' },
  { id: 'hcaptcha', label: 'hCaptcha', hint: 'Privacy-friendly alternative' },
  { id: 'turnstile', label: 'Cloudflare Turnstile', hint: 'No-puzzle, automatic challenge' },
];

export default function AdminCaptcha() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await api('/admin/captcha-settings');
    setRows(r);
    const f = {};
    PROVIDERS.forEach((p) => {
      const existing = r.find((x) => x.provider === p.id);
      f[p.id] = {
        site_key: existing?.site_key || '',
        secret_key: '',
        enabled: !!existing?.enabled,
        secret_masked: existing?.secret_key_masked || '',
      };
    });
    setForms(f);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(provider) {
    try {
      await api('/admin/captcha-settings', { method: 'POST', body: { provider, ...forms[provider] } });
      push('Saved', 'success');
      load();
    } catch (e) { push(e.message, 'error'); }
  }

  async function remove(provider) {
    if (!confirm('Remove these settings?')) return;
    await api(`/admin/captcha-settings/${provider}`, { method: 'DELETE' });
    push('Removed', 'success');
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">CAPTCHA Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Hanya satu provider yang dapat aktif sekaligus. Kosongkan secret untuk mempertahankan nilai sebelumnya.
        </p>
      </div>

      {loading ? <div className="text-slate-500">Loading…</div> : PROVIDERS.map((p) => (
        <div key={p.id} className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800">{p.label}</h2>
              <div className="text-xs text-slate-500">{p.hint}</div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!forms[p.id]?.enabled}
                onChange={(e) => setForms({ ...forms, [p.id]: { ...forms[p.id], enabled: e.target.checked } })} />
              Enabled
            </label>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Site Key
              <input className="input mt-1" value={forms[p.id]?.site_key || ''}
                onChange={(e) => setForms({ ...forms, [p.id]: { ...forms[p.id], site_key: e.target.value } })} />
            </label>
            <label className="text-sm">Secret Key
              <input className="input mt-1" type="password"
                placeholder={forms[p.id]?.secret_masked || 'enter secret…'}
                value={forms[p.id]?.secret_key || ''}
                onChange={(e) => setForms({ ...forms, [p.id]: { ...forms[p.id], secret_key: e.target.value } })} />
              {forms[p.id]?.secret_masked && (
                <div className="text-xs text-slate-500 mt-1">Stored: {forms[p.id].secret_masked}</div>
              )}
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => save(p.id)} className="btn-primary">Save</button>
            {rows.find(r => r.provider === p.id) && (
              <button onClick={() => remove(p.id)} className="btn-outline text-red-600">Remove</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
