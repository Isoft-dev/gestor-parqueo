import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  buildDoughnutOptions,
  buildLegendItems,
  createCenterTextPlugin,
  createVerticalGradient,
  formatCurrency,
  formatNumber,
} from './reportChartUtils.js';
import { ReportChartCard, ReportLegend } from './ReportChartPrimitives.jsx';

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

function clickedLabel(elements, chart) {
  if (!elements?.length || !chart?.data?.labels?.length) return '';
  return String(chart.data.labels[elements[0].index] || '');
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

  const [filtroMaquinaAlertas, setFiltroMaquinaAlertas] = useState('');
  const [filtroEstadoAlertaLocal, setFiltroEstadoAlertaLocal] = useState('');
  const [filtroMaquinaMant, setFiltroMaquinaMant] = useState('');
  const [filtroMovimientoMant, setFiltroMovimientoMant] = useState('');
  const [filtroEstadoFinalMant, setFiltroEstadoFinalMant] = useState('');
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
    setFiltroMaquinaAlertas('');
    setFiltroEstadoAlertaLocal('');
    setFiltroMaquinaMant('');
    setFiltroMovimientoMant('');
    setFiltroEstadoFinalMant('');
    setFiltroMaquinaRecargas('');
    setFiltroTipoIncidente('');
    setFEstadoResolucion('');
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

  const alertasDetalle = useMemo(() => (Array.isArray(dataAlertas?.detalle) ? dataAlertas.detalle : []), [dataAlertas]);
  const alertasPorEstado = useMemo(() => {
    const byStatus = new Map();
    alertasDetalle.forEach((row) => {
      const key = row.estadoActual || 'Sin estado';
      byStatus.set(key, (byStatus.get(key) || 0) + 1);
    });
    return [...byStatus.entries()].map(([label, value]) => ({ label, value }));
  }, [alertasDetalle]);

  const alertasChartData = {
    labels: (dataAlertas?.alertasPorMaquina || []).map((row) => row.maquina),
    datasets: [
      {
        label: 'Alertas',
        data: (dataAlertas?.alertasPorMaquina || []).map((row) => row.total),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#c4b5fd', REPORT_PALETTE.violet);
        },
      },
    ],
  };

  const alertasPieData = {
    labels: alertasPorEstado.map((row) => row.label),
    datasets: [
      {
        data: alertasPorEstado.map((row) => row.value),
        backgroundColor: alertasPorEstado.map((_, index) => [REPORT_PALETTE.violet, REPORT_PALETTE.amber, REPORT_PALETTE.teal, REPORT_PALETTE.blue][index % 4]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const alertasFiltradas = alertasDetalle.filter((row) => {
    const matchMachine = !filtroMaquinaAlertas || row.maquina === filtroMaquinaAlertas;
    const matchState = !filtroEstadoAlertaLocal || row.estadoActual === filtroEstadoAlertaLocal;
    return matchMachine && matchState;
  });

  const mantDetalle = useMemo(() => (Array.isArray(dataMantenimientos?.detalle) ? dataMantenimientos.detalle : []), [dataMantenimientos]);
  const mantPromedios = useMemo(
    () => (Array.isArray(dataMantenimientos?.promedioDiasEntreMantenimientos)
      ? dataMantenimientos.promedioDiasEntreMantenimientos
      : []),
    [dataMantenimientos]
  );
  const mantConteoPorMaquina = useMemo(
    () => (Array.isArray(dataMantenimientos?.totalPorMaquina) ? dataMantenimientos.totalPorMaquina : []),
    [dataMantenimientos]
  );
  const mantMovimientoBreakdown = useMemo(
    () => (Array.isArray(dataMantenimientos?.totalPorMovimiento) ? dataMantenimientos.totalPorMovimiento : []),
    [dataMantenimientos]
  );
  const mantEstadoFinalBreakdown = useMemo(
    () => (Array.isArray(dataMantenimientos?.totalPorEstadoFinal) ? dataMantenimientos.totalPorEstadoFinal : []),
    [dataMantenimientos]
  );

  const mantBarData = {
    labels: mantConteoPorMaquina.map((row) => row.maquina),
    datasets: [
      {
        label: 'Registros',
        data: mantConteoPorMaquina.map((row) => Number(row.total || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#93c5fd', REPORT_PALETTE.blue);
        },
      },
    ],
  };

  const mantPieData = {
    labels: mantMovimientoBreakdown.map((row) => row.movimiento),
    datasets: [
      {
        data: mantMovimientoBreakdown.map((row) => row.total),
        backgroundColor: mantMovimientoBreakdown.map((_, index) => [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber, REPORT_PALETTE.violet][index % 4]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const mantFinalStateData = {
    labels: mantEstadoFinalBreakdown.map((row) => row.estado),
    datasets: [
      {
        data: mantEstadoFinalBreakdown.map((row) => row.total),
        backgroundColor: mantEstadoFinalBreakdown.map((_, index) => [REPORT_PALETTE.green, REPORT_PALETTE.amber, REPORT_PALETTE.blue, REPORT_PALETTE.violet][index % 4]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const mantFiltrados = mantDetalle.filter((row) => {
    const matchMachine = row.maquina?.toLowerCase().includes(filtroMaquinaMant.toLowerCase());
    const matchMovement = !filtroMovimientoMant || row.tipoMovimiento === filtroMovimientoMant;
    const matchFinalState = !filtroEstadoFinalMant || row.estadoResultante === filtroEstadoFinalMant;
    return matchMachine && matchMovement && matchFinalState;
  });

  const recargasDetalle = useMemo(() => (Array.isArray(dataRecargas?.detalle) ? dataRecargas.detalle : []), [dataRecargas]);
  const saldoPorMaquina = useMemo(
    () => (Array.isArray(dataRecargas?.saldoActualPorMaquina) ? dataRecargas.saldoActualPorMaquina : []),
    [dataRecargas]
  );
  const recargasConteoPorMaquina = useMemo(() => {
    const byMachine = new Map();
    recargasDetalle.forEach((row) => {
      byMachine.set(row.maquina, (byMachine.get(row.maquina) || 0) + 1);
    });
    return [...byMachine.entries()].map(([label, value]) => ({ label, value }));
  }, [recargasDetalle]);

  const recargasBarData = {
    labels: recargasConteoPorMaquina.map((row) => row.label),
    datasets: [
      {
        label: 'Recargas',
        data: recargasConteoPorMaquina.map((row) => row.value),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#fdba74', REPORT_PALETTE.orange);
        },
      },
    ],
  };

  const recargasPieData = {
    labels: saldoPorMaquina.map((row) => row.maquina),
    datasets: [
      {
        data: saldoPorMaquina.map((row) => Number(row.saldoTotal || 0)),
        backgroundColor: saldoPorMaquina.map((_, index) => [REPORT_PALETTE.orange, REPORT_PALETTE.teal, REPORT_PALETTE.blue, REPORT_PALETTE.violet][index % 4]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const recargasFiltradas = recargasDetalle.filter((row) =>
    row.maquina?.toLowerCase().includes(filtroMaquinaRecargas.toLowerCase())
  );

  const incidentesTipoChartData = {
    labels: (dataIncidentes?.porTipo?.porTipo || []).map((row) => row.tipoIncidente),
    datasets: [
      {
        label: 'Ocurrencias',
        data: (dataIncidentes?.porTipo?.porTipo || []).map((row) => row.ocurrencias),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#93c5fd', REPORT_PALETTE.blue);
        },
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
        backgroundColor: [REPORT_PALETTE.green, REPORT_PALETTE.amber],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const incidentesDetalle = (() => {
    const base = dataIncidentes?.porResolucion?.detalle || [];
    const descById = new Map(
      (dataIncidentes?.porRango?.detalle || []).map((row) => [String(row.id), row.descripcion || '—'])
    );
    return base.map((row) => ({ ...row, descripcion: descById.get(String(row.id)) || '—' }));
  })();

  const incidentesDetalleFiltrado = incidentesDetalle.filter((row) => {
    const matchEstado = !fEstadoResolucion || String(row.estadoClave || '').toLowerCase() === fEstadoResolucion.toLowerCase();
    const matchTipo = !filtroTipoIncidente || row.tipoIncidente === filtroTipoIncidente;
    return matchEstado && matchTipo;
  });

  return (
    <>
      <div className="reporte-tabs" role="tablist" aria-label="Subreportes operativos de maquinas">
        <button type="button" role="tab" aria-selected={tab === 'alertas'} className={`reporte-tab-btn${tab === 'alertas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('alertas')}>
          Alertas por maquina y tipo
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mantenimientos'} className={`reporte-tab-btn${tab === 'mantenimientos' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('mantenimientos')}>
          Mantenimientos por maquina
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
            ? 'Reporte de alertas por maquina y tipo'
            : tab === 'mantenimientos'
              ? 'Reporte de mantenimientos por maquina'
              : tab === 'recargas'
                ? 'Reporte de recargas de efectivo por maquina'
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
                <span>Maquina</span>
                <select value={fMaqId} onChange={(e) => setFMaqId(e.target.value)}>
                  <option value="">Todas</option>
                  {catalogMaquinas.map((row) => (
                    <option key={String(row.MAQ_ID ?? row.maq_id)} value={String(row.MAQ_ID ?? row.maq_id)}>
                      {row.MAQ_CODIGO ?? row.maq_codigo ?? `M-${row.MAQ_ID ?? row.maq_id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Tipo alerta</span>
                <select value={fTalId} onChange={(e) => setFTalId(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogTipoAlerta.map((row) => (
                    <option key={String(row.TAL_ID ?? row.tal_id)} value={String(row.TAL_ID ?? row.tal_id)}>
                      {row.TAL_TIPO ?? row.tal_tipo ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Estado</span>
                <select value={fEalId} onChange={(e) => setFEalId(e.target.value)}>
                  <option value="">Todos</option>
                  {catalogEstadoAlerta.map((row) => (
                    <option key={String(row.EAL_ID ?? row.eal_id)} value={String(row.EAL_ID ?? row.eal_id)}>
                      {row.EAL_ESTADO ?? row.eal_estado ?? '—'}
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
                  {catalogIncidente.map((row) => (
                    <option key={String(row.INC_ID ?? row.inc_id)} value={String(row.INC_ID ?? row.inc_id)}>
                      {row.INC_TIPO ?? row.inc_tipo ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reporte-inc-field">
                <span>Estado de resolucion</span>
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
              {loading ? 'Generando...' : 'Generar reporte'}
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
          {!alertasDetalle.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {alertasDetalle.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts">
                  <div className="admin-kpi-label">Total alertas</div>
                  <div className="admin-kpi-value">{dataAlertas.totalAlertas}</div>
                </article>
              </div>

              <div className="reporte-chart-grid">
                <ReportChartCard title="Alertas por maquina" description="Haz clic en una barra para filtrar el detalle.">
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={alertasChartData}
                      options={buildCartesianOptions({
                        showLegend: false,
                        onClick: (_, elements, chart) => {
                          const label = clickedLabel(elements, chart);
                          if (label) setFiltroMaquinaAlertas(label);
                        },
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard title="Distribucion por estado" description="Haz clic en un segmento para concentrarte en ese estado.">
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut
                        data={alertasPieData}
                        options={buildDoughnutOptions({
                          onClick: (_, elements, chart) => {
                            const label = clickedLabel(elements, chart);
                            if (label) setFiltroEstadoAlertaLocal(label);
                          },
                        })}
                        plugins={[
                          createCenterTextPlugin([
                            { text: formatNumber(dataAlertas.totalAlertas || 0) },
                            { text: 'alertas', color: '#64748b' },
                          ]),
                        ]}
                      />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        alertasPieData.labels,
                        alertasPieData.datasets[0].data,
                        alertasPieData.datasets[0].backgroundColor
                      )}
                    />
                  </div>
                </ReportChartCard>
              </div>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de alertas</h3>
                  <div className="reporte-table-toolbar__controls">
                    {filtroMaquinaAlertas ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMaquinaAlertas('')}>
                        Maquina: {filtroMaquinaAlertas} x
                      </button>
                    ) : null}
                    {filtroEstadoAlertaLocal ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFiltroEstadoAlertaLocal('')}>
                        Estado: {filtroEstadoAlertaLocal} x
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Maquina</th>
                        <th>Tipo de alerta</th>
                        <th>Motivo</th>
                        <th>Fecha generacion</th>
                        <th>Estado actual</th>
                        <th>Fecha atencion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertasFiltradas.map((row) => (
                        <tr key={String(row.alertaId)}>
                          <td>{row.maquina}</td>
                          <td>{row.tipoAlerta}</td>
                          <td>{row.motivo}</td>
                          <td>{row.fechaGeneracion ? new Date(row.fechaGeneracion).toLocaleString('es-GT') : '—'}</td>
                          <td>{row.estadoActual}</td>
                          <td>{row.fechaAtencion ? new Date(row.fechaAtencion).toLocaleString('es-GT') : '—'}</td>
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
          {!mantDetalle.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {mantDetalle.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">Total registros</div>
                  <div className="admin-kpi-value">{dataMantenimientos.totalMantenimientos}</div>
                </article>
                <article className="admin-kpi admin-kpi--alerts">
                  <div className="admin-kpi-label">Inicios</div>
                  <div className="admin-kpi-value">{dataMantenimientos.totalInicios}</div>
                </article>
                <article className="admin-kpi admin-kpi--alerts2">
                  <div className="admin-kpi-label">Finalizaciones</div>
                  <div className="admin-kpi-value">{dataMantenimientos.totalFinalizaciones}</div>
                </article>
              </div>

              <div className="reporte-chart-grid">
                <ReportChartCard title="Registros por máquina" description="Haz clic sobre una barra para filtrar esa máquina.">
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={mantBarData}
                      options={buildCartesianOptions({
                        showLegend: false,
                        onClick: (_, elements, chart) => {
                          const label = clickedLabel(elements, chart);
                          if (label) setFiltroMaquinaMant(label);
                        },
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard title="Distribución por movimiento" description="El donut separa aperturas y cierres de mantenimiento.">
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut
                        data={mantPieData}
                        options={buildDoughnutOptions({
                          onClick: (_, elements, chart) => {
                            const label = clickedLabel(elements, chart);
                            if (label) setFiltroMovimientoMant(label);
                          },
                        })}
                        plugins={[
                          createCenterTextPlugin([
                            { text: formatNumber(dataMantenimientos.totalInicios || 0) },
                            { text: 'inicios', color: '#64748b' },
                          ]),
                        ]}
                      />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        mantPieData.labels,
                        mantPieData.datasets[0].data,
                        mantPieData.datasets[0].backgroundColor
                      )}
                    />
                  </div>
                </ReportChartCard>

                {mantEstadoFinalBreakdown.length ? (
                  <ReportChartCard title="Resultado de finalizaciones" description="Muestra cómo quedaron las máquinas al cerrar mantenimiento.">
                    <div className="reporte-chart-split">
                      <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                        <Doughnut
                          data={mantFinalStateData}
                          options={buildDoughnutOptions({
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroEstadoFinalMant(label);
                            },
                          })}
                          plugins={[
                            createCenterTextPlugin([
                              { text: formatNumber(dataMantenimientos.totalFinalizaciones || 0) },
                              { text: 'cierres', color: '#64748b' },
                            ]),
                          ]}
                        />
                      </div>
                      <ReportLegend
                        items={buildLegendItems(
                          mantFinalStateData.labels,
                          mantFinalStateData.datasets[0].data,
                          mantFinalStateData.datasets[0].backgroundColor
                        )}
                      />
                    </div>
                  </ReportChartCard>
                ) : null}
              </div>

              <div className="reporte-inc-table-wrap">
                <h3 className="reporte-inc-subtitle">Promedio de días entre inicios de mantenimiento</h3>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Promedio de días</th>
                        <th>Inicios considerados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mantPromedios.map((row) => (
                        <tr key={row.maquina}>
                          <td>{row.maquina}</td>
                          <td>{row.promedioDias == null ? 'N/D (menos de 2 inicios)' : `${row.promedioDias} días`}</td>
                          <td>{row.muestras}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de mantenimientos</h3>
                  <div className="reporte-table-toolbar__controls">
                    <input
                      type="text"
                      placeholder="Buscar por máquina..."
                      value={filtroMaquinaMant}
                      onChange={(e) => setFiltroMaquinaMant(e.target.value)}
                      className="admin-input reporte-table-input"
                    />
                    {filtroMovimientoMant ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMovimientoMant('')}>
                        Movimiento: {filtroMovimientoMant} x
                      </button>
                    ) : null}
                    {filtroEstadoFinalMant ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFiltroEstadoFinalMant('')}>
                        Estado final: {filtroEstadoFinalMant} x
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Máquina</th>
                        <th>Tipo de máquina</th>
                        <th>Movimiento</th>
                        <th>Fecha</th>
                        <th>Estado final</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mantFiltrados.map((row) => (
                        <tr key={String(row.mantenimientoId)}>
                          <td>{row.maquina}</td>
                          <td>{row.tipoMaquina}</td>
                          <td>{row.tipoMovimiento}</td>
                          <td>{row.fechaMantenimiento ? new Date(row.fechaMantenimiento).toLocaleString('es-GT') : '—'}</td>
                          <td>{row.tipoMovimientoClave === 'FINALIZACION' ? row.estadoResultante : '—'}</td>
                          <td>{row.descripcion}</td>
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
          {!recargasDetalle.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {recargasDetalle.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts2">
                  <div className="admin-kpi-label">Total recargas</div>
                  <div className="admin-kpi-value">{dataRecargas.totalRecargas}</div>
                </article>
              </div>

              <div className="reporte-chart-grid">
                <ReportChartCard title="Eventos de recarga por maquina" description="Haz clic en una barra para dejar solo esa maquina en las tablas.">
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={recargasBarData}
                      options={buildCartesianOptions({
                        showLegend: false,
                        onClick: (_, elements, chart) => {
                          const label = clickedLabel(elements, chart);
                          if (label) setFiltroMaquinaRecargas(label);
                        },
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard title="Saldo actual por maquina" description="El donut resume como se distribuye el efectivo disponible.">
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut
                        data={recargasPieData}
                        options={buildDoughnutOptions({
                          valueFormatter: formatCurrency,
                          onClick: (_, elements, chart) => {
                            const label = clickedLabel(elements, chart);
                            if (label) setFiltroMaquinaRecargas(label);
                          },
                        })}
                        plugins={[
                          createCenterTextPlugin([
                            {
                              text: formatCurrency(
                                saldoPorMaquina.reduce((sum, row) => sum + Number(row.saldoTotal || 0), 0)
                              ),
                            },
                            { text: 'saldo', color: '#64748b' },
                          ]),
                        ]}
                      />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        recargasPieData.labels,
                        recargasPieData.datasets[0].data,
                        recargasPieData.datasets[0].backgroundColor,
                        formatCurrency
                      )}
                    />
                  </div>
                </ReportChartCard>
              </div>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de recargas</h3>
                  <div className="reporte-table-toolbar__controls">
                    <input
                      type="text"
                      placeholder="Buscar por maquina..."
                      value={filtroMaquinaRecargas}
                      onChange={(e) => setFiltroMaquinaRecargas(e.target.value)}
                      className="admin-input reporte-table-input"
                    />
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Maquina</th>
                        <th>Fecha recarga</th>
                        <th>Descripcion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recargasFiltradas.map((row) => (
                        <tr key={String(row.recargaId)}>
                          <td>{row.maquina}</td>
                          <td>{row.fechaRecarga ? new Date(row.fechaRecarga).toLocaleString('es-GT') : '—'}</td>
                          <td>{row.descripcion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="reporte-inc-table-wrap">
                <h3 className="reporte-inc-subtitle">Saldo actual por maquina (por denominacion)</h3>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Maquina</th>
                        <th>Saldo total</th>
                        <th>Desglose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saldoPorMaquina
                        .filter((row) => !filtroMaquinaRecargas || row.maquina?.toLowerCase().includes(filtroMaquinaRecargas.toLowerCase()))
                        .map((row) => (
                          <tr key={row.maquina}>
                            <td>{row.maquina}</td>
                            <td>{formatCurrency(row.saldoTotal)}</td>
                            <td>
                              {(row.denominaciones || [])
                                .map((item) => `Q${item.valorBillete}: ${item.cantidad} (${formatCurrency(item.subtotal)})`)
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
                  <div className="admin-kpi-label">Tipo mas frecuente</div>
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
                    Promedio resolucion: {dataIncidentes.porResolucion?.tiempoPromedioResolucionEtiqueta || '—'}
                  </div>
                </article>
              </div>

              <div className="reporte-chart-grid">
                <ReportChartCard title="Incidentes por tipo" description="Haz clic en una barra para filtrar la tabla por tipo.">
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={incidentesTipoChartData}
                      options={buildCartesianOptions({
                        showLegend: false,
                        onClick: (_, elements, chart) => {
                          const label = clickedLabel(elements, chart);
                          if (label) setFiltroTipoIncidente(label);
                        },
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard title="Resolucion del incidente" description="Haz clic en un segmento para filtrar por estado.">
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut
                        data={incidentesPieData}
                        options={buildDoughnutOptions({
                          onClick: (_, elements, chart) => {
                            const label = clickedLabel(elements, chart);
                            if (label) setFEstadoResolucion(label.toLowerCase().slice(0, -1));
                          },
                        })}
                        plugins={[
                          createCenterTextPlugin([
                            { text: formatNumber(dataIncidentes.porRango?.resumen?.totalIncidentes || 0) },
                            { text: 'incidentes', color: '#64748b' },
                          ]),
                        ]}
                      />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        incidentesPieData.labels,
                        incidentesPieData.datasets[0].data,
                        incidentesPieData.datasets[0].backgroundColor
                      )}
                    />
                  </div>
                </ReportChartCard>
              </div>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de incidentes</h3>
                  <div className="reporte-table-toolbar__controls">
                    {filtroTipoIncidente ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFiltroTipoIncidente('')}>
                        Tipo: {filtroTipoIncidente} x
                      </button>
                    ) : null}
                    {fEstadoResolucion ? (
                      <button type="button" className="admin-btn-ghost" onClick={() => setFEstadoResolucion('')}>
                        Estado: {fEstadoResolucion} x
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo incidente</th>
                        <th>Descripcion</th>
                        <th>Placa</th>
                        <th>Estado</th>
                        <th>Fecha resolucion</th>
                        <th>Usuario resolvio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentesDetalleFiltrado.map((row) => (
                        <tr key={String(row.id)}>
                          <td>{row.fechaRegistro ? new Date(row.fechaRegistro).toLocaleString('es-GT') : '—'}</td>
                          <td>{row.tipoIncidente}</td>
                          <td>{row.descripcion || '—'}</td>
                          <td>{row.placa}</td>
                          <td>{row.estadoResolucion}</td>
                          <td>{row.fechaResolucion ? new Date(row.fechaResolucion).toLocaleString('es-GT') : '—'}</td>
                          <td>{row.usuarioResolvio || '—'}</td>
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
