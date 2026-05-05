// Inline QR preview modal — fetches PNG with auth header and displays it.
// Pass `apiPath` to override the default user endpoint (e.g. admin endpoint).
import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { getToken, shortUrl } from '../api';

export default function QrPreviewModal({ link, onClose, apiPath }) {
  const [src, setSrc] = useState('');
  const path = apiPath || `/api/links/${link.id}/qrcode`;

  useEffect(() => {
    let url;
    fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((b) => { url = URL.createObjectURL(b); setSrc(url); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [path]);

  function download() {
    const a = document.createElement('a');
    a.href = src;
    a.download = `bkkgo-qr-${link.short_code}.png`;
    a.click();
  }

  return (
    <Modal open onClose={onClose} title={`QR — ${link.short_code}`}>
      <div className="text-center space-y-3">
        {src
          ? <img src={src} alt="QR code preview" className="mx-auto border border-slate-200 rounded p-2 bg-white max-w-full h-auto" />
          : <div className="py-10 text-slate-500">Generating…</div>}
        <div className="text-xs text-slate-500 break-all">{shortUrl(link.short_code)}</div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button onClick={onClose} className="btn-outline">Close</button>
          <button onClick={download} disabled={!src} className="btn-primary">Download PNG</button>
        </div>
      </div>
    </Modal>
  );
}
