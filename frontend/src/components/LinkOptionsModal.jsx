// Reusable modal that lets a user/admin toggle landing & banner ad per link.
import { useEffect, useState } from 'react';
import { api } from '../api';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';

export default function LinkOptionsModal({ link, onClose, onSaved }) {
  const { push } = useToast();
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({
    landing_delay_enabled: !!link.landing_delay_enabled,
    banner_ad_enabled: !!link.banner_ad_enabled,
    banner_id: link.banner_id || '',
  });

  useEffect(() => {
    api('/links/banners/available').then(setBanners).catch(() => setBanners([]));
  }, []);

  async function save() {
    try {
      await api(`/links/${link.id}`, {
        method: 'PUT',
        body: {
          landing_delay_enabled: form.landing_delay_enabled ? 1 : 0,
          banner_ad_enabled: form.banner_ad_enabled ? 1 : 0,
          banner_id: form.banner_id || null,
        },
      });
      push('Saved', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      push(err.message, 'error');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Options — ${link.short_code}`}>
      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.landing_delay_enabled}
            onChange={(e) => setForm({ ...form, landing_delay_enabled: e.target.checked })}
          />
          <div>
            <div className="font-medium text-slate-800">Enable 5-second landing page</div>
            <div className="text-xs text-slate-500">Visitors see a countdown before being redirected.</div>
          </div>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.banner_ad_enabled}
            onChange={(e) => setForm({ ...form, banner_ad_enabled: e.target.checked })}
          />
          <div>
            <div className="font-medium text-slate-800">Show banner ad on landing page</div>
            <div className="text-xs text-slate-500">Requires the landing page above to be enabled.</div>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Banner</label>
          <select
            className="input"
            value={form.banner_id || ''}
            onChange={(e) => setForm({ ...form, banner_id: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">— Auto / random enabled banner —</option>
            {banners.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={save} className="btn-primary">Save</button>
        </div>
      </div>
    </Modal>
  );
}
