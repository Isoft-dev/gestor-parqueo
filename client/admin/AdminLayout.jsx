import { NavLink, Outlet } from 'react-router-dom';
import { adminPath } from './adminNavConfig.js';
import { getAllowedAdminRoutes, hasFullAdminAccess } from './adminRoleAccess.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const allowedRoutes = getAllowedAdminRoutes(user);
  const mainRoutes = allowedRoutes.filter((r) => r.path !== 'operacion-cabina' && r.path !== 'reportes');
  const reportRoutes = allowedRoutes.filter((r) => r.path === 'reportes');
  const panelSubtitle = hasFullAdminAccess(user) ? 'Panel de administración' : 'Panel operativo';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navegación principal">
        <div className="admin-brand">
          <div>
            <div className="admin-brand-title">Gestor de Parqueo</div>
            <div className="admin-brand-sub">{panelSubtitle}</div>
            {user ? (
              <div className="admin-brand-sub" style={{ marginTop: 8 }}>
                {user.USU_PRIMER_NOMBRE} {user.USU_PRIMER_APELLIDO}
                {user.ROL_TIPO ? <div style={{ marginTop: 4 }}>{user.ROL_TIPO}</div> : null}
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
          {mainRoutes.map((r) => (
            <NavLink
              key={r.path || 'home'}
              to={adminPath(r.path)}
              end={!!r.isDashboard}
              replace
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
          {hasFullAdminAccess(user) ? (
            <>
              <NavLink
                to="/admin/maquina-entrada"
                replace
                className={({ isActive }) =>
                  `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`
                }
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {'\u{1F39F}\uFE0F'}
                </span>
                <span>Máquina de entrada</span>
              </NavLink>
              <NavLink
                to="/admin/maquina-salida"
                replace
                className={({ isActive }) =>
                  `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`
                }
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {'\u{1F6AA}'}
                </span>
                <span>Máquina de salida</span>
              </NavLink>
              <NavLink
                to="/admin/maquina-cobro"
                replace
                className={({ isActive }) =>
                  `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`
                }
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {'\u{1F4B3}'}
                </span>
                <span>Máquina de cobro</span>
              </NavLink>
            </>
          ) : null}
          {reportRoutes.map((r) => (
            <NavLink
              key={r.path}
              to={adminPath(r.path)}
              replace
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
        <footer className="admin-sidebar-foot">Grupo 8</footer>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
