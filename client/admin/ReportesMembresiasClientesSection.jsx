import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
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
import { ReportDetailNav } from './ReportCardMenu.jsx';
import {
  REPORT_FLOW_STEPS,
  ReportFlowBar,
  ReportGeneratePanel,
  ReportResultsSection,
  ReportSubreportTabs,
  ReportWorkspace,
  useReportGenerateScroll,
} from './reportNavigation.jsx';

import { useReportFilter } from './ReportFilterContext.jsx';
const MEMBERSHIP_REPORT_CARDS = [
  { id: 'mora', badge: 'MOR', eyebrow: 'Riesgo', label: 'Clientes con mora', summary: 'Clientes atrasados, dias de mora y filtros por tipo de vehiculo o rango.', traits: ['Mora', 'Cliente', 'Tipo'], icon: 'alert', tone: 'sunset' },
  { id: 'estado', badge: 'EST', eyebrow: 'Vigencia', label: 'Estado membresias', summary: 'Distribucion de membresias activas, suspendidas y vencidas por periodo.', traits: ['Estado', 'Fecha', 'Grafica'], icon: 'calendar', tone: 'mint' },
  { id: 'historial', badge: 'HIS', eyebrow: 'Pagos', label: 'Historial pagos', summary: 'Consulta pagos de un cliente por mes, metodo y detalle de membresia.', traits: ['Cliente', 'Mes', 'Metodo'], icon: 'money', tone: 'ocean' },
];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function clickedLabel(elements, chart) {
  if (!elements?.length || !chart?.data?.labels?.length) return '';
  return String(chart.data.labels[elements[0].index] || '');
}

function moraBucket(days) {
  const value = Number(days || 0);
  if (value <= 3) return '1-3 dias';
  if (value <= 7) return '4-7 dias';
  return '8+ dias';
}

export default function ReportesMembresiasClientesSection({ onBackToReports = null }) {
  const { filtros, setFiltro } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [tab, setTab] = useState('mora');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [queryCliente, setQueryCliente] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [cliId, setCliId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [filtroBusquedaMora, setFiltroBusquedaMora] = useState('');
  const [filtroMoraBucket, setFiltroMoraBucket] = useState('');
  const [filtroTipoVehiculoMora, setFiltroTipoVehiculoMora] = useState('Todos');
  const [filtroMesHistorial, setFiltroMesHistorial] = useState('');
  const [filtroMetodoHistorial, setFiltroMetodoHistorial] = useState('');

  useEffect(() => {
    setError('');
    setData(null);
    setEstadoFiltro('');
    setFiltroBusquedaMora('');
    setFiltroMoraBucket('');
    setFiltroMesHistorial('');
    setFiltroMetodoHistorial('');
  }, [tab]);

  const buscarClientes = async () => {
    setError('');
    try {
      const q = new URLSearchParams({ q: queryCliente });
      const res = await fetch(`${API_BASE}/reportes/membresias-clientes/buscar?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setCandidatos(Array.isArray(json) ? json : []);
    } catch (e) {
      setError(e.message || 'No se pudo buscar clientes');
    }
  };

  const generate = async () => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      if (tab === 'mora') {
        const res = await fetch(`${API_BASE}/reportes/clientes-mora`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      } else if (tab === 'estado') {
        const q = new URLSearchParams({ desde, hasta });
        const res = await fetch(`${API_BASE}/reportes/membresias-estado?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      } else {
        const q = new URLSearchParams({ cli_id: cliId });
        const res = await fetch(`${API_BASE}/reportes/membresias-clientes/historial-pagos?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      }
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    if (tab === 'mora') {
      window.open(`${API_BASE}/reportes/clientes-mora/pdf`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (tab === 'estado') {
      const q = new URLSearchParams({ desde, hasta });
      window.open(`${API_BASE}/reportes/membresias-estado/pdf?${q}`, '_blank', 'noopener,noreferrer');
      return;
    }
    const q = new URLSearchParams({ cli_id: cliId });
    window.open(`${API_BASE}/reportes/membresias-clientes/historial-pagos/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const detalleEstadoFiltrado = (() => {
    const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
    if (!estadoFiltro) return detalle;
    return detalle.filter((row) => String(row.estadoActual || '').toLowerCase() === estadoFiltro.toLowerCase());
  })();

  const pieDataEstado = {
    labels: (data?.porEstado || []).map((row) => row.estadoTexto),
    datasets: [
      {
        data: (data?.porEstado || []).map((row) => Number(row.cantidad || 0)),
        backgroundColor: (data?.porEstado || []).map((row) => row.color || REPORT_PALETTE.slate),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const estadosOpciones = [...new Set((data?.detalle || []).map((row) => row.estadoActual).filter(Boolean))];

  const moraDetalle = useMemo(() => (Array.isArray(data?.detalle) ? data.detalle : []), [data]);
  const moraTopData = {
    labels: moraDetalle.slice(0, 8).map((row) => row.placa || row.nombreCompleto),
    datasets: [
      {
        label: 'Dias en mora',
        data: moraDetalle.slice(0, 8).map((row) => Number(row.diasMora || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 32,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#fdba74', REPORT_PALETTE.orange);
        },
      },
    ],
  };

  const moraBuckets = useMemo(() => {
    const counts = new Map([
      ['1-3 dias', 0],
      ['4-7 dias', 0],
      ['8+ dias', 0],
    ]);
    moraDetalle.forEach((row) => {
      const bucket = moraBucket(row.diasMora);
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    });
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [moraDetalle]);

  const moraPieData = {
    labels: moraBuckets.map((row) => row.label),
    datasets: [
      {
        data: moraBuckets.map((row) => row.value),
        backgroundColor: [REPORT_PALETTE.blue, REPORT_PALETTE.amber, REPORT_PALETTE.rose],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const tiposVehiculoMora = useMemo(() => {
    const s = new Set((data?.detalle ?? []).map((r) => r.tipoVehiculo).filter((t) => t && t !== '—'));
    return [...s].sort();
  }, [data]);
  const moraFiltrada = moraDetalle.filter((row) => {
    const s = filtroBusquedaMora.toLowerCase();
    const matchText =
      !s ||
      row.nombreCompleto?.toLowerCase().includes(s) ||
      row.placa?.toLowerCase().includes(s);
    const matchBucket = !filtroMoraBucket || moraBucket(row.diasMora) === filtroMoraBucket;
    const matchTipoV = filtroTipoVehiculoMora === 'Todos' || row.tipoVehiculo === filtroTipoVehiculoMora;
    return matchText && matchBucket && matchTipoV;
  });

  const historial = useMemo(() => (Array.isArray(data?.historial) ? data.historial : []), [data]);
  const historialPorMes = useMemo(() => {
    const byMonth = new Map();
    historial.forEach((row) => {
      const key = row.mesCancelado || String(row.fechaPago || '').slice(0, 7) || 'Sin mes';
      byMonth.set(key, (byMonth.get(key) || 0) + Number(row.montoPagado || 0));
    });
    return [...byMonth.entries()].map(([label, value]) => ({ label, value }));
  }, [historial]);

  const historialPorMetodo = useMemo(() => {
    const byMethod = new Map();
    historial.forEach((row) => {
      const key = row.metodoPago || 'Sin metodo';
      byMethod.set(key, (byMethod.get(key) || 0) + Number(row.montoPagado || 0));
    });
    return [...byMethod.entries()].map(([label, value]) => ({ label, value }));
  }, [historial]);

  const historialLineData = {
    labels: historialPorMes.map((row) => row.label),
    datasets: [
      {
        label: 'Total pagado',
        data: historialPorMes.map((row) => row.value),
        borderColor: REPORT_PALETTE.blue,
        backgroundColor(context) {
          const { chart } = context;
          return createVerticalGradient(chart, 'rgba(37, 99, 235, 0.28)', 'rgba(37, 99, 235, 0.02)');
        },
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: REPORT_PALETTE.blue,
        pointBorderWidth: 2,
      },
    ],
  };

  const historialMetodoData = {
    labels: historialPorMetodo.map((row) => row.label),
    datasets: [
      {
        data: historialPorMetodo.map((row) => row.value),
        backgroundColor: historialPorMetodo.map((_, index) => [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber, REPORT_PALETTE.violet][index % 4]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const historialFiltrado = historial.filter((row) => {
    const matchMes = !filtroMesHistorial || (row.mesCancelado || '').includes(filtroMesHistorial);
    const matchMetodo = !filtroMetodoHistorial || row.metodoPago === filtroMetodoHistorial;
    return matchMes && matchMetodo;
  });
  const generateRef = useReportGenerateScroll(tab);
  const activeCard = MEMBERSHIP_REPORT_CARDS.find((item) => item.id === tab);
  const reportTitle =
    tab === 'mora'
      ? 'Reporte de clientes con mora'
      : tab === 'estado'
        ? 'Reporte de membresias activas, suspendidas y vencidas'
        : 'Reporte de historial de pagos por cliente';

  return (
    <ReportWorkspace>
      <ReportDetailNav
        eyebrow="Reportes"
        title="Membresias y clientes"
        backLabel="Volver a reportes"
        onBack={onBackToReports}
      />
      <ReportFlowBar steps={REPORT_FLOW_STEPS} activeStep={data ? 4 : 3} />
      <ReportSubreportTabs
        ariaLabel="Subreportes membresias y clientes"
        items={MEMBERSHIP_REPORT_CARDS}
        activeId={tab}
        onSelect={setTab}
      />

      <ReportGeneratePanel panelRef={generateRef} title={reportTitle} tone={activeCard?.tone}>
        <form
          className="reporte-inc-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          {tab === 'estado' ? (
            <>
            </>
          ) : null}
          {tab === 'historial' ? (
            <>
              <label className="reporte-inc-field" style={{ minWidth: 260 }}>
                <span>Buscar cliente (nombre o placa)</span>
                <input type="text" value={queryCliente} onChange={(e) => setQueryCliente(e.target.value)} placeholder="Ej. Juan o P123ABC" />
              </label>
              <div className="reporte-inc-form__actions">
                <button type="button" className="admin-btn-ghost" onClick={buscarClientes} disabled={!queryCliente || queryCliente.trim().length < 2}>
                  Filtrar
                </button>
              </div>
              <label className="reporte-inc-field" style={{ minWidth: 260 }}>
                <span>Cliente</span>
                <select value={cliId} onChange={(e) => setCliId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {candidatos.map((row) => (
                    <option key={String(row.cliId)} value={String(row.cliId)}>
                      {row.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading || (tab === 'historial' && !cliId)}>
              {loading ? 'Generando...' : 'Generar reporte'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading || (tab === 'historial' && !cliId)}>
              Exportar PDF
            </button>
          </div>
        </form>
      </ReportGeneratePanel>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      <ReportResultsSection visible={data != null} render={() => (
        <>
          {tab === 'mora' ? (
            <>
              {!moraDetalle.length ? <p className="reporte-inc-empty">No hay registros disponibles.</p> : null}
              {moraDetalle.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Clientes en mora</div><div className="admin-kpi-value">{data.totalClientesDistintos}</div></article>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Monto pendiente</div><div className="admin-kpi-value">{formatCurrency(data.montoTotalReferencia)}</div></article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard title="Top de cuentas con mayor mora" description="Haz clic en una barra para filtrar por placa.">
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={moraTopData}
                          options={buildCartesianOptions({
                            showLegend: false,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroBusquedaMora(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard title="Severidad de la mora" description="Haz clic en un segmento para filtrar por rango de dias.">
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={moraPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroMoraBucket(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(data.totalClientesDistintos || 0) },
                                { text: 'clientes', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            moraPieData.labels,
                            moraPieData.datasets[0].data,
                            moraPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de mora</h3>
                      <div className="reporte-table-toolbar__controls">
                        {filtroMoraBucket ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMoraBucket('')}>
                            Rango: {filtroMoraBucket} x
                          </button>
                        ) : null}
                        <input
                          type="text"
                          placeholder="Buscar cliente o placa..."
                          value={filtroBusquedaMora}
                          onChange={(e) => setFiltroBusquedaMora(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select value={filtroTipoVehiculoMora} onChange={(e) => setFiltroTipoVehiculoMora(e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los tipos</option>
                          {tiposVehiculoMora.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Correo</th><th>Telefono</th><th>Placa</th><th>Tipo vehículo</th><th>Vencimiento</th><th>Dias mora</th></tr></thead>
                        <tbody>
                          {moraFiltrada.map((row) => (
                            <tr key={String(row.memId)}>
                              <td>{row.nombreCompleto}</td>
                              <td>{row.correo}</td>
                              <td>{row.telefono}</td>
                              <td>{row.placa}</td>
                              <td>{row.tipoVehiculo ?? '—'}</td>
                              <td>{row.fechaVencimiento || '—'}</td>
                              <td>{row.diasMora}</td>
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

          {tab === 'estado' ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Activas</div><div className="admin-kpi-value">{data.resumen?.activas ?? 0}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Suspendidas</div><div className="admin-kpi-value">{data.resumen?.suspendidas ?? 0}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Vencidas</div><div className="admin-kpi-value">{data.resumen?.vencidas ?? 0}</div></article>
                  </div>

                  <div className="reporte-chart-grid reporte-chart-grid--single">
                    <ReportChartCard title="Distribucion por estado" description="Haz clic en un segmento para filtrar la tabla.">
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={pieDataEstado}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setEstadoFiltro(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(data.totalRegistros || data.detalle.length) },
                                { text: 'membresias', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            pieDataEstado.labels,
                            pieDataEstado.datasets[0].data,
                            pieDataEstado.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <section className="reporte-inc-card" style={{ marginTop: '0.5rem' }}>
                    <form className="reporte-inc-form" onSubmit={(e) => e.preventDefault()}>
                      <label className="reporte-inc-field"><span>Filtrar por estado</span>
                        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                          <option value="">Todos</option>
                          {estadosOpciones.map((state) => <option key={state} value={state}>{state}</option>)}
                        </select>
                      </label>
                    </form>
                  </section>

                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Detalle de membresias</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Placa</th><th>Espacio</th><th>Inicio</th><th>Vencimiento</th><th>Estado</th></tr></thead>
                        <tbody>
                          {detalleEstadoFiltrado.map((row) => (
                            <tr key={String(row.memId)}><td>{row.clienteNombre}</td><td>{row.placa}</td><td>{row.espacioAsignado}</td><td>{row.fechaInicio || '—'}</td><td>{row.fechaVencimiento || '—'}</td><td>{row.estadoActual}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'historial' ? (
            <>
              {!historial.length ? <p className="reporte-inc-empty">Este cliente no tiene historial de pagos.</p> : null}
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Cliente</div><div className="admin-kpi-value" style={{ fontSize: '1rem' }}>{data.cliente?.nombreCompleto || '—'}</div><div className="admin-kpi-hint">DPI: {data.cliente?.dpi || '—'}</div></article>
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">
                    {(Number(data.totalMembresiasActivas || 0) > 1) ? 'Membresias activas' : 'Membresia actual'}
                  </div>
                  <div className="admin-kpi-value" style={{ fontSize: '1rem' }}>
                    {(Number(data.totalMembresiasActivas || 0) > 1)
                      ? Number(data.totalMembresiasActivas || 0)
                      : (data.membresiaActual?.estado || '—')}
                  </div>
                  {(Number(data.totalMembresiasActivas || 0) > 1) ? null : (
                    <div className="admin-kpi-hint">Vence: {data.membresiaActual?.fechaVencimiento || '—'}</div>
                  )}
                </article>
                <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Total historico</div><div className="admin-kpi-value">{formatCurrency(data.totalHistoricoPagado)}</div></article>
              </div>

              {historial.length ? (
                <>
                  <div className="reporte-chart-grid">
                    <ReportChartCard title="Linea historica de pagos" description="Haz clic en un punto para filtrar la tabla por mes cancelado.">
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Line
                          data={historialLineData}
                          options={buildCartesianOptions({
                            showLegend: false,
                            numericFormatter: formatCurrency,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroMesHistorial(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard title="Monto por metodo de pago" description="Haz clic en un segmento para filtrar el detalle por metodo.">
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={historialMetodoData}
                            options={buildDoughnutOptions({
                              valueFormatter: formatCurrency,
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroMetodoHistorial(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatCurrency(data.totalHistoricoPagado) },
                                { text: 'historico', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            historialMetodoData.labels,
                            historialMetodoData.datasets[0].data,
                            historialMetodoData.datasets[0].backgroundColor,
                            formatCurrency
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>
                </>
              ) : null}

              {(Number(data.totalMembresiasActivas || 0) > 1) ? (
                <div className="reporte-inc-table-wrap">
                  <h3 className="reporte-inc-subtitle">Detalle de membresias activas</h3>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>ID membresia</th><th>Placa</th><th>Fecha inicio</th><th>Fecha vencimiento</th><th>Estado</th></tr></thead>
                      <tbody>
                        {(data.membresiasActivas || []).map((row) => (
                          <tr key={String(row.memId)}>
                            <td>{row.memId}</td>
                            <td>{row.placa || '—'}</td>
                            <td>{row.fechaInicio || '—'}</td>
                            <td>{row.fechaVencimiento || '—'}</td>
                            <td>{row.estado || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {historial.length ? (
                <div className="reporte-inc-table-wrap">
                  <div className="reporte-table-toolbar">
                    <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Historial de pagos</h3>
                    <div className="reporte-table-toolbar__controls">
                      {filtroMesHistorial ? (
                        <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMesHistorial('')}>
                          Mes: {filtroMesHistorial} x
                        </button>
                      ) : null}
                      {filtroMetodoHistorial ? (
                        <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMetodoHistorial('')}>
                          Metodo: {filtroMetodoHistorial} x
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>Fecha pago</th><th>Placa</th><th>Monto</th><th>Metodo pago</th><th>Mes cancelado</th></tr></thead>
                      <tbody>
                        {historialFiltrado.map((row) => (
                          <tr key={String(row.id)}><td>{row.fechaPago ? new Date(row.fechaPago).toLocaleString('es-GT') : '—'}</td><td>{row.placa || '—'}</td><td>{formatCurrency(row.montoPagado)}</td><td>{row.metodoPago}</td><td>{row.mesCancelado}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )} />
    </ReportWorkspace>
  );
}

