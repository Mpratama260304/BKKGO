// Admin → Users management. Sortable/filterable table with edit, block, reset, impersonate, delete.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import { api } from '../../api';
import { useAuth } from '../../auth.jsx';

export default function AdminUsers() {
  const { user, impersonate } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);          // user being edited
  const [confirmDel, setConfirmDel] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try { setUsers(await api('/admin/users')); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/admin/users/${edit.id}`, { method: 'PUT', body: {
        name: edit.name,
        email: edit.email,
        role: user.role === 'superadmin' ? edit.role : undefined,
        is_blocked: edit.is_blocked,
      } });
      setEdit(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function blockToggle(u) {
    await api(`/admin/users/${u.id}`, { method: 'PUT', body: { is_blocked: !u.is_blocked } });
    load();
  }

  async function resetPassword(u) {
    const r = await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' });
    setResetResult({ user: u, ...r });
  }

  async function doImpersonate(u) {
    const { token, user: imp } = await api(`/admin/impersonate/${u.id}`, { method: 'POST' });
    impersonate(token, imp);
    nav('/dashboard');
  }

  async function doDelete() {
    await api(`/admin/users/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    load();
  }

  const columns = [
    { key: 'email', label: 'Email', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role', sortable: true,
      render: (r) => <span className="text-xs px-2 py-0.5 rounded bg-slate-100">{r.role}</span> },
    { key: 'link_count', label: 'Links', sortable: true },
    { key: 'total_clicks', label: 'Clicks', sortable: true },
    { key: 'is_blocked', label: 'Status', sortable: true,
      render: (r) => r.is_blocked
        ? <span className="text-red-600 text-xs">Blocked</span>
        : <span className="text-emerald-600 text-xs">Active</span> },
    { key: 'created_at', label: 'Joined', sortable: true,
      render: (r) => <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</span> },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setEdit({ ...r })} className="btn-outline text-xs">Edit</button>
        <button onClick={() => blockToggle(r)} className="btn-outline text-xs">{r.is_blocked ? 'Unblock' : 'Block'}</button>
        <button onClick={() => resetPassword(r)} className="btn-outline text-xs">Reset PW</button>
        {user.role === 'superadmin' && r.id !== user.id && (
          <>
            <button onClick={() => doImpersonate(r)} className="btn-outline text-xs">Impersonate</button>
            <button onClick={() => setConfirmDel(r)} className="btn-outline text-xs text-red-600">Delete</button>
          </>
        )}
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Users</h1>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading ? <div className="text-slate-500">Loading…</div> :
        <DataTable columns={columns} rows={users} pageSize={10} searchPlaceholder="Search users by email, name, role…" />
      }

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Edit user"
        footer={<>
          <button onClick={() => setEdit(null)} className="btn-outline">Cancel</button>
          <button onClick={saveEdit} className="btn-primary">Save</button>
        </>}
      >
        {edit && (
          <form onSubmit={saveEdit} className="space-y-3">
            <label className="block text-sm">Name
              <input className="input mt-1" value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="block text-sm">Email
              <input className="input mt-1" type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </label>
            {user.role === 'superadmin' && (
              <label className="block text-sm">Role
                <select className="input mt-1" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.is_blocked} onChange={(e) => setEdit({ ...edit, is_blocked: e.target.checked })} />
              Block this account
            </label>
          </form>
        )}
      </Modal>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete user?"
        footer={<>
          <button onClick={() => setConfirmDel(null)} className="btn-outline">Cancel</button>
          <button onClick={doDelete} className="btn bg-red-600 text-white hover:bg-red-700">Delete</button>
        </>}
      >
        Permanently delete <strong>{confirmDel?.email}</strong> and all their links? This cannot be undone.
      </Modal>

      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="Password reset"
        footer={<button onClick={() => setResetResult(null)} className="btn-primary">Done</button>}
      >
        {resetResult && (
          <div>
            <p className="text-sm text-slate-600 mb-2">Temporary password for <strong>{resetResult.user.email}</strong>:</p>
            <code className="block p-3 bg-slate-100 rounded font-mono text-lg select-all">{resetResult.temp_password}</code>
            <p className="text-xs text-slate-500 mt-2">Share securely. The user should change it after logging in.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
