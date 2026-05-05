// 401/403 page used when role-guarded routes reject access.
import { Link, useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const nav = useNavigate();
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white grid place-items-center shadow-lg">
          <span className="text-5xl font-extrabold">403</span>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-slate-800">Akses ditolak</h1>
        <p className="mt-3 text-slate-600">
          Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-primary">← Beranda</Link>
          <button onClick={() => nav(-1)} className="btn-outline">Halaman sebelumnya</button>
          <Link to="/login" className="btn-outline">Login dengan akun lain</Link>
        </div>
      </div>
    </div>
  );
}
