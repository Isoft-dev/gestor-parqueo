import { NavLink, Outlet } from 'react-router-dom';
import { ADMIN_NAV_ROUTES, adminPath } from './adminNavConfig.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navegación principal">
        <div className="admin-brand">
          <div>
            <div className="admin-brand-title">Gestor de Parqueo</div>
            <div className="admin-brand-sub">Panel de administración</div>
            {user ? (
              <div className="admin-brand-sub" style={{ marginTop: 8 }}>
                {user.USU_PRIMER_NOMBRE} {user.USU_PRIMER_APELLIDO}
                <button
                  type="button"
                  className="admin-btn-ghost"
                  style={{ display: 'block', marginTop: 8 }}
                  onClick={() => logout()}
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <nav className="admin-nav">
          {ADMIN_NAV_ROUTES.map((r) => (
            <NavLink
              key={r.path || 'home'}
              to={adminPath(r.path)}
              end={!!r.isDashboard}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {r.icon}
              </span>
              <span>{r.label}</span>
            </NavLink>
          ))}
        </nav>
        <footer className="admin-sidebar-foot">Sprint 3 · Grupo 8</footer>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
