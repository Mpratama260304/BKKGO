// Admin shell with collapsible sidebar + topbar. Wraps nested admin pages via <Outlet />.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/links', label: 'Links', icon: '🔗' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { to: '/admin/categories', label: 'Categories', icon: '🏷️' },
  { to: '/admin/banners', label: 'Banner Ads', icon: '🎞️' },
  { to: '/admin/captcha', label: 'CAPTCHA', icon: '🛡️' },
  { to: '/admin/logs', label: 'Activity Logs', icon: '📜' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 flex">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-slate-900/40 z-30 sm:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed sm:static z-40 inset-y-0 left-0 w-64 bg-slate-900 text-slate-100 transform transition-transform sm:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <img src="/logo.svg" alt="logo" className="w-9 h-9 rounded-lg bg-white p-0.5" />
          <div>
            <div className="font-bold">BKKGO Admin</div>
            <div className="text-xs text-slate-400">{user?.role}</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-slate-800 text-xs">
          <div className="text-slate-400 mb-2 truncate">{user?.email}</div>
          <button onClick={() => { logout(); nav('/'); }} className="w-full btn bg-slate-800 hover:bg-slate-700 text-slate-100">
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sm:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="btn-outline text-sm">☰ Menu</button>
          <span className="font-semibold text-slate-700">BKKGO Admin</span>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
