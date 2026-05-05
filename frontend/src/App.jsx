import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LinkStats from './pages/LinkStats.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminLinks from './pages/admin/AdminLinks.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminLogs from './pages/admin/AdminLogs.jsx';
import { useAuth } from './auth.jsx';

function Private({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && !role.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const loc = useLocation();
  const isAdminArea = loc.pathname.startsWith('/admin');

  return (
    <div className="min-h-full flex flex-col">
      {!isAdminArea && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
          <Route path="/links/:id" element={<Private><LinkStats /></Private>} />
          <Route path="/settings" element={<Private><Settings /></Private>} />

          {/* Admin area with sidebar layout */}
          <Route path="/admin" element={<Private role={['admin', 'superadmin']}><AdminLayout /></Private>}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="links" element={<AdminLinks />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAdminArea && (
        <footer className="py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} BKKGO Shortlink System
        </footer>
      )}
    </div>
  );
}
