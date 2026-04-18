import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config.js';

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 29);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}

/** Ticks del eje Y en enteros, sin duplicados (evita 1,1,1,0,0 cuando el máximo es 1). */
function integerYTicks(maxY) {
  const cap = Math.max(1, Math.ceil(Number(maxY) || 0));
  if (cap <= 8) {
    return Array.from({ length: cap + 1 }, (_, i) => i);
  }
  const step = Math.max(1, Math.ceil(cap / 5));
  const ticks = [0];
  for (let v = step; v < cap; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== cap) ticks.push(cap);
  return ticks;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function IncidentesLineChart({ serie }) {
  const w = 760;
  const h = 240;
  const padL = 44;
  const padR = 20;
  const padT = 16;
  const padB = 44;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(1, ...serie.map((s) => s.cantidad));
  const n = Math.max(serie.length, 1);
  const pts = serie.map((s, i) => {
    const x = padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + innerH - (s.cantidad / maxY) * innerH;
    return { x, y, ...s };
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const labelStep = n <= 14 ? 1 : n <= 31 ? 2 : Math.ceil(n / 14);

  return (
    <svg
      className="reporte-chart-svg"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Gráfica de incidentes por día"
    >
      <rect x="0" y="0" width={w} height={h} fill="var(--color-surface, #fff)" rx="8" />
      <text x={padL} y={14} fontSize="11" fill="var(--color-text-muted, #64748b)">
        Número de incidentes
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        const val = Math.round(maxY * t);
        return (
          <g key={t}>
            <line
              x1={padL}
              y1={y}
              x2={w - padR}
              y2={y}
              stroke="var(--color-border, #e2e8f0)"
              strokeWidth="1"
            />
            <text x={4} y={y + 4} fontSize="9" fill="var(--color-text-muted, #64748b)">
              {val}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        stroke="var(--admin-accent, #3b82f6)"
        strokeWidth="2.5"
        points={poly}
      />
      {pts.map((p, i) => (
        <circle key={`${p.fecha}-${i}`} cx={p.x} cy={p.y} r="4" fill="var(--admin-accent, #2563eb)" />
      ))}
      {pts.map((p, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <text
            key={`lbl-${p.fecha}`}
            x={p.x}
            y={h - 10}
            fontSize="9"
            textAnchor="middle"
            fill="var(--color-text-muted, #64748b)"
            transform={`rotate(-35 ${p.x} ${h - 10})`}
          >
            {p.fecha.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

function IncidentesBarChart({ porTipo }) {
  const w = 520;
  const h = 210;
  const padL = 40;
  const padR = 16;
  const padT = 22;
  const padB = 62;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(porTipo.length, 1);
  const maxY = Math.max(1, ...porTipo.map((p) => p.ocurrencias));
  const gap = 8;
  const maxBarW = 48;
  const slot = n > 0 ? (innerW - gap * (n - 1)) / n : innerW;
  const barW = Math.min(maxBarW, Math.max(12, slot));
  const clusterW = n * barW + (n - 1) * gap;
  const startX = padL + Math.max(0, (innerW - clusterW) / 2);
  const yTicks = integerYTicks(maxY);

  return (
    <svg
      className="reporte-chart-svg reporte-chart-svg--bar"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Gráfica de barras: ocurrencias por tipo de incidente"
    >
      <rect x="0" y="0" width={w} height={h} fill="var(--color-surface, #fff)" rx="8" />
      <text x={padL} y={14} fontSize="11" fill="var(--color-text-muted, #64748b)">
        Ocurrencias
      </text>
      {yTicks.map((val) => {
        const y = padT + innerH * (1 - val / maxY);
        return (
          <g key={`y-${val}`}>
            <line
              x1={padL}
              y1={y}
              x2={w - padR}
              y2={y}
              stroke="var(--color-border, #e2e8f0)"
              strokeWidth="1"
            />
            <text x={4} y={y + 4} fontSize="10" fill="var(--color-text-muted, #64748b)">
              {val}
            </text>
          </g>
        );
      })}
      {porTipo.map((p, i) => {
        const x = startX + i * (barW + gap);
        const bh = (p.ocurrencias / maxY) * innerH;
        const y = padT + innerH - bh;
        const top = p.esMasFrecuente;
        return (
          <g key={String(p.incidenteId ?? i)}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(bh, 2)}
              rx={4}
              fill={top ? 'var(--reporte-bar-max, #ea580c)' : 'var(--admin-accent, #3b82f6)'}
              stroke={top ? '#c2410c' : '#1d4ed8'}
              strokeWidth={top ? 2 : 0.5}
              opacity={top ? 1 : 0.88}
            />
            <text
              x={x + barW / 2}
              y={h - 10}
              fontSize="9"
              textAnchor="middle"
              fill="var(--color-text-muted, #64748b)"
              transform={`rotate(-38 ${x + barW / 2} ${h - 10})`}
            >
              {String(p.tipoIncidente).slice(0, 18)}
              {String(p.tipoIncidente).length > 18 ? '…' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function IncidentesPieChart({ resueltos, pendientes }) {
  /** Vista compacta: pastel pequeño a la izquierda, leyenda a la derecha (evita escalar a todo el ancho). */
  const cx = 68;
  const cy = 72;
  const r = 52;
  const w = 280;
  const h = 148;
  const total = resueltos + pendientes;

  const Leyenda = ({ y0, y1 }) => (
    <g transform="translate(138, 0)" aria-hidden="true">
      <rect x="0" y={y0 - 9} width="9" height="9" rx="2" fill="#16a34a" />
      <text x="14" y={y0} fontSize="11" fill="#166534" fontWeight="600">
        Resueltos: {resueltos}
        {total > 0 ? ` (${((resueltos / total) * 100).toFixed(0)}%)` : ''}
      </text>
      <rect x="0" y={y1 - 9} width="9" height="9" rx="2" fill="#f59e0b" />
      <text x="14" y={y1} fontSize="11" fill="#9a3412" fontWeight="600">
        Pendientes: {pendientes}
        {total > 0 ? ` (${((pendientes / total) * 100).toFixed(0)}%)` : ''}
      </text>
    </g>
  );

  if (total === 0) {
    return (
      <svg
        className="reporte-chart-svg reporte-chart-svg--pie"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Sin datos"
      >
        <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="11" fill="var(--color-text-muted, #64748b)">
          Sin datos para graficar
        </text>
      </svg>
    );
  }

  if (pendientes === 0) {
    return (
      <svg
        className="reporte-chart-svg reporte-chart-svg--pie"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Todos los incidentes están resueltos"
      >
        <circle cx={cx} cy={cy} r={r} fill="#16a34a" stroke="#e2e8f0" strokeWidth="1.5" />
        <Leyenda y0={56} y1={82} />
      </svg>
    );
  }

  if (resueltos === 0) {
    return (
      <svg
        className="reporte-chart-svg reporte-chart-svg--pie"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Todos los incidentes están pendientes"
      >
        <circle cx={cx} cy={cy} r={r} fill="#f59e0b" stroke="#e2e8f0" strokeWidth="1.5" />
        <Leyenda y0={56} y1={82} />
      </svg>
    );
  }

  const aRes = (resueltos / total) * 2 * Math.PI;
  const x0 = cx + r * Math.cos(-Math.PI / 2);
  const y0 = cy + r * Math.sin(-Math.PI / 2);
  const x1 = cx + r * Math.cos(-Math.PI / 2 + aRes);
  const y1 = cy + r * Math.sin(-Math.PI / 2 + aRes);
  const largeRes = aRes > Math.PI ? 1 : 0;
  const dRes = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeRes} 1 ${x1} ${y1} Z`;
  const aPen = 2 * Math.PI - aRes;
  const largePen = aPen > Math.PI ? 1 : 0;
  const dPen = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largePen} 1 ${x0} ${y0} Z`;

  return (
    <svg
      className="reporte-chart-svg reporte-chart-svg--pie"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Resueltos y pendientes en proporción`}
    >
      <path d={dRes} fill="#16a34a" stroke="#fff" strokeWidth="1.5" />
      <path d={dPen} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
      <Leyenda y0={56} y1={82} />
    </svg>
  );
}

export default function ReportesIncidentesPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState('fechas');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [filtroTipoId, setFiltroTipoId] = useState('');
  const [tiposIncidente, setTiposIncidente] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTipo, setLoadingTipo] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [dataTipo, setDataTipo] = useState(null);
  const [dataResolucion, setDataResolucion] = useState(null);
  const [loadingResolucion, setLoadingResolucion] = useState(false);
  const [filtroEstadoResolucion, setFiltroEstadoResolucion] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/incidente`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok || !Array.isArray(json)) return;
        if (cancelled) return;
        setTiposIncidente(
          json.map((t) => ({
            id: t.INC_ID ?? t.inc_id,
            nombre: t.INC_TIPO ?? t.inc_tipo ?? '—',
          }))
        );
      } catch {
        /* catálogo opcional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generarFechas = useCallback(async () => {
    setError('');
    setLoading(true);
    setData(null);
    try {
      const q = new URLSearchParams({ desde, hasta });
      const res = await fetch(`${API_BASE}/reportes/incidentes?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setData(json);
    } catch (e) {
      setError(e.message || 'No se pudo obtener el reporte');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  const generarPorTipo = useCallback(async () => {
    setError('');
    setLoadingTipo(true);
    setDataTipo(null);
    try {
      const q = new URLSearchParams({ desde, hasta });
      const res = await fetch(`${API_BASE}/reportes/incidentes-por-tipo?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setDataTipo(json);
    } catch (e) {
      setError(e.message || 'No se pudo obtener el reporte');
    } finally {
      setLoadingTipo(false);
    }
  }, [desde, hasta]);

  const exportarPdfFechas = () => {
    const q = new URLSearchParams({ desde, hasta });
    if (filtroTipoId) q.set('inc_id', filtroTipoId);
    window.open(`${API_BASE}/reportes/incidentes/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const exportarPdfTipo = () => {
    const q = new URLSearchParams({ desde, hasta });
    window.open(`${API_BASE}/reportes/incidentes-por-tipo/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const generarPorResolucion = useCallback(async () => {
    setError('');
    setLoadingResolucion(true);
    setDataResolucion(null);
    try {
      const q = new URLSearchParams({ desde, hasta });
      const res = await fetch(`${API_BASE}/reportes/incidentes-por-resolucion?${q}`, {
        cache: 'no-store',
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setDataResolucion(json);
    } catch (e) {
      setError(e.message || 'No se pudo obtener el reporte');
    } finally {
      setLoadingResolucion(false);
    }
  }, [desde, hasta]);

  const exportarPdfResolucion = () => {
    const q = new URLSearchParams({ desde, hasta });
    window.open(`${API_BASE}/reportes/incidentes-por-resolucion/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const detalleFiltrado = useMemo(() => {
    if (!data?.detalle) return [];
    if (!filtroTipoId) return data.detalle;
    return data.detalle.filter((r) => String(r.incId) === String(filtroTipoId));
  }, [data, filtroTipoId]);

  const detalleResolucionFiltrado = useMemo(() => {
    if (!dataResolucion?.detalle) return [];
    if (!filtroEstadoResolucion) return dataResolucion.detalle;
    return dataResolucion.detalle.filter((r) => r.estadoClave === filtroEstadoResolucion);
  }, [dataResolucion, filtroEstadoResolucion]);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Reportes</h1>
        <p className="admin-page-desc">
          Análisis de incidentes: tendencia por fechas, frecuencia por tipo y distribución por estado de
          resolución, con exportación a PDF.
        </p>
      </header>

      <div className="reporte-tabs" role="tablist" aria-label="Tipo de reporte">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'fechas'}
          className={`reporte-tab-btn${tab === 'fechas' ? ' reporte-tab-btn--active' : ''}`}
          onClick={() => setTab('fechas')}
        >
          Tendencia por fechas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tipo'}
          className={`reporte-tab-btn${tab === 'tipo' ? ' reporte-tab-btn--active' : ''}`}
          onClick={() => setTab('tipo')}
        >
          Por tipo de incidente
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'resolucion'}
          className={`reporte-tab-btn${tab === 'resolucion' ? ' reporte-tab-btn--active' : ''}`}
          onClick={() => setTab('resolucion')}
        >
          Por estado de resolución
        </button>
      </div>

      {tab === 'fechas' ? (
        <>
          <section className="reporte-inc-card" aria-labelledby="reporte-hu1-titulo">
            <h2 id="reporte-hu1-titulo" className="reporte-inc-card__title">
              Incidentes por rango de fechas
            </h2>
            <form
              className="reporte-inc-form"
              onSubmit={(e) => {
                e.preventDefault();
                generarFechas();
              }}
            >
              <label className="reporte-inc-field">
                <span>Fecha inicio</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
              </label>
              <label className="reporte-inc-field">
                <span>Fecha fin</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
              </label>
              <label className="reporte-inc-field reporte-inc-field--grow">
                <span>Tipo de incidente (tabla)</span>
                <select
                  value={filtroTipoId}
                  onChange={(e) => setFiltroTipoId(e.target.value)}
                  aria-label="Filtrar la tabla por tipo de incidente"
                >
                  <option value="">Todos los tipos</option>
                  {tiposIncidente.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="reporte-inc-form__actions">
                <button type="submit" className="admin-btn-primary" disabled={loading}>
                  {loading ? 'Generando…' : 'Generar reporte'}
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={exportarPdfFechas}
                  disabled={loading || !desde || !hasta}
                >
                  Exportar PDF
                </button>
              </div>
            </form>
          </section>
        </>
      ) : tab === 'tipo' ? (
        <section className="reporte-inc-card" aria-labelledby="reporte-hu2-titulo">
          <h2 id="reporte-hu2-titulo" className="reporte-inc-card__title">
            Incidentes agrupados por tipo
          </h2>
          <form
            className="reporte-inc-form"
            onSubmit={(e) => {
              e.preventDefault();
              generarPorTipo();
            }}
          >
            <label className="reporte-inc-field">
              <span>Fecha inicio</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </label>
            <label className="reporte-inc-field">
              <span>Fecha fin</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </label>
            <div className="reporte-inc-form__actions">
              <button type="submit" className="admin-btn-primary" disabled={loadingTipo}>
                {loadingTipo ? 'Generando…' : 'Generar reporte'}
              </button>
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={exportarPdfTipo}
                disabled={loadingTipo || !desde || !hasta}
              >
                Exportar PDF
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="reporte-inc-card" aria-labelledby="reporte-hu3-titulo">
          <h2 id="reporte-hu3-titulo" className="reporte-inc-card__title">
            Incidentes por estado de resolución
          </h2>
          <form
            className="reporte-inc-form"
            onSubmit={(e) => {
              e.preventDefault();
              generarPorResolucion();
            }}
          >
            <label className="reporte-inc-field">
              <span>Fecha inicio</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </label>
            <label className="reporte-inc-field">
              <span>Fecha fin</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </label>
            <div className="reporte-inc-form__actions">
              <button type="submit" className="admin-btn-primary" disabled={loadingResolucion}>
                {loadingResolucion ? 'Generando…' : 'Generar reporte'}
              </button>
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={exportarPdfResolucion}
                disabled={loadingResolucion || !desde || !hasta}
              >
                Exportar PDF
              </button>
            </div>
          </form>
        </section>
      )}

      {error ? (
        <div className="admin-banner admin-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {tab === 'fechas' && data && data.resumen?.totalIncidentes === 0 ? (
        <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p>
      ) : null}

      {tab === 'fechas' && data && data.resumen?.totalIncidentes > 0 ? (
        <>
          <div className="admin-kpi-grid" style={{ marginTop: '1.25rem' }}>
            <article className="admin-kpi admin-kpi--alerts">
              <div className="admin-kpi-label">Total de incidentes</div>
              <div className="admin-kpi-value">{data.resumen.totalIncidentes}</div>
              <div className="admin-kpi-hint">En el rango seleccionado</div>
            </article>
            <article className="admin-kpi admin-kpi--spaces">
              <div className="admin-kpi-label">Promedio diario</div>
              <div className="admin-kpi-value">{data.resumen.promedioDiario}</div>
              <div className="admin-kpi-hint">Incidentes ÷ días del período</div>
            </article>
            <article className="admin-kpi admin-kpi--alerts2">
              <div className="admin-kpi-label">Día con más incidentes</div>
              <div className="admin-kpi-value" style={{ fontSize: '1.35rem' }}>
                {data.resumen.fechaConMasIncidentes
                  ? `${data.resumen.fechaConMasIncidentes} (${data.resumen.maxIncidentesEnUnDia})`
                  : '—'}
              </div>
              <div className="admin-kpi-hint">Fecha y cantidad máxima en un día</div>
            </article>
          </div>
          <div className="reporte-inc-chart-wrap">
            <h3 className="reporte-inc-subtitle">Tendencia (incidentes por día)</h3>
            <IncidentesLineChart serie={data.serieDiaria} />
          </div>
          <div className="reporte-inc-table-wrap">
            <h3 className="reporte-inc-subtitle">Detalle</h3>
            {filtroTipoId && detalleFiltrado.length === 0 ? (
              <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>
                Ningún registro coincide con el tipo seleccionado en la tabla (el gráfico y los totales
                siguen mostrando todo el período).
              </p>
            ) : null}
            <div className="crudx-table-scroll">
              <table className="crudx-table reporte-inc-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Tipo de incidente</th>
                    <th>Descripción</th>
                    <th>Placa</th>
                    <th>Estado de resolución</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-muted">
                        —
                      </td>
                    </tr>
                  ) : (
                    detalleFiltrado.map((row) => (
                      <tr key={String(row.id)}>
                        <td>
                          {row.fechaHora
                            ? new Date(row.fechaHora).toLocaleString('es-GT')
                            : '—'}
                        </td>
                        <td>{row.tipoIncidente}</td>
                        <td className="reporte-inc-desc">{row.descripcion}</td>
                        <td>{row.placa}</td>
                        <td>{row.estadoResolucion}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'tipo' && dataTipo && dataTipo.totalRegistros === 0 ? (
        <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p>
      ) : null}

      {tab === 'tipo' && dataTipo && dataTipo.totalRegistros > 0 ? (
        <>
          {dataTipo.tipoMasFrecuente ? (
            <div className="reporte-tipo-destacado" role="status">
              <strong>Tipo más frecuente:</strong>{' '}
              <span className="reporte-tipo-destacado__nombre">
                {dataTipo.tipoMasFrecuente.tipoIncidente}
              </span>
              <span className="reporte-tipo-destacado__meta">
                {' '}
                ({dataTipo.tipoMasFrecuente.ocurrencias}{' '}
                {dataTipo.tipoMasFrecuente.ocurrencias === 1 ? 'ocurrencia' : 'ocurrencias'})
              </span>
            </div>
          ) : null}
          <div className="reporte-inc-chart-wrap">
            <h3 className="reporte-inc-subtitle">Ocurrencias por tipo de incidente</h3>
            <IncidentesBarChart porTipo={dataTipo.porTipo} />
            <p className="admin-muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              La barra en color destacado corresponde al tipo (o tipos empatados) con más ocurrencias.
            </p>
          </div>
          <div className="reporte-inc-table-wrap">
            <h3 className="reporte-inc-subtitle">Resumen por tipo</h3>
            <div className="crudx-table-scroll">
              <table className="crudx-table reporte-inc-table">
                <thead>
                  <tr>
                    <th>Tipo de incidente</th>
                    <th>Ocurrencias</th>
                    <th>Resueltos</th>
                    <th>Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {dataTipo.porTipo.map((row) => (
                    <tr
                      key={String(row.incidenteId)}
                      className={row.esMasFrecuente ? 'reporte-inc-table__row--max' : ''}
                    >
                      <td>
                        {row.tipoIncidente}
                        {row.esMasFrecuente ? (
                          <span className="reporte-inc-badge-max" aria-label="Más frecuente">
                            {' '}
                            ★ Más frecuente
                          </span>
                        ) : null}
                      </td>
                      <td>{row.ocurrencias}</td>
                      <td>{row.resueltos}</td>
                      <td>{row.pendientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'resolucion' && dataResolucion && dataResolucion.totalRegistros === 0 ? (
        <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p>
      ) : null}

      {tab === 'resolucion' && dataResolucion && dataResolucion.totalRegistros > 0 ? (
        <>
          <div className="admin-kpi-grid reporte-res-kpi" style={{ marginTop: '1.25rem' }}>
            <article className="admin-kpi admin-kpi--members">
              <div className="admin-kpi-label">Incidentes resueltos</div>
              <div className="admin-kpi-value">{dataResolucion.resueltos}</div>
              <div className="admin-kpi-hint">En el período seleccionado</div>
            </article>
            <article className="admin-kpi admin-kpi--alerts">
              <div className="admin-kpi-label">Incidentes pendientes</div>
              <div className="admin-kpi-value">{dataResolucion.pendientes}</div>
              <div className="admin-kpi-hint">Aún sin marcar como resueltos</div>
            </article>
            <article className="admin-kpi admin-kpi--spaces">
              <div className="admin-kpi-label">Tiempo promedio de resolución</div>
              <div className="admin-kpi-value">
                {dataResolucion.resueltos > 0
                  ? dataResolucion.tiempoPromedioResolucionEtiqueta || '—'
                  : '—'}
              </div>
              <div className="admin-kpi-hint">Entre registro y fecha de resolución (solo resueltos)</div>
            </article>
          </div>

          <div className="reporte-inc-chart-wrap">
            <h3 className="reporte-inc-subtitle">Proporción resueltos / pendientes</h3>
            <IncidentesPieChart
              resueltos={dataResolucion.resueltos}
              pendientes={dataResolucion.pendientes}
            />
          </div>

          <div className="reporte-inc-table-wrap">
            <h3 className="reporte-inc-subtitle">Detalle</h3>
            <label className="reporte-inc-field reporte-inc-field--inline" style={{ marginBottom: '0.75rem' }}>
              <span>Estado de resolución (tabla)</span>
              <select
                value={filtroEstadoResolucion}
                onChange={(e) => setFiltroEstadoResolucion(e.target.value)}
                aria-label="Filtrar la tabla por estado de resolución"
              >
                <option value="">Todos</option>
                <option value="resuelto">Resuelto</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
            {filtroEstadoResolucion && detalleResolucionFiltrado.length === 0 ? (
              <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>
                Ningún registro coincide con el filtro de estado (el gráfico y los totales siguen
                mostrando todo el período).
              </p>
            ) : null}
            <div className="crudx-table-scroll">
              <table className="crudx-table reporte-inc-table">
                <thead>
                  <tr>
                    <th>Tipo de incidente</th>
                    <th>Placa</th>
                    <th>Fecha de registro</th>
                    <th>Estado de resolución</th>
                    <th>Fecha de resolución</th>
                    <th>Usuario que resolvió</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleResolucionFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-muted">
                        —
                      </td>
                    </tr>
                  ) : (
                    detalleResolucionFiltrado.map((row) => (
                      <tr key={String(row.id)}>
                        <td>{row.tipoIncidente}</td>
                        <td>{row.placa}</td>
                        <td>
                          {row.fechaRegistro
                            ? new Date(row.fechaRegistro).toLocaleString('es-GT')
                            : '—'}
                        </td>
                        <td>{row.estadoResolucion}</td>
                        <td>
                          {row.fechaResolucion
                            ? new Date(row.fechaResolucion).toLocaleString('es-GT')
                            : '—'}
                        </td>
                        <td>{row.usuarioResolvio}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
