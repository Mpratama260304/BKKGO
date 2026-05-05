// Admin → Activity Logs.
import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import { api } from '../../api';
import { useAuth } from '../../auth.jsx';

export default function AdminLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load() {
    setLoading(true);
    setRows(await api('/admin/logs?limit=500'));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function clearLogs() {
    await api('/admin/logs', { method: 'DELETE' });
    setConfirmClear(false);
    load();
  }

  const columns = [
    { key: 'created_at', label: 'When', sortable: true,
      render: (r) => <span className="text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</span> },
    { key: 'actor_email', label: 'Actor', sortable: true },
    { key: 'action', label: 'Action', sortable: true,
      render: (r) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.action}</code> },
    { key: 'target_type', label: 'Target', sortable: true,
      render: (r) => r.target_type ? `${r.target_type}#${r.target_id}` : '—' },
    { key: 'ip_address', label: 'IP', sortable: true,
      render: (r) => <span className="text-xs text-slate-500">{r.ip_address || '—'}</span> },
    { key: 'details', label: 'Details',
      render: (r) => r.details
        ? <code className="text-xs text-slate-600 break-all">{r.details}</code>
        : <span className="text-slate-400 text-xs">—</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
        {user.role === 'superadmin' && (
          <button onClick={() => setConfirmClear(true)} className="btn-outline text-sm text-red-600">Clear all</button>
        )}
      </div>

      {loading ? <div className="text-slate-500">Loading…</div> :
        <DataTable columns={columns} rows={rows} pageSize={20} searchPlaceholder="Search action, actor, target…" />
      }

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all logs?" footer={<>
        <button onClick={() => setConfirmClear(false)} className="btn-outline">Cancel</button>
        <button onClick={clearLogs} className="btn bg-red-600 text-white hover:bg-red-700">Clear</button>
      </>}>
        This permanently removes all activity log entries.
      </Modal>
    </div>
  );
}
