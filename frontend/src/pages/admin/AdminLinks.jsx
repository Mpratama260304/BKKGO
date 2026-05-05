// Admin → Links management. Sortable/filterable table with edit, block, delete, QR, category assignment.
import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import QrPreviewModal from '../../components/QrPreviewModal.jsx';
import { api, shortUrl } from '../../api';

export default function AdminLinks() {
  const [links, setLinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [qrLink, setQrLink] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  function toggleSelect(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() { setSelected(new Set(links.map((l) => l.id))); }
  function clearSelection() { setSelected(new Set()); }

  async function bulkAction(action) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Delete ${ids.length} link(s)? This cannot be undone.`)) return;
    try {
      await api('/admin/links/bulk', { method: 'POST', body: { ids, action } });
      clearSelection();
      load();
    } catch (e) { setError(e.message); }
  }

  async function load() {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([api('/admin/links'), api('/admin/categories')]);
      setLinks(l); setCategories(c);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/admin/links/${edit.id}`, { method: 'PUT', body: {
        original_url: edit.original_url,
        custom_alias: edit.custom_alias,
        title: edit.title,
        expires_at: edit.expires_at || null,
        category_id: edit.category_id ? Number(edit.category_id) : null,
      } });
      setEdit(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function blockToggle(l) {
    await api(`/admin/links/${l.id}/block`, { method: 'PUT', body: { is_blocked: !l.is_blocked } });
    load();
  }

  async function doDelete() {
    await api(`/admin/links/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    load();
  }

  function expiryStatus(l) {
    if (!l.expires_at) return <span className="text-slate-400 text-xs">—</span>;
    const exp = new Date(l.expires_at);
    if (exp < new Date()) return <span className="text-red-600 text-xs">Expired</span>;
    return <span className="text-amber-600 text-xs">{exp.toLocaleDateString()}</span>;
  }

  const columns = [
    { key: 'sel', label: '', render: (r) => (
      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
    ) },
    { key: 'short_code', label: 'Short', sortable: true,
      render: (r) => <a className="text-brand-600 font-medium" href={shortUrl(r.short_code)} target="_blank" rel="noreferrer">/{r.short_code}</a> },
    { key: 'owner', label: 'Owner', sortable: true,
      render: (r) => <span className="text-slate-600 text-xs">{r.owner}</span> },
    { key: 'original_url', label: 'Destination', sortable: true,
      render: (r) => <span className="truncate block max-w-xs text-slate-600" title={r.original_url}>{r.original_url}</span> },
    { key: 'category_name', label: 'Category', sortable: true,
      render: (r) => r.category_name
        ? <span className="text-xs px-2 py-0.5 rounded text-white" style={{ background: r.category_color }}>{r.category_name}</span>
        : <span className="text-slate-400 text-xs">—</span> },
    { key: 'click_count', label: 'Clicks', sortable: true },
    { key: 'unique_click_count', label: 'Unique', sortable: true },
    { key: 'expires_at', label: 'Expires', sortable: true, render: expiryStatus },
    { key: 'is_blocked', label: 'Status', sortable: true,
      render: (r) => r.is_blocked
        ? <span className="text-red-600 text-xs">Blocked</span>
        : <span className="text-emerald-600 text-xs">Active</span> },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setEdit({ ...r })} className="btn-outline text-xs">Edit</button>
        <button onClick={() => blockToggle(r)} className="btn-outline text-xs">{r.is_blocked ? 'Unblock' : 'Block'}</button>
        <button onClick={() => setQrLink(r)} className="btn-outline text-xs">QR</button>
        <button onClick={() => navigator.clipboard.writeText(shortUrl(r.short_code))} className="btn-outline text-xs">Copy</button>
        <button onClick={() => setConfirmDel(r)} className="btn-outline text-xs text-red-600">Delete</button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Links</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <>
              <span className="text-sm text-slate-500">{selected.size} selected</span>
              <button onClick={() => bulkAction('block')} className="btn-outline text-xs">Block</button>
              <button onClick={() => bulkAction('unblock')} className="btn-outline text-xs">Unblock</button>
              <button onClick={() => bulkAction('delete')} className="btn-outline text-xs text-red-600">Delete</button>
              <button onClick={clearSelection} className="btn-outline text-xs">Clear</button>
            </>
          ) : (
            <button onClick={selectAll} className="btn-outline text-xs">Select all</button>
          )}
        </div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading ? <div className="text-slate-500">Loading…</div> :
        <DataTable columns={columns} rows={links} pageSize={15} searchPlaceholder="Search by code, owner, URL, category…" />
      }

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={`Edit /${edit?.short_code}`}
        size="lg"
        footer={<>
          <button onClick={() => setEdit(null)} className="btn-outline">Cancel</button>
          <button onClick={saveEdit} className="btn-primary">Save</button>
        </>}
      >
        {edit && (
          <form onSubmit={saveEdit} className="space-y-3">
            <label className="block text-sm">Destination URL
              <input className="input mt-1" type="url" value={edit.original_url || ''} onChange={(e) => setEdit({ ...edit, original_url: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Custom alias
                <input className="input mt-1" value={edit.custom_alias || ''} onChange={(e) => setEdit({ ...edit, custom_alias: e.target.value })} />
              </label>
              <label className="block text-sm">Title
                <input className="input mt-1" value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Category
                <select className="input mt-1" value={edit.category_id || ''} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">Expires at
                <input className="input mt-1" type="datetime-local" value={edit.expires_at ? edit.expires_at.replace(' ', 'T').slice(0,16) : ''} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })} />
              </label>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete link?"
        footer={<>
          <button onClick={() => setConfirmDel(null)} className="btn-outline">Cancel</button>
          <button onClick={doDelete} className="btn bg-red-600 text-white hover:bg-red-700">Delete</button>
        </>}
      >
        Delete <strong>/{confirmDel?.short_code}</strong> permanently? All associated click data will also be removed.
      </Modal>

      {qrLink && (
        <QrPreviewModal
          link={qrLink}
          apiPath={`/api/admin/links/${qrLink.id}/qrcode`}
          onClose={() => setQrLink(null)}
        />
      )}
    </div>
  );
}
