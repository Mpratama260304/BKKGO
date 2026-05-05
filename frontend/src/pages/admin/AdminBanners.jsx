// Admin → Banner Ads. Upload images and manage banners shown on landing pages.
import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '../../api';
import { useToast } from '../../components/Toast.jsx';

export default function AdminBanners() {
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', link_url: '', width: '', height: '' });
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function load() { setRows(await api('/admin/banners')); }
  useEffect(() => { load(); }, []);

  async function upload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return push('Pilih file gambar', 'error');
    const fd = new FormData();
    fd.append('image', file);
    fd.append('name', form.name);
    fd.append('link_url', form.link_url);
    if (form.width) fd.append('width', form.width);
    if (form.height) fd.append('height', form.height);
    setUploading(true);
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      push('Banner uploaded', 'success');
      setForm({ name: '', link_url: '', width: '', height: '' });
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally { setUploading(false); }
  }

  async function toggle(b) {
    await api(`/admin/banners/${b.id}`, { method: 'PUT', body: { enabled: !b.enabled } });
    load();
  }
  async function remove(b) {
    if (!confirm(`Delete banner "${b.name}"?`)) return;
    await api(`/admin/banners/${b.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Banner Ads</h1>

      <form onSubmit={upload} className="card p-4 grid gap-3 sm:grid-cols-12">
        <input className="input sm:col-span-3" placeholder="Banner name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input sm:col-span-4" placeholder="Click destination URL (optional)" value={form.link_url}
          onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
        <input className="input sm:col-span-1" placeholder="W" value={form.width}
          onChange={(e) => setForm({ ...form, width: e.target.value })} />
        <input className="input sm:col-span-1" placeholder="H" value={form.height}
          onChange={(e) => setForm({ ...form, height: e.target.value })} />
        <input className="sm:col-span-2" type="file" accept="image/*" ref={fileRef} />
        <button disabled={uploading} className="btn-primary sm:col-span-1">{uploading ? 'Uploading…' : 'Upload'}</button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((b) => (
          <div key={b.id} className="card p-3">
            <div className="bg-slate-100 rounded overflow-hidden flex items-center justify-center" style={{ minHeight: 120 }}>
              <img src={b.image_path} alt={b.name} className="max-w-full max-h-48" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800 text-sm">{b.name}</div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">{b.link_url || 'no link'}</div>
              </div>
              <div className="text-xs">
                {b.enabled
                  ? <span className="text-emerald-600">● Enabled</span>
                  : <span className="text-slate-400">○ Disabled</span>}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => toggle(b)} className="btn-outline text-xs">{b.enabled ? 'Disable' : 'Enable'}</button>
              <a href={b.image_path} target="_blank" rel="noreferrer" className="btn-outline text-xs">View</a>
              <button onClick={() => remove(b)} className="btn-outline text-xs text-red-600">Delete</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-slate-500 text-sm">No banners yet.</div>}
      </div>
    </div>
  );
}
