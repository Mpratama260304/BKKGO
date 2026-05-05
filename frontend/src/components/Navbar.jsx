import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">B</div>
          <span className="font-bold text-lg text-slate-800">BKKGO</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <NavLink to="/dashboard" className="btn-outline">Dashboard</NavLink>
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <NavLink to="/admin" className="btn-outline">Admin</NavLink>
              )}
              <span className="text-sm text-slate-600 hidden sm:inline">{user.email}</span>
              <button onClick={logout} className="btn-primary">Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn-outline">Login</NavLink>
              <NavLink to="/register" className="btn-primary">Sign Up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
