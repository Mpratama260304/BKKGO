// Public landing page shown for shortlinks that have landing_delay_enabled or banner_ad_enabled.
// Counts down 5 seconds (skippable), shows banner ad if any, then redirects to original URL.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function Landing() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    api(`/landing/${code}`).then(setData).catch((e) => setError(e.message));
  }, [code]);

  // Countdown when delay enabled
  useEffect(() => {
    if (!data) return;
    const delay = data.landing_delay_enabled ? 5 : 0;
    setSeconds(delay);
    if (delay === 0) { goNow(); return; }
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(t); goNow(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function goNow() {
    if (!data) return;
    // Best-effort click log (fire-and-forget)
    fetch(`/api/landing/${code}/click`, { method: 'POST' }).catch(() => {});
    window.location.replace(data.original_url);
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-5xl">⚠️</div>
          <h1 className="mt-3 text-xl font-bold text-slate-800">Tautan tidak tersedia</h1>
          <p className="mt-2 text-slate-600 text-sm">{error}</p>
          <a href="/" className="btn-primary mt-5 inline-block">Beranda</a>
        </div>
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center text-slate-500">Memuat…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        <img src="/logo.svg" className="w-10 h-10 rounded-lg" alt="" />
        <div>
          <div className="font-bold text-slate-800">BKKGO</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">BKK Ananda Cemerlang</div>
        </div>
      </div>

      <div className="card max-w-xl w-full p-6 text-center">
        <div className="text-sm text-slate-500">Anda akan diarahkan ke:</div>
        <div className="mt-1 font-medium text-slate-800 break-all">{data.original_url}</div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-brand-600 text-white grid place-items-center text-2xl font-bold">
            {seconds}
          </div>
          <div className="text-sm text-slate-600">
            Tunggu sebentar atau klik tombol di samping untuk lanjut.
          </div>
          <button onClick={goNow} className="btn-primary">Lanjutkan →</button>
        </div>
      </div>

      {data.banner && (
        <a
          href={data.banner.link_url || '#'}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-8 block"
          aria-label="Sponsor banner"
        >
          <img
            src={data.banner.image_path}
            alt="Sponsor"
            style={{
              width: data.banner.width || 'auto',
              height: data.banner.height || 'auto',
              maxWidth: '100%',
            }}
            className="rounded-xl shadow"
          />
        </a>
      )}

      <div className="mt-8 text-xs text-slate-500">© {new Date().getFullYear()} BKK Ananda Cemerlang</div>
    </div>
  );
}
