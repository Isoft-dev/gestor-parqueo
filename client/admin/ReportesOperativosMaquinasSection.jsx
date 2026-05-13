import { useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { API_BASE } from '../config.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

async function fetchCatalog(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    const json = await parseJsonSafe(res);
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

export default function ReportesOperativosMaquinasSection() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState('alertas');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [catalogMaquinas, setCatalogMaquinas] = useState([]);
  const [catalogTipoAlerta, setCatalogTipoAlerta] = useState([]);
  const [catalogEstadoAlerta, setCatalogEstadoAlerta] = useState([]);
  const [catalogIncidente, setCatalogIncidente] = useState([]);

  const [fMaqId, setFMaqId] = useState('');
  const [fTalId, setFTalId] = useState('');
  const [fEalId, setFEalId] = useState('');
  const [fIncId, setFIncId] = useState('');
  const [fEstadoResolucion, setFEstadoResolucion] = useState('');

  const [dataAlertas, setDataAlertas] = useState(null);
  const [dataMantenimientos, setDataMantenimientos] = useState(null);
  const [dataRecargas, setDataRecargas] = useState(null);
  const [dataIncidentes, setDataIncidentes] = useState(null);

  // Estados para filtros interactivos locales
  const [filtroMaquinaAlertas, setFiltroMaquinaAlertas] = useState('');
  const [filtroMaquinaMant, setFiltroMaquinaMant] = useState('');
  const [filtroMaquinaRecargas, setFiltroMaquinaRecargas] = useState('');
  const [filtroTipoIncidente, setFiltroTipoIncidente] = useState('');

  useEffect(() => {
    fetchCatalog('/maquina').then(setCatalogMaquinas);
    fetchCatalog('/tipo-alerta').then(setCatalogTipoAlerta);
    fetchCatalog('/estado-alerta').then(setCatalogEstadoAlerta);
    fetchCatalog('/incidente').then(setCatalogIncidente);
  }, []);

  useEffect(() => {
    setError('');
    setDataAlertas(null);
    setDataMantenimientos(null);
    setDataRecargas(null);
    setDataIncidentes(null);
    
    // Limpiar filtros locales
    setFiltroMaquinaAlertas('');
    setFiltroMaquinaMant('');
    setFiltroMaquinaRecargas('');
    setFiltroTipoIncidente('');
    setFEstadoResolucion(''); // También limpiar el de resolución
  }, [tab]);

  const generate = async () => {
    setError('');
    setLoading(true);
    try {
      if (tab === 'alertas') {
        const q = new URLSearchParams({ desde, hasta });
        if (fMaqId) q.set('maq_id', fMaqId);
        if (fTalId) q.set('tal_id', fTalId);
        if (fEalId) q.set('eal_id', fEalId);
        const res = await fetch(`${API_BASE}/reportes/operativos/alertas?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setDataAlertas(json);
      } else if (tab === 'mantenimientos') {
        const q = new URLSearchParams({ desde, hasta });
        const res = await fetch(`${API_BASE}/reportes/operativos/mantenimientos?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setDataMantenimientos(json);
      } else if (tab === 'recargas') {
        const q = new URLSearchParams({ desde, hasta });
        const res = await fetch(`${API_BASE}/reportes/operativos/recargas?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setDataRecargas(json);
      } else {
        const q = new URLSearchParams({ desde, hasta });
        if (fIncId) q.set('inc_id', fIncId);
        const [a, b, c] = await Promise.all([
          fetch(`${API_BASE}/reportes/incidentes?${q}`, { cache: 'no-store' }),
          fetch(`${API_BASE}/reportes/incidentes-por-tipo?${new URLSearchParams({ desde, hasta })}`, { cache: 'no-store' }),
          fetch(`${API_BASE}/reportes/incidentes-por-resolucion?${new URLSearchParams({ desde, hasta })}`, { cache: 'no-store' }),
        ]);
        const ja = await parseJsonSafe(a);
        const jb = await parseJsonSafe(b);
        const jc = await parseJsonSafe(c);
        if (!a.ok) throw new Error(ja.error || ja.message || a.statusText);
        if (!b.ok) throw new Error(jb.error || jb.message || b.statusText);
        if (!c.ok) throw new Error(jc.error || jc.message || c.statusText);
        setDataIncidentes({
          porRango: ja,
          porTipo: jb,
          porResolucion: jc,
        });
      }
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    const q = new URLSearchParams({ desde, hasta });
    if (tab === 'alertas') {
      if (fMaqId) q.set('maq_id', fMaqId);
      if (fTalId) q.set('tal_id', fTalId);
      if (fEalId) q.set('eal_id', fEalId);
      window.open(`${API_BASE}/reportes/operativos/alertas/pdf?${q}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (tab === 'mantenimientos') {
      window.open(`${API_BASE}/reportes/operativos/mantenimientos/pdf?${q}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (tab === 'recargas') {
      window.open(`${API_BASE}/reportes/operativos/recargas/pdf?${q}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (fIncId) q.set('inc_id', fIncId);
    window.open(`${API_BASE}/reportes/incidentes/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const alertasChartData = {
    labels: (dataAlertas?.alertasPorMaquina || []).map((x) => x.maquina),
    datasets: [
      {
        label: 'Alertas',
        data: (dataAlertas?.alertasPorMaquina || []).map((x) => x.total),
        backgroundColor: '#2563eb',
      },
    ],
  };

  const incidentesTipoChartData = {
    labels: (dataIncidentes?.porTipo?.porTipo || []).map((x) => x.tipoIncidente),
    datasets: [
      {
        label: 'Ocurrencias',
        data: (dataIncidentes?.porTipo?.porTipo || []).map((x) => x.ocurrencias),
        backgroundColor: '#0ea5e9',
      },
    ],
  };

  const incidentesPieData = {
    labels: ['Resueltos', 'Pendientes'],
    datasets: [
      {
        data: [
          Number(dataIncidentes?.porResolucion?.resueltos || 0),
          Number(dataIncidentes?.porResolucion?.pendientes || 0),
        ],
        backgroundColor: ['#22c55e', '#f59e0b'],
      },
    ],
  };

  const incidentesDetalle = (() => {
    const base = dataIncidentes?.porResolucion?.detalle || [];
    const descById = new Map(
      (dataIncidentes?.porRango?.detalle || []).map((r) => [String(r.id), r.descripcion || '—'])
    );
    return base.map((r) => ({ ...r, descripcion: descById.get(String(r.id)) || '—' }));
  })();

  const incidentesDetalleFiltrado = incidentesDetalle.filter((r) => {
    const matchEstado = !fEstadoResolucion || String(r.estadoClave || '').toLowerCase() === fEstadoResolucion.toLowerCase();
    const matchTipo = !filtroTipoIncidente || r.tipoIncidente === filtroTipoIncidente;
    return matchEstado && matchTipo;
  });

  return (
    <>
      <div className="reporte-tabs" role="tablist" aria-label="Subreportes operativos de máquinas">
        <button type="button" role="tab" aria-selected={tab === 'alertas'} className={`reporte-tab-btn${tab === 'alertas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('alertas')}>
          Alertas por máquina y tipo
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mantenimientos'} className={`reporte-tab-btn${tab === 'mantenimientos' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('mantenimientos')}>
          Mantenimientos por máquina
        </button>
        <button type="button" role="tab" aria-selected={tab === 'recargas'} className={`reporte-tab-btn${tab === 'recargas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('recargas')}>
          Recargas de efectivo
        </button>
        <button type="button" role="tab" aria-selected={tab === 'incidentes'} className={`reporte-tab-btn${tab === 'incidentes' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('incidentes')}>
          Incidentes
        </button>
      </div>

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">
          {tab === 'alertas'
            ? 'Reporte de alertas por máquina y tipo'
            : tab === 'mantenimientos'
              ? 'Reporte de mantenimientos por máquina'
              : tab === 'recargas'
                ? 'Reporte de recargas de efectivo por máquina'
                : 'Reporte de incidentes'}
        </h2>

        <form
          className="reporte-inc-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
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

          {tab === 'alertas' ? (
            <>
              <label className="reporte-inc-field">
                <span>Máquina</span>
                <select value={fMaqId} onChange={(e) => setFMaqId(e.target.value)}>
                  <option value="">Todas</option>
                  {catalogMaquinas.map((m) => (
                    <option key={String(m.MAQ_ID ?? m.maq_id)} value={String(m.MAQ_ID ?? m.maq_id)}>
                      {m.MAQ_CODIGO ?? m.maq_codigo ?? `M-${m.MAQ_ID ?? m.maq_id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Tipo alerta</span>
                <select value={fTalId} onChange={(e) => setFTalId(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogTipoAlerta.map((t) => (
                    <option key={String(t.TAL_ID ?? t.tal_id)} value={String(t.TAL_ID ?? t.tal_id)}>
                      {t.TAL_TIPO ?? t.tal_tipo ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Estado</span>
                <select value={fEalId} onChange={(e) => setFEalId(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogEstadoAlerta.map((t) => (
                    <option key={String(t.EAL_ID ?? t.eal_id)} value={String(t.EAL_ID ?? t.eal_id)}>
                      {t.EAL_ESTADO ?? t.eal_estado ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {tab === 'incidentes' ? (
            <>
              <label className="reporte-inc-field">
                <span>Tipo de incidente</span>
                <select value={fIncId} onChange={(e) => setFIncId(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogIncidente.map((i) => (
                    <option key={String(i.INC_ID ?? i.inc_id)} value={String(i.INC_ID ?? i.inc_id)}>
                      {i.INC_TIPO ?? i.inc_tipo ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Estado de resolución</span>
                <select value={fEstadoResolucion} onChange={(e) => setFEstadoResolucion(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </label>
            </>
          ) : null}

          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading || !desde || !hasta}>
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

      {tab === 'alertas' && dataAlertas ? (
        <>
          {!dataAlertas.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {dataAlertas.detalle?.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts">
                  <div className="admin-kpi-label">Total alertas</div>
                  <div className="admin-kpi-value">{dataAlertas.totalAlertas}</div>
                </article>
              </div>
              <div className="reporte-inc-chart-wrap">
                <h3 className="reporte-inc-subtitle">Alertas por máquina (¡Haz clic en una barra!)</h3>
                <div style={{ height: 280 }}>
                  <Bar 
                    data={alertasChartData} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false,
                      onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                          setFiltroMaquinaAlertas(chart.data.labels[elements[0].index]);
                        }
                      }
                    }} 
                  />
                </div>
              </div>
              <div className="reporte-inc-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de alertas</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {filtroMaquinaAlertas && (
                      <button 
                        type="button" 
                        className="admin-btn-ghost" 
                        onClick={() => setFiltroMaquinaAlertas('')}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Quitar filtro: {filtroMaquinaAlertas} ✖
                      </button>
                    )}
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Tipo de alerta</th>
                        <th>Motivo</th>
                        <th>Fecha generación</th>
                        <th>Estado actual</th>
                        <th>Fecha atención</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataAlertas.detalle
                        .filter(r => !filtroMaquinaAlertas || r.maquina === filtroMaquinaAlertas)
                        .map((r) => (
                          <tr key={String(r.alertaId)}>
                            <td>{r.maquina}</td>
                            <td>{r.tipoAlerta}</td>
                            <td>{r.motivo}</td>
                            <td>{r.fechaGeneracion ? new Date(r.fechaGeneracion).toLocaleString('es-GT') : '—'}</td>
                            <td>{r.estadoActual}</td>
                            <td>{r.fechaAtencion ? new Date(r.fechaAtencion).toLocaleString('es-GT') : '—'}</td>
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

      {tab === 'mantenimientos' && dataMantenimientos ? (
        <>
          {!dataMantenimientos.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {dataMantenimientos.detalle?.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">Total mantenimientos</div>
                  <div className="admin-kpi-value">{dataMantenimientos.totalMantenimientos}</div>
                </article>
              </div>
              <div className="reporte-inc-table-wrap">
                <h3 className="reporte-inc-subtitle">Promedio de días entre mantenimientos</h3>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Promedio de días</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataMantenimientos.promedioDiasEntreMantenimientos.map((r) => (
                        <tr key={r.maquina}>
                          <td>{r.maquina}</td>
                          <td>{r.promedioDias == null ? 'N/D (menos de 2 registros)' : `${r.promedioDias} días`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="reporte-inc-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de mantenimientos</h3>
                  <input 
                    type="text" 
                    placeholder="Buscar por máquina..." 
                    value={filtroMaquinaMant}
                    onChange={(e) => setFiltroMaquinaMant(e.target.value)}
                    className="admin-input"
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Tipo de máquina</th>
                        <th>Fecha mantenimiento</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataMantenimientos.detalle
                        .filter(r => r.maquina?.toLowerCase().includes(filtroMaquinaMant.toLowerCase()))
                        .map((r) => (
                          <tr key={String(r.mantenimientoId)}>
                            <td>{r.maquina}</td>
                            <td>{r.tipoMaquina}</td>
                            <td>{r.fechaMantenimiento ? new Date(r.fechaMantenimiento).toLocaleString('es-GT') : '—'}</td>
                            <td>{r.descripcion}</td>
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

      {tab === 'recargas' && dataRecargas ? (
        <>
          {!dataRecargas.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {dataRecargas.detalle?.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts2">
                  <div className="admin-kpi-label">Total recargas</div>
                  <div className="admin-kpi-value">{dataRecargas.totalRecargas}</div>
                </article>
              </div>
              <div className="reporte-inc-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de recargas</h3>
                  <input 
                    type="text" 
                    placeholder="Buscar por máquina..." 
                    value={filtroMaquinaRecargas}
                    onChange={(e) => setFiltroMaquinaRecargas(e.target.value)}
                    className="admin-input"
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Fecha recarga</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataRecargas.detalle
                        .filter(r => r.maquina?.toLowerCase().includes(filtroMaquinaRecargas.toLowerCase()))
                        .map((r) => (
                          <tr key={String(r.recargaId)}>
                            <td>{r.maquina}</td>
                            <td>{r.fechaRecarga ? new Date(r.fechaRecarga).toLocaleString('es-GT') : '—'}</td>
                            <td>{r.descripcion}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="reporte-inc-table-wrap">
                <h3 className="reporte-inc-subtitle">Saldo actual por máquina (por denominación)</h3>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Saldo total</th>
                        <th>Desglose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataRecargas.saldoActualPorMaquina.map((r) => (
                        <tr key={r.maquina}>
                          <td>{r.maquina}</td>
                          <td>Q{Number(r.saldoTotal || 0).toFixed(2)}</td>
                          <td>
                            {(r.denominaciones || [])
                              .map((d) => `Q${d.valorBillete}: ${d.cantidad} (Q${Number(d.subtotal || 0).toFixed(2)})`)
                              .join(' · ')}
                          </td>
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

      {tab === 'incidentes' && dataIncidentes ? (
        <>
          {!dataIncidentes.porRango?.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {dataIncidentes.porRango?.detalle?.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts">
                  <div className="admin-kpi-label">Total incidentes</div>
                  <div className="admin-kpi-value">{dataIncidentes.porRango?.resumen?.totalIncidentes ?? 0}</div>
                </article>
                <article className="admin-kpi admin-kpi--alerts2">
                  <div className="admin-kpi-label">Tipo más frecuente</div>
                  <div className="admin-kpi-value" style={{ fontSize: '1rem' }}>
                    {dataIncidentes.porTipo?.tipoMasFrecuente?.tipoIncidente || '—'}
                  </div>
                </article>
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">Resueltos / Pendientes</div>
                  <div className="admin-kpi-value" style={{ fontSize: '1rem' }}>
                    {dataIncidentes.porResolucion?.resueltos ?? 0} / {dataIncidentes.porResolucion?.pendientes ?? 0}
                  </div>
                  <div className="admin-kpi-hint">
                    Promedio resolución: {dataIncidentes.porResolucion?.tiempoPromedioResolucionEtiqueta || '—'}
                  </div>
                </article>
              </div>

              <div className="reporte-inc-chart-wrap">
                <h3 className="reporte-inc-subtitle">Incidentes por tipo (¡Haz clic en una barra!)</h3>
                <div style={{ height: 280 }}>
                  <Bar 
                    data={incidentesTipoChartData} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false,
                      onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                          setFiltroTipoIncidente(chart.data.labels[elements[0].index]);
                        }
                      }
                    }} 
                  />
                </div>
              </div>

              <div className="reporte-inc-chart-wrap">
                <h3 className="reporte-inc-subtitle">Proporción resueltos vs pendientes (¡Haz clic en un segmento!)</h3>
                <div style={{ height: 260, maxWidth: 360 }}>
                  <Pie 
                    data={incidentesPieData} 
                    options={{
                      onClick: (e, elements, chart) => {
                        if (elements.length > 0) {
                          const label = chart.data.labels[elements[0].index];
                          // Convertir "Resueltos" a "resuelto", "Pendientes" a "pendiente"
                          const clave = label.toLowerCase().slice(0, -1);
                          setFEstadoResolucion(clave);
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="reporte-inc-table-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de incidentes</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {filtroTipoIncidente && (
                      <button 
                        type="button" 
                        className="admin-btn-ghost" 
                        onClick={() => setFiltroTipoIncidente('')}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Tipo: {filtroTipoIncidente} ✖
                      </button>
                    )}
                    {fEstadoResolucion && (
                      <button 
                        type="button" 
                        className="admin-btn-ghost" 
                        onClick={() => setFEstadoResolucion('')}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Estado: {fEstadoResolucion} ✖
                      </button>
                    )}
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo incidente</th>
                        <th>Descripción</th>
                        <th>Placa</th>
                        <th>Estado</th>
                        <th>Fecha resolución</th>
                        <th>Usuario resolvió</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentesDetalleFiltrado.map((r) => (
                        <tr key={String(r.id)}>
                          <td>{r.fechaRegistro ? new Date(r.fechaRegistro).toLocaleString('es-GT') : '—'}</td>
                          <td>{r.tipoIncidente}</td>
                          <td>{r.descripcion || '—'}</td>
                          <td>{r.placa}</td>
                          <td>{r.estadoResolucion}</td>
                          <td>{r.fechaResolucion ? new Date(r.fechaResolucion).toLocaleString('es-GT') : '—'}</td>
                          <td>{r.usuarioResolvio || '—'}</td>
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
  );
}
