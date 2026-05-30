/**
 * GlobalSlicerBar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barra de filtros globales "estilo Power BI" para el módulo de Reportes.
 *
 * Props:
 *   tiposCliente   — string[]  (opciones del select; defecto [])
 *   tiposVehiculo  — string[]  (opciones del select; defecto [])
 *   onGenerar      — () => void  callback para disparar la búsqueda (opcional)
 *   loading        — bool
 *   seccion        — string  nombre de la sección activa (p.ej. 'movimiento')
 *
 * Comportamiento de dimensiones (tipoCliente / tipoVehiculo):
 *   Solo la sección 'movimiento' usa estas dimensiones en sus llamadas al servidor.
 *   En otras secciones los selects se ocultan y los chips se muestran con
 *   estilo "inactivo" para indicar que no están aplicando.
 */

import { useReportFilter } from './ReportFilterContext.jsx';

/** Secciones donde tipoCliente/tipoVehiculo afectan realmente la consulta */
const SECCIONES_CON_DIMENSION = ['movimiento'];

export default function GlobalSlicerBar({
  tiposCliente = [],
  tiposVehiculo = [],
  onGenerar,
  loading = false,
  seccion = '',
}) {
  const { filtros, setFiltro, limpiar, filtrosActivos, DEFAULTS } = useReportFilter();

  const TODAY = new Date().toISOString().slice(0, 10);

  const dimensionActiva = SECCIONES_CON_DIMENSION.includes(seccion);

  // Chips que corresponden a fecha (siempre aplican)
  const chipsFecha = filtrosActivos.filter((f) => f.key === 'desde' || f.key === 'hasta');
  // Chips de dimensión (solo aplican en ciertas secciones)
  const chipsDimension = filtrosActivos.filter((f) => f.key !== 'desde' && f.key !== 'hasta');

  const hayChips = filtrosActivos.length > 0;

  return (
    <div className="global-slicer-bar">
      {/* ── Controles ── */}
      <div className="global-slicer-bar__controls">
        {/* Rango de fechas — siempre visible */}
        <label className="reporte-inc-field">
          <span>Desde</span>
          <input
            type="date"
            className="admin-input"
            value={filtros.desde}
            max={TODAY}
            onChange={(e) => setFiltro('desde', e.target.value)}
          />
        </label>
        <label className="reporte-inc-field">
          <span>Hasta</span>
          <input
            type="date"
            className="admin-input"
            value={filtros.hasta}
            max={TODAY}
            onChange={(e) => setFiltro('hasta', e.target.value)}
          />
        </label>

        {/* Tipo de cliente — solo cuando la sección lo usa y hay opciones */}
        {dimensionActiva && tiposCliente.length > 0 && (
          <label className="reporte-inc-field">
            <span>Tipo de cliente</span>
            <select
              value={filtros.tipoCliente}
              onChange={(e) => setFiltro('tipoCliente', e.target.value)}
            >
              <option value="Todos">Todos</option>
              {tiposCliente.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

        {/* Tipo de vehículo — solo cuando la sección lo usa y hay opciones */}
        {dimensionActiva && tiposVehiculo.length > 0 && (
          <label className="reporte-inc-field">
            <span>Tipo de vehículo</span>
            <select
              value={filtros.tipoVehiculo}
              onChange={(e) => setFiltro('tipoVehiculo', e.target.value)}
            >
              <option value="Todos">Todos</option>
              {tiposVehiculo.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

        {/* Acciones */}
        <div className="reporte-inc-form__actions" style={{ alignSelf: 'flex-end' }}>
          {onGenerar && (
            <button
              type="button"
              className="admin-btn-primary"
              onClick={onGenerar}
              disabled={loading}
            >
              {loading ? 'Generando…' : 'Aplicar'}
            </button>
          )}
          {hayChips && (
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={limpiar}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Chips de filtros activos ── */}
      {hayChips && (
        <div className="reporte-filter-chips" aria-label="Filtros activos">
          {/* Chips de fecha — siempre activos */}
          {chipsFecha.map(({ key, label, valor }) => (
            <button
              key={key}
              type="button"
              className="reporte-filter-chip"
              onClick={() => {}}
              title={label}
            >
              {label}: {valor}
            </button>
          ))}

          {/* Chips de dimensión */}
          {chipsDimension.map(({ key, label, valor }) =>
            dimensionActiva ? (
              /* Activo: aplica en esta sección → puede quitarse con ✕ */
              <button
                key={key}
                type="button"
                className="reporte-filter-chip"
                onClick={() => setFiltro(key, DEFAULTS[key] ?? 'Todos')}
                title={`Quitar filtro: ${label}`}
              >
                {label}: {valor} ✕
              </button>
            ) : (
              /* Inactivo: está seteado pero no aplica aquí → chip atenuado + nota */
              <span
                key={key}
                className="reporte-filter-chip reporte-filter-chip--inactive"
                title="Este filtro no aplica en la sección actual"
              >
                {label}: {valor} (no aplica)
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
