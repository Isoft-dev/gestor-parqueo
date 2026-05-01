import { useEffect, useMemo, useState } from 'react';
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

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function TiempoEstadiaPieChart({ rows }) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      dia: r.diaSemana,
      valor: Number(r.cantidadRegistros || 0),
    }))
    .filter((r) => r.valor > 0);

  const total = items.reduce((s, x) => s + x.valor, 0);
  const w = 460;
  const h = 210;
  const cx = 92;
  const cy = 102;
  const r = 68;
  const palette = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316'];

  if (!total) {
    return (
      <svg className="reporte-chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sin datos para gráfica circular">
        <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="12" fill="var(--color-text-muted, #64748b)">
          Sin datos para graficar
        </text>
      </svg>
    );
  }

  let angleStart = -Math.PI / 2;
  const paths = items.map((item, idx) => {
    const frac = item.valor / total;
    const angle = frac * 2 * Math.PI;
    const angleEnd = angleStart + angle;
    const x0 = cx + r * Math.cos(angleStart);
    const y0 = cy + r * Math.sin(angleStart);
    const x1 = cx + r * Math.cos(angleEnd);
    const y1 = cy + r * Math.sin(angleEnd);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    const out = {
      d,
      color: palette[idx % palette.length],
      dia: item.dia,
      valor: item.valor,
      porcentaje: (frac * 100).toFixed(0),
      labelX: cx + r * 0.62 * Math.cos(angleStart + angle / 2),
      labelY: cy + r * 0.62 * Math.sin(angleStart + angle / 2),
    };
    angleStart = angleEnd;
    return out;
  });

  return (
    <svg className="reporte-chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Distribución por día de la semana">
      {paths.map((p) => (
        <path key={p.dia} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.2" />
      ))}
      {paths.map((p) => (
        <text
          key={`${p.dia}-pct`}
          x={p.labelX}
          y={p.labelY}
          fontSize="10"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontWeight="700"
        >
          {p.porcentaje}%
        </text>
      ))}
      {paths.map((p, i) => (
        <g key={`${p.dia}-leg`} transform={`translate(190, ${24 + i * 24})`}>
          <rect x="0" y="-10" width="11" height="11" rx="2" fill={p.color} />
          <text x="18" y="-1" fontSize="11" fill="var(--color-text, #0f172a)" fontWeight="600">
            {p.dia}: {p.valor} ({p.porcentaje}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ReportesPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [seccion, setSeccion] = useState('movimiento');
  const [tabMov, setTabMov] = useState('frecuencia');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataByTab, setDataByTab] = useState({
    frecuencia: null,
    entradas_salidas: null,
    tiempo_estadia: null,
  });
  const data = dataByTab[tabMov];

  useEffect(() => {
    // Al cambiar de pestaña se limpia el resultado para evitar mezclar estructuras de datos.
    setError('');
    setDataByTab({
      frecuencia: null,
      entradas_salidas: null,
      tiempo_estadia: null,
    });
  }, [tabMov, seccion]);

  const generar = async () => {
    setError('');
    setLoading(true);
    setDataByTab((prev) => ({ ...prev, [tabMov]: null }));
    try {
      const q = new URLSearchParams({ desde, hasta });
      const pathByTab = {
        frecuencia: '/reportes/movimiento-vehicular/frecuencia',
        entradas_salidas: '/reportes/movimiento-vehicular/entradas-salidas',
        tiempo_estadia: '/reportes/movimiento-vehicular/tiempo-estadia',
      };
      const res = await fetch(`${API_BASE}${pathByTab[tabMov]}?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setDataByTab((prev) => ({ ...prev, [tabMov]: json }));
    } catch (e) {
      setError(e.message || 'No se pudo obtener el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportarPdf = () => {
    const q = new URLSearchParams({ desde, hasta });
    const pathByTab = {
      frecuencia: '/reportes/movimiento-vehicular/frecuencia/pdf',
      entradas_salidas: '/reportes/movimiento-vehicular/entradas-salidas/pdf',
      tiempo_estadia: '/reportes/movimiento-vehicular/tiempo-estadia/pdf',
    };
    window.open(`${API_BASE}${pathByTab[tabMov]}?${q}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Reportes</h1>
        <p className="admin-page-desc">
          Estructura de 5 secciones. Sección 1 activa: Reportes de movimiento vehicular.
        </p>
      </header>

      <div className="reporte-tabs" role="tablist" aria-label="Secciones de reportes">
        <button type="button" role="tab" aria-selected={seccion === 'movimiento'} className={`reporte-tab-btn${seccion === 'movimiento' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('movimiento')}>
          1) Movimiento vehicular
        </button>
        <button type="button" role="tab" aria-selected={false} className="reporte-tab-btn" disabled>
          2) Sección pendiente
        </button>
        <button type="button" role="tab" aria-selected={false} className="reporte-tab-btn" disabled>
          3) Sección pendiente
        </button>
        <button type="button" role="tab" aria-selected={false} className="reporte-tab-btn" disabled>
          4) Sección pendiente
        </button>
        <button type="button" role="tab" aria-selected={false} className="reporte-tab-btn" disabled>
          5) Sección pendiente
        </button>
      </div>

      {seccion === 'movimiento' ? (
        <>
          <div className="reporte-tabs" role="tablist" aria-label="Reportes de movimiento vehicular">
            <button type="button" role="tab" aria-selected={tabMov === 'frecuencia'} className={`reporte-tab-btn${tabMov === 'frecuencia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('frecuencia')}>
              Vehículos frecuentes
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'entradas_salidas'} className={`reporte-tab-btn${tabMov === 'entradas_salidas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('entradas_salidas')}>
              Entradas y salidas
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'tiempo_estadia'} className={`reporte-tab-btn${tabMov === 'tiempo_estadia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('tiempo_estadia')}>
              Tiempo promedio de estadía
            </button>
          </div>

          <section className="reporte-inc-card">
            <h2 className="reporte-inc-card__title">
              {tabMov === 'frecuencia'
                ? 'Reporte de vehículos con mayor frecuencia de visitas'
                : tabMov === 'entradas_salidas'
                  ? 'Reporte de entradas y salidas por rango de fechas'
                  : 'Reporte de tiempo promedio de estadía'}
            </h2>
            <form
              className="reporte-inc-form"
              onSubmit={(e) => {
                e.preventDefault();
                generar();
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
                <button type="submit" className="admin-btn-primary" disabled={loading}>
                  {loading ? 'Generando…' : 'Generar reporte'}
                </button>
                <button type="button" className="admin-btn-ghost" onClick={exportarPdf} disabled={loading || !desde || !hasta}>
                  Exportar PDF
                </button>
              </div>
            </form>
          </section>

          {error ? (
            <div className="admin-banner admin-banner--error" role="alert">
              {error}
            </div>
          ) : null}

          {tabMov === 'frecuencia' && data ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Vehículos en el rango</div>
                      <div className="admin-kpi-value">{data.totalVehiculos}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Top destacados</div>
                      <div className="admin-kpi-value">{Math.min(10, data.top10?.length || 0)}</div>
                    </article>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Top 10 vehículos más frecuentes</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Placa</th>
                            <th>Modelo</th>
                            <th>Color</th>
                            <th>Tipo de cliente</th>
                            <th>Visitas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.top10) ? data.top10 : []).map((r, i) => (
                            <tr key={`${r.placa}-${i}`}>
                              <td>{i + 1}</td>
                              <td>{r.placa}</td>
                              <td>{r.modelo}</td>
                              <td>{r.color}</td>
                              <td>{r.tipoCliente}</td>
                              <td>{r.visitas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tabMov === 'entradas_salidas' && data ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Total entradas</div>
                      <div className="admin-kpi-value">{data.totalEntradas}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--spaces">
                      <div className="admin-kpi-label">Total salidas</div>
                      <div className="admin-kpi-value">{data.totalSalidas}</div>
                    </article>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Detalle de flujo vehicular</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Tipo cliente</th>
                            <th>Referencia</th>
                            <th>Placa</th>
                            <th>Hora de entrada</th>
                            <th>Hora de salida</th>
                            <th>Tiempo de estadía</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.detalle) ? data.detalle : []).map((r, i) => (
                            <tr key={`${r.referencia}-${i}`}>
                              <td>{r.tipoCliente}</td>
                              <td>{r.referencia}</td>
                              <td>{r.placa}</td>
                              <td>{r.horaEntrada ? new Date(r.horaEntrada).toLocaleString('es-GT') : '—'}</td>
                              <td>{r.horaSalida ? new Date(r.horaSalida).toLocaleString('es-GT') : '—'}</td>
                              <td>{r.tiempoEstadia}</td>
                              <td>{r.estadoTicket}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tabMov === 'tiempo_estadia' && data ? (
            <>
              {!data.totalRegistros ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.totalRegistros > 0 ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces">
                      <div className="admin-kpi-label">Promedio general</div>
                      <div className="admin-kpi-value">{data.promedioGeneral?.etiqueta || '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Máximo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.maximo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.maximo ? `${data.maximo.placa} · ${new Date(data.maximo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Mínimo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.minimo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.minimo ? `${data.minimo.placa} · ${new Date(data.minimo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                  </div>
                  <div className="reporte-inc-chart-wrap">
                    <h3 className="reporte-inc-subtitle">
                      Distribución de registros por día de la semana (gráfica circular)
                    </h3>
                    <TiempoEstadiaPieChart rows={data.promedioPorDiaSemana} />
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Promedio por día de la semana</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Día</th>
                            <th>Promedio</th>
                            <th>Registros</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.promedioPorDiaSemana) ? data.promedioPorDiaSemana : []).map((r) => (
                            <tr key={r.diaSemana}>
                              <td>{r.diaSemana}</td>
                              <td>{r.promedioEtiqueta}</td>
                              <td>{r.cantidadRegistros}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
