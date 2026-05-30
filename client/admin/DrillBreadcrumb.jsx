/**
 * DrillBreadcrumb.jsx — barra de navegación drill-down (Fase 5)
 *
 * Props:
 *   breadcrumbs — [{label, isRoot}]
 *   onBack      — () => void
 *   onReset     — () => void
 *   isDrilling  — bool
 */
export default function DrillBreadcrumb({ breadcrumbs = [], onBack, onReset, isDrilling }) {
  if (!isDrilling) return null;

  const currentLevel = breadcrumbs[breadcrumbs.length - 1];
  const canGoBack = breadcrumbs.length > 1;

  return (
    <div className="drill-breadcrumb" role="navigation" aria-label="Nivel de detalle actual">
      {/* Indicador de nivel */}
      <span className="drill-breadcrumb__badge">
        🔍 Detalle
      </span>

      {/* Ruta de migas */}
      <ol className="drill-breadcrumb__path" aria-label="Ruta de drill-down">
        {breadcrumbs.map((crumb, i) => (
          <li key={i} className="drill-breadcrumb__crumb">
            {i > 0 && <span className="drill-breadcrumb__sep" aria-hidden="true">›</span>}
            <span className={i === breadcrumbs.length - 1
              ? 'drill-breadcrumb__current'
              : crumb.isRoot
                ? 'drill-breadcrumb__root'
                : 'drill-breadcrumb__item'
            }>
              {crumb.label}
            </span>
          </li>
        ))}
      </ol>

      {/* Acciones */}
      <div className="drill-breadcrumb__actions">
        {canGoBack && (
          <button
            type="button"
            className="drill-breadcrumb__btn"
            onClick={onBack}
            title="Subir un nivel"
          >
            ← Nivel anterior
          </button>
        )}
        <button
          type="button"
          className="drill-breadcrumb__btn drill-breadcrumb__btn--exit"
          onClick={onReset}
          title="Volver a la vista general"
        >
          ↩ Vista general
        </button>
      </div>
    </div>
  );
}
