// Admin → Categories CRUD.
import { useEffect, useState } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal.jsx';

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({ name: '', color: '#2563eb' });
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [error, setError] = useState('');

  async function load() { setCats(await api('/admin/categories')); }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/categories', { method: 'POST', body: form });
      setForm({ name: '', color: '#2563eb' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function saveEdit() {
    await api(`/admin/categories/${edit.id}`, { method: 'PUT', body: { name: edit.name, color: edit.color } });
    setEdit(null);
    load();
  }

  async function doDelete() {
    await api(`/admin/categories/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Categories</h1>

      <form onSubmit={create} className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <label className="text-sm flex-1">Name
          <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="text-sm">Color
          <input type="color" className="mt-1 h-10 w-16 rounded border border-slate-300" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </label>
        <button className="btn-primary">Add Category</button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="p-3">Name</th><th>Color</th><th>Links</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{c.name}</td>
                <td><span className="inline-block w-6 h-6 rounded" style={{ background: c.color }} /></td>
                <td>{c.link_count}</td>
                <td className="text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => setEdit({ ...c })} className="btn-outline text-xs">Edit</button>
                  <button onClick={() => setConfirmDel(c)} className="btn-outline text-xs text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit category" footer={<>
        <button onClick={() => setEdit(null)} className="btn-outline">Cancel</button>
        <button onClick={saveEdit} className="btn-primary">Save</button>
      </>}>
        {edit && (
          <div className="space-y-3">
            <label className="block text-sm">Name
              <input className="input mt-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="block text-sm">Color
              <input type="color" className="mt-1 h-10 w-16 rounded border border-slate-300" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            </label>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete category?" footer={<>
        <button onClick={() => setConfirmDel(null)} className="btn-outline">Cancel</button>
        <button onClick={doDelete} className="btn bg-red-600 text-white hover:bg-red-700">Delete</button>
      </>}>
        Delete <strong>{confirmDel?.name}</strong>? Links in this category will become uncategorized.
      </Modal>
    </div>
  );
}
