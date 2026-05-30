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
import { ReportCardMenu, ReportDetailNav } from './ReportCardMenu.jsx';

import { useReportFilter } from './ReportFilterContext.jsx';
const FINANCIAL_REPORT_CARDS = [
  { id: 'cobros_maquina', badge: 'COB', eyebrow: 'Maquinas', label: 'Cobros por maquina', summary: 'Monto cobrado, vuelto y transacciones procesadas por cada maquina de cobro.', traits: ['Maquina', 'Monto', 'Metodo'], icon: 'machine', tone: 'mint' },
  { id: 'pagos_membresia', badge: 'MEM', eyebrow: 'Mensualidades', label: 'Pagos membresias', summary: 'Pagos de membresia agrupados por mes, metodo y tipo de vehiculo.', traits: ['Mes', 'Metodo', 'Placa'], icon: 'money', tone: 'sunset' },
  { id: 'ingresos_tipo', badge: 'TIP', eyebrow: 'Cliente', label: 'Ingresos por tipo', summary: 'Comparativo de ingresos entre clientes esporadicos y membresias.', traits: ['Tipo', 'Ingreso', 'Mix'], icon: 'users', tone: 'ocean' },
  { id: 'ingresos_totales', badge: 'TOT', eyebrow: 'Resumen', label: 'Ingresos totales', summary: 'Vista consolidada de ingresos por rango de fechas y referencia.', traits: ['Rango', 'Referencia', 'PDF'], icon: 'chart', tone: 'steel' },
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

export default function ReportesFinancierosSection({ onBackToReports = null }) {
  const { filtros, setFiltro } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [tab, setTab] = useState('cobros_maquina');
  const [mesInicio, setMesInicio] = useState(filtros.desde.slice(0, 7));
  const [mesFin, setMesFin] = useState(filtros.hasta.slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroReferencia, setFiltroReferencia] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroTipoVehiculoPagos, setFiltroTipoVehiculoPagos] = useState('Todos');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMaquina, setFiltroMaquina] = useState('');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('');

  useEffect(() => {
    setError('');
    setData(null);
    setFiltroFecha('');
    setFiltroReferencia('');
    setFiltroMes('');
    setFiltroPlaca('');
    setFiltroMaquina('');
    setFiltroMetodoPago('');
  }, [tab]);

  const generate = async () => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      const q = new URLSearchParams(
        tab === 'pagos_membresia'
          ? { mes_inicio: mesInicio, mes_fin: mesFin }
          : { desde, hasta }
      );
      const pathByTab = {
        cobros_maquina: '/reportes/financieros/cobros-maquina',
        pagos_membresia: '/reportes/financieros/pagos-membresia-mes',
        ingresos_tipo: '/reportes/financieros/ingresos-tipo-cliente',
        ingresos_totales: '/reportes/financieros/ingresos-totales',
      };
      const res = await fetch(`${API_BASE}${pathByTab[tab]}?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setData(json);
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    const q = new URLSearchParams(
      tab === 'pagos_membresia'
        ? { mes_inicio: mesInicio, mes_fin: mesFin }
        : { desde, hasta }
    );
    const pathByTab = {
      cobros_maquina: '/reportes/financieros/cobros-maquina/pdf',
      pagos_membresia: '/reportes/financieros/pagos-membresia-mes/pdf',
      ingresos_tipo: '/reportes/financieros/ingresos-tipo-cliente/pdf',
      ingresos_totales: '/reportes/financieros/ingresos-totales/pdf',
    };
    window.open(`${API_BASE}${pathByTab[tab]}?${q}`, '_blank', 'noopener,noreferrer');
  };

  const cobrosDetalle = useMemo(() => (Array.isArray(data?.detalle) ? data.detalle : []), [data]);
  const cobrosBarData = {
    labels: cobrosDetalle.map((row) => row.maquina),
    datasets: [
      {
        label: 'Cobrado',
        data: cobrosDetalle.map((row) => Number(row.montoTotalCobrado || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#93c5fd', REPORT_PALETTE.blue);
        },
      },
      {
        label: 'Vuelto',
        data: cobrosDetalle.map((row) => Number(row.montoTotalVuelto || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#fde68a', REPORT_PALETTE.amber);
        },
      },
    ],
  };

  const totalAutomaticas = cobrosDetalle.reduce((sum, row) => sum + Number(row.transaccionesAutomaticas || 0), 0);
  const totalManuales = cobrosDetalle.reduce(
    (sum, row) => sum + Math.max(0, Number(row.totalTransacciones || 0) - Number(row.transaccionesAutomaticas || 0)),
    0
  );
  const cobrosMixData = {
    labels: ['Automaticas', 'Asistidas'],
    datasets: [
      {
        data: [totalAutomaticas, totalManuales],
        backgroundColor: [REPORT_PALETTE.teal, REPORT_PALETTE.violet],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const pagosPorMes = useMemo(() => (Array.isArray(data?.porMes) ? data.porMes : []), [data]);
  const pagosDetalle = useMemo(() => (Array.isArray(data?.detalle) ? data.detalle : []), [data]);
  const lineData = {
    labels: pagosPorMes.map((row) => row.anioMes),
    datasets: [
      {
        label: 'Monto recaudado',
        data: pagosPorMes.map((row) => Number(row.montoTotalRecaudado || 0)),
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

  const pagosPorMetodo = useMemo(() => {
    const byMethod = new Map();
    pagosDetalle.forEach((row) => {
      const key = row.metodoPago || 'Sin metodo';
      byMethod.set(key, (byMethod.get(key) || 0) + Number(row.monto || 0));
    });
    return [...byMethod.entries()].map(([label, value]) => ({ label, value }));
  }, [pagosDetalle]);

  const pagosMetodoColors = [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber, REPORT_PALETTE.violet];
  const pagosMetodoData = {
    labels: pagosPorMetodo.map((row) => row.label),
    datasets: [
      {
        data: pagosPorMetodo.map((row) => row.value),
        backgroundColor: pagosPorMetodo.map((_, index) => pagosMetodoColors[index % pagosMetodoColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const pieTipoData = {
    labels: ['Esporadico', 'Membresia'],
    datasets: [
      {
        data: [Number(data?.esporadico?.totalRecaudado || 0), Number(data?.mensual?.totalRecaudado || 0)],
        backgroundColor: [REPORT_PALETTE.blue, REPORT_PALETTE.green],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const barTotalesData = {
    labels: (data?.ingresosPorDia || []).map((row) => row.fecha),
    datasets: [
      {
        label: 'Esporadico',
        data: (data?.ingresosPorDia || []).map((row) => Number(row.ingresoEsporadico || 0)),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#7dd3fc', REPORT_PALETTE.blue);
        },
      },
      {
        label: 'Membresia',
        data: (data?.ingresosPorDia || []).map((row) => Number(row.ingresoMensual || 0)),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#86efac', REPORT_PALETTE.green);
        },
      },
    ],
  };

  const tiposVehiculoPagos = useMemo(() => {
    const s = new Set(pagosDetalle.map((r) => r.tipoVehiculo).filter((t) => t && t !== '—'));
    return [...s].sort();
  }, [pagosDetalle]);
  const pagosDetalleFiltrado = pagosDetalle.filter((row) => {
    const matchPlaca = row.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
    const matchMes = filtroMes ? String(row.fechaPago || '').startsWith(filtroMes) : true;
    const matchMetodo = filtroMetodoPago ? row.metodoPago === filtroMetodoPago : true;
    const matchTipoV = filtroTipoVehiculoPagos === 'Todos' || row.tipoVehiculo === filtroTipoVehiculoPagos;
    return matchPlaca && matchMes && matchMetodo && matchTipoV;
  });

  const cobrosDetalleFiltrado = cobrosDetalle.filter((row) =>
    row.maquina?.toLowerCase().includes(filtroMaquina.toLowerCase())
  );

  const ingresosDetalleFiltrado = (data?.detalleTransacciones || []).filter((row) => {
    const matchRef = row.referencia?.toLowerCase().includes(filtroReferencia.toLowerCase());
    const matchFecha = filtroFecha ? String(row.fecha || '').startsWith(filtroFecha) : true;
    return matchRef && matchFecha;
  });

  return (
    <>
      <ReportDetailNav
        eyebrow="Reportes"
        title="Reportes financieros"
        backLabel="Volver a reportes"
        onBack={onBackToReports}
      />
      <ReportCardMenu
        ariaLabel="Subreportes financieros"
        items={FINANCIAL_REPORT_CARDS}
        onSelect={setTab}
      />

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">
          {tab === 'cobros_maquina'
            ? 'Reporte de cobros procesados por maquina'
            : tab === 'pagos_membresia'
              ? 'Reporte de pagos de membresias por mes'
              : tab === 'ingresos_tipo'
                ? 'Reporte de ingresos por tipo de cliente'
                : 'Reporte de ingresos totales por rango de fechas'}
        </h2>
        <form
          className="reporte-inc-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          {tab === 'pagos_membresia' ? (
            <>
              <label className="reporte-inc-field">
                <span>Mes inicio</span>
                <input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} required />
              </label>
              <label className="reporte-inc-field">
                <span>Mes fin</span>
                <input type="month" value={mesFin} onChange={(e) => setMesFin(e.target.value)} required />
              </label>
            </>
          ) : null}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>
              {loading ? 'Generando...' : 'Generar reporte'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading}>
              Exportar PDF
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {data == null ? null : (
        <>
          {tab === 'cobros_maquina' ? (
            <>
              {!cobrosDetalle.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {cobrosDetalle.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Transacciones</div><div className="admin-kpi-value">{data.totalTransacciones}</div></article>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Cobrado</div><div className="admin-kpi-value">{formatCurrency(data.totalCobrado)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Vuelto</div><div className="admin-kpi-value">{formatCurrency(data.totalVuelto)}</div></article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Cobrado y vuelto por maquina"
                      description="Haz clic en una barra para resaltar esa maquina en la tabla."
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={cobrosBarData}
                          options={buildCartesianOptions({
                            numericFormatter: formatCurrency,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroMaquina(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Participacion operativa"
                      description="Visualiza cuanto del flujo se procesa de forma automatica."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={cobrosMixData}
                            options={buildDoughnutOptions()}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(data.totalTransacciones || 0) },
                                { text: 'transacciones', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            cobrosMixData.labels,
                            cobrosMixData.datasets[0].data,
                            cobrosMixData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle por maquina</h3>
                      <div className="reporte-table-toolbar__controls">
                        <input
                          type="text"
                          placeholder="Buscar maquina..."
                          value={filtroMaquina}
                          onChange={(e) => setFiltroMaquina(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Maquina</th><th>Transacciones</th><th>Monto cobrado</th><th>Vuelto</th><th>Promedio</th><th>Automaticas</th></tr></thead>
                        <tbody>
                          {cobrosDetalleFiltrado.map((row) => (
                            <tr key={String(row.maquinaId)}>
                              <td>{row.maquina}</td>
                              <td>{row.totalTransacciones}</td>
                              <td>{formatCurrency(row.montoTotalCobrado)}</td>
                              <td>{formatCurrency(row.montoTotalVuelto)}</td>
                              <td>{formatCurrency(row.promedioCobro)}</td>
                              <td>{row.transaccionesAutomaticas}</td>
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

          {tab === 'pagos_membresia' ? (
            <>
              {!pagosPorMes.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {pagosPorMes.length ? (
                <>
                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Tendencia mensual de recaudacion"
                      description="Haz clic en un punto para filtrar el detalle por mes."
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Line
                          data={lineData}
                          options={buildCartesianOptions({
                            showLegend: false,
                            numericFormatter: formatCurrency,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroMes(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Distribucion del monto por metodo de pago"
                      description="Haz clic en un segmento para dejar solo ese metodo en la tabla."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={pagosMetodoData}
                            options={buildDoughnutOptions({
                              valueFormatter: formatCurrency,
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroMetodoPago(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatCurrency(data.totalRecaudado || pagosDetalle.reduce((sum, row) => sum + Number(row.monto || 0), 0)) },
                                { text: 'recaudado', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            pagosMetodoData.labels,
                            pagosMetodoData.datasets[0].data,
                            pagosMetodoData.datasets[0].backgroundColor,
                            formatCurrency
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Resumen mensual</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Mes</th><th>Membresias pagadas</th><th>Monto recaudado</th><th>Promedio pago</th></tr></thead>
                        <tbody>
                          {pagosPorMes.map((row) => (
                            <tr key={row.anioMes}>
                              <td>{row.anioMes}</td>
                              <td>{row.membresiasPagadas}</td>
                              <td>{formatCurrency(row.montoTotalRecaudado)}</td>
                              <td>{formatCurrency(row.promedioPagoMembresia)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de pagos</h3>
                      <div className="reporte-table-toolbar__controls">
                        {filtroMes ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMes('')}>
                            Mes: {filtroMes} x
                          </button>
                        ) : null}
                        {filtroMetodoPago ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroMetodoPago('')}>
                            Metodo: {filtroMetodoPago} x
                          </button>
                        ) : null}
                        <input
                          type="text"
                          placeholder="Buscar por placa..."
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select value={filtroTipoVehiculoPagos} onChange={(e) => setFiltroTipoVehiculoPagos(e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los tipos</option>
                          {tiposVehiculoPagos.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Placa</th><th>Tipo vehículo</th><th>Fecha pago</th><th>Monto</th><th>Metodo pago</th></tr></thead>
                        <tbody>
                          {pagosDetalleFiltrado.map((row) => (
                            <tr key={String(row.id)}>
                              <td>{row.cliente}</td>
                              <td>{row.placa}</td>
                              <td>{row.tipoVehiculo ?? '—'}</td>
                              <td>{row.fechaPago ? new Date(row.fechaPago).toLocaleString('es-GT') : '—'}</td>
                              <td>{formatCurrency(row.monto)}</td>
                              <td>{row.metodoPago}</td>
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

          {tab === 'ingresos_tipo' ? (
            <>
              {Number(data.totalGeneral || 0) <= 0 ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {Number(data.totalGeneral || 0) > 0 ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Total general</div><div className="admin-kpi-value">{formatCurrency(data.totalGeneral)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Esporadicos</div><div className="admin-kpi-value">{formatCurrency(data.esporadico?.totalRecaudado)}</div><div className="admin-kpi-hint">{data.esporadico?.porcentajeSobreTotal || 0}%</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Membresia</div><div className="admin-kpi-value">{formatCurrency(data.mensual?.totalRecaudado)}</div><div className="admin-kpi-hint">{data.mensual?.porcentajeSobreTotal || 0}%</div></article>
                  </div>

                  <div className="reporte-chart-grid reporte-chart-grid--single">
                    <ReportChartCard
                      title="Participacion del ingreso por tipo de cliente"
                      description="Interaccion por hover, centro informativo y leyenda ejecutiva."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={pieTipoData}
                            options={buildDoughnutOptions({ valueFormatter: formatCurrency })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatCurrency(data.totalGeneral) },
                                { text: 'total', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            pieTipoData.labels,
                            pieTipoData.datasets[0].data,
                            pieTipoData.datasets[0].backgroundColor,
                            formatCurrency
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'ingresos_totales' ? (
            <>
              {!data.detalleTransacciones?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalleTransacciones?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Ingreso total</div><div className="admin-kpi-value">{formatCurrency(data.ingresoTotal)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Esporadicos</div><div className="admin-kpi-value">{formatCurrency(data.ingresoEsporadico)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Membresia</div><div className="admin-kpi-value">{formatCurrency(data.ingresoMensual)}</div></article>
                  </div>

                  <div className="reporte-chart-grid reporte-chart-grid--single">
                    <ReportChartCard
                      title="Ingresos diarios por tipo de cliente"
                      description="Haz clic en una barra para filtrar el detalle de ese dia."
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={barTotalesData}
                          options={buildCartesianOptions({
                            numericFormatter: formatCurrency,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroFecha(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de transacciones</h3>
                      <div className="reporte-table-toolbar__controls">
                        {filtroFecha ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroFecha('')}>
                            Fecha: {filtroFecha} x
                          </button>
                        ) : null}
                        <input
                          type="text"
                          placeholder="Buscar por referencia..."
                          value={filtroReferencia}
                          onChange={(e) => setFiltroReferencia(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Fecha</th><th>Tipo cliente</th><th>Monto</th><th>Metodo pago</th><th>Referencia</th></tr></thead>
                        <tbody>
                          {ingresosDetalleFiltrado.map((row) => (
                            <tr key={`${row.referencia}-${row.fecha}`}>
                              <td>{row.fecha ? new Date(row.fecha).toLocaleString('es-GT') : '—'}</td>
                              <td>{row.tipoCliente}</td>
                              <td>{formatCurrency(row.monto)}</td>
                              <td>{row.metodoPago || '—'}</td>
                              <td>{row.referencia}</td>
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
      )}
    </>
  );
}

