// Friendly 404 page shown for any unknown route in the SPA.
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center shadow-lg">
          <span className="text-5xl font-extrabold">404</span>
        </div>

        <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold text-slate-800">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-slate-600">
          Maaf, kami tidak menemukan apa pun di{' '}
          <code className="px-1.5 py-0.5 bg-slate-100 rounded text-brand-700 break-all">
            {loc.pathname}
          </code>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Shortlink ini mungkin sudah dihapus, kedaluwarsa, atau tidak pernah ada.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">← Kembali ke Beranda</Link>
          <button onClick={() => nav(-1)} className="btn-outline">Halaman sebelumnya</button>
          <Link to="/dashboard" className="btn-outline">Dashboard</Link>
        </div>

        <div className="mt-10 text-xs text-slate-400">
          BKKGO Shortlink System · jika ini bug, silakan hubungi administrator.
        </div>
      </div>
    </div>
  );
}
