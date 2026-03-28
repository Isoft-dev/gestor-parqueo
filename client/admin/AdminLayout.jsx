import { NavLink, Outlet } from 'react-router-dom';
import { ADMIN_NAV_ROUTES, adminPath } from './adminNavConfig.js';

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navegación principal">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true" />
          <div>
            <div className="admin-brand-title">Gestor de Parqueo</div>
            <div className="admin-brand-sub">Panel de administración</div>
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
