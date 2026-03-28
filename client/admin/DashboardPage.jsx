import { Link } from 'react-router-dom';
import { useAdminDashboard } from '../hooks/useAdminDashboard.js';
import { ADMIN_NAV_ROUTES, adminPath } from './adminNavConfig.js';

function pick(row, ...names) {
  if (!row) return undefined;
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n];
    const u = n.toUpperCase();
    if (row[u] != null && row[u] !== '') return row[u];
  }
  return undefined;
}

export default function DashboardPage() {
  const { stats, loading, error, reload, updatedAt, pollMs } = useAdminDashboard();

  const navSections = ADMIN_NAV_ROUTES.filter((r) => !r.isDashboard && !r.isPlaceholder);

  return (
    <div className="admin-page admin-dashboard">
      <header className="admin-page-header admin-dashboard-intro">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-desc">
            Resumen operativo del parqueo. Los datos se actualizan solos cada pocos segundos mientras
            mantengas esta vista abierta.
          </p>
        </div>
        <div className="admin-dashboard-meta">
          <button type="button" className="admin-btn-ghost" onClick={() => reload()}>
            Actualizar ahora
          </button>
          {updatedAt && (
            <span className="admin-muted">
              Última actualización: {updatedAt.toLocaleTimeString('es-GT')}
            </span>
          )}
          <span className="admin-muted">· Refresco automático ~{Math.round(pollMs / 1000)}s</span>
        </div>
      </header>

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          No se pudieron cargar los indicadores: {error}. Comprueba que el API responda y la base
          esté conectada.
        </div>
      )}

      <section className="admin-kpi-grid" aria-label="Indicadores principales">
        <article className="admin-kpi admin-kpi--spaces">
          <div className="admin-kpi-label">Espacios disponibles</div>
          <div className="admin-kpi-value">
            {loading && stats.espaciosDisponibles == null ? '—' : stats.espaciosDisponibles}
          </div>
          <div className="admin-kpi-hint">
            de {stats.espaciosTotales ?? '—'} espacios totales (según catálogo de estado)
          </div>
        </article>
        <article className="admin-kpi admin-kpi--alerts">
          <div className="admin-kpi-label">Alertas pendientes de atención</div>
          <div className="admin-kpi-value">
            {loading && stats.alertasPendientes == null ? '—' : stats.alertasPendientes}
          </div>
          <div className="admin-kpi-hint">Sin fecha de atención registrada</div>
        </article>
        <article className="admin-kpi admin-kpi--alerts2">
          <div className="admin-kpi-label">Alertas en estado «activo»</div>
          <div className="admin-kpi-value">
            {loading && stats.alertasActivasCatalogo == null ? '—' : stats.alertasActivasCatalogo}
          </div>
          <div className="admin-kpi-hint">Según catálogo PAR_ESTADO_ALERTA</div>
        </article>
        <article className="admin-kpi admin-kpi--members">
          <div className="admin-kpi-label">Membresías</div>
          <div className="admin-kpi-split">
            <div>
              <span className="admin-kpi-sub">Activas / vigentes</span>
              <span className="admin-kpi-num">{stats.membresiasActivas ?? (loading ? '—' : 0)}</span>
            </div>
            <div>
              <span className="admin-kpi-sub">Suspendidas</span>
              <span className="admin-kpi-num">{stats.membresiasSuspendidas ?? (loading ? '—' : 0)}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="admin-panel-block" aria-label="Alertas recientes">
        <div className="admin-panel-head">
          <h2>Alertas recientes</h2>
          <Link className="admin-link" to={adminPath('alertas')}>
            Ir a gestión de alertas →
          </Link>
        </div>
        {stats.ultimasAlertas?.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Motivo</th>
                  <th>Generación</th>
                  <th>Atención</th>
                </tr>
              </thead>
              <tbody>
                {stats.ultimasAlertas.map((row) => (
                  <tr key={String(pick(row, 'ALE_ID'))}>
                    <td>{pick(row, 'ALE_ID')}</td>
                    <td>{pick(row, 'ALE_MOTIVO') || '—'}</td>
                    <td>
                      {pick(row, 'ALE_FECHA_HORA_GENERACION')
                        ? new Date(pick(row, 'ALE_FECHA_HORA_GENERACION')).toLocaleString('es-GT')
                        : '—'}
                    </td>
                    <td>
                      {pick(row, 'ALE_FECHA_ATENCION') ? (
                        <span className="admin-pill admin-pill--ok">Atendida</span>
                      ) : (
                        <span className="admin-pill admin-pill--warn">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-muted admin-pad">No hay alertas registradas o aún se están cargando.</p>
        )}
      </section>

      <section className="admin-panel-block" aria-label="Accesos al panel">
        <div className="admin-panel-head">
          <h2>Módulos del panel</h2>
          <p className="admin-panel-sub">
            Desde aquí puedes abrir cada área de gestión. Coinciden con el menú lateral.
          </p>
        </div>
        <div className="admin-quick-grid">
          {navSections.map((r) => (
            <Link key={r.path} className="admin-quick-card" to={adminPath(r.path)}>
              <span className="admin-quick-icon" aria-hidden="true">
                {r.icon}
              </span>
              <span className="admin-quick-title">{r.label}</span>
              <span className="admin-quick-desc">{r.description}</span>
            </Link>
          ))}
          <Link
            className="admin-quick-card admin-quick-card--muted"
            to={adminPath('reportes')}
          >
            <span className="admin-quick-icon" aria-hidden="true">
              ▤
            </span>
            <span className="admin-quick-title">Reportes</span>
            <span className="admin-quick-desc">Disponible en un sprint posterior</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
