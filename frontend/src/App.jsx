import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LinkStats from './pages/LinkStats.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';
import { useAuth } from './auth.jsx';

function Private({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && !role.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
          <Route path="/links/:id" element={<Private><LinkStats /></Private>} />
          <Route path="/settings" element={<Private><Settings /></Private>} />
          <Route path="/admin" element={<Private role={['admin', 'superadmin']}><Admin /></Private>} />
          <Route path="*" element={<div className="p-10 text-center">Not found</div>} />
        </Routes>
      </main>
      <footer className="py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} BKKGO Shortlink System
      </footer>
    </div>
  );
}
