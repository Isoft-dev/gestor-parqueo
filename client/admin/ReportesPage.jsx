import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import ReportesOperativosMaquinasSection from './ReportesOperativosMaquinasSection.jsx';
import ReportesFinancierosSection from './ReportesFinancierosSection.jsx';
import ReportesMembresiasClientesSection from './ReportesMembresiasClientesSection.jsx';
import ReportesAfluenciaSection from './ReportesAfluenciaSection.jsx';
import HelpHint from '../components/HelpHint.jsx';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  buildDoughnutOptions,
  buildLegendItems,
  createCenterTextPlugin,
  createHorizontalGradient,
  createVerticalGradient,
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

function clickedLabel(elements, chart) {
  if (!elements?.length || !chart?.data?.labels?.length) return '';
  return String(chart.data.labels[elements[0].index] || '');
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
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

  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('Todos');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroFechaFlujo, setFiltroFechaFlujo] = useState('');

  const data = dataByTab[tabMov];

  useEffect(() => {
    setError('');
    setDataByTab({
      frecuencia: null,
      entradas_salidas: null,
      tiempo_estadia: null,
    });
    setFiltroPlaca('');
    setFiltroTipoCliente('Todos');
    setFiltroDia('');
    setFiltroFechaFlujo('');
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

  const topFrecuencia = useMemo(() => (Array.isArray(data?.top10) ? data.top10 : []), [data]);
  const detalleFrecuencia = useMemo(() => (Array.isArray(data?.detalle) ? data.detalle : []), [data]);
  const distribucionFrecuencia = useMemo(() => {
    const byTipo = new Map();
    detalleFrecuencia.forEach((row) => {
      const key = row.tipoCliente || 'Sin clasificar';
      byTipo.set(key, (byTipo.get(key) || 0) + 1);
    });
    return [...byTipo.entries()].map(([label, value]) => ({ label, value }));
  }, [detalleFrecuencia]);

  const filasFrecuencia = topFrecuencia.filter((row) => {
    const matchPlaca = row.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
    const matchTipo = filtroTipoCliente === 'Todos' || row.tipoCliente === filtroTipoCliente;
    return matchPlaca && matchTipo;
  });

  const frecuenciaBarData = {
    labels: topFrecuencia.map((row) => row.placa),
    datasets: [
      {
        label: 'Visitas',
        data: topFrecuencia.map((row) => Number(row.visitas || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 24,
        backgroundColor(context) {
          return createHorizontalGradient(
            context.chart,
            '#93c5fd',
            REPORT_PALETTE.blue
          );
        },
      },
    ],
  };

  const frecuenciaPieColors = [REPORT_PALETTE.blue, REPORT_PALETTE.teal, REPORT_PALETTE.amber, REPORT_PALETTE.violet];
  const frecuenciaPieData = {
    labels: distribucionFrecuencia.map((item) => item.label),
    datasets: [
      {
        data: distribucionFrecuencia.map((item) => item.value),
        backgroundColor: distribucionFrecuencia.map((_, index) => frecuenciaPieColors[index % frecuenciaPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const frecuenciaPiePlugins = [
    createCenterTextPlugin([
      { text: formatNumber(detalleFrecuencia.length), color: '#0f172a' },
      { text: 'vehiculos', color: '#64748b' },
    ]),
  ];

  const flujoPorDia = useMemo(() => {
    const rows = Array.isArray(data?.detalle) ? data.detalle : [];
    const byDay = new Map();
    rows.forEach((row) => {
      const entrada = dateOnly(row.horaEntrada);
      const salida = dateOnly(row.horaSalida);
      if (entrada) {
        const current = byDay.get(entrada) || { label: entrada, entradas: 0, salidas: 0 };
        current.entradas += 1;
        byDay.set(entrada, current);
      }
      if (salida) {
        const current = byDay.get(salida) || { label: salida, entradas: 0, salidas: 0 };
        current.salidas += 1;
        byDay.set(salida, current);
      }
    });
    return [...byDay.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const flujoTipoCliente = useMemo(() => {
    const rows = Array.isArray(data?.detalle) ? data.detalle : [];
    const byTipo = new Map();
    rows.forEach((row) => {
      const key = row.tipoCliente || 'Sin clasificar';
      byTipo.set(key, (byTipo.get(key) || 0) + 1);
    });
    return [...byTipo.entries()].map(([label, value]) => ({ label, value }));
  }, [data]);

  const flujoBarData = {
    labels: flujoPorDia.map((row) => row.label),
    datasets: [
      {
        label: 'Entradas',
        data: flujoPorDia.map((row) => row.entradas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#7dd3fc', REPORT_PALETTE.blue);
        },
      },
      {
        label: 'Salidas',
        data: flujoPorDia.map((row) => row.salidas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#86efac', REPORT_PALETTE.green);
        },
      },
    ],
  };

  const flujoPieColors = [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber];
  const flujoPieData = {
    labels: flujoTipoCliente.map((item) => item.label),
    datasets: [
      {
        data: flujoTipoCliente.map((item) => item.value),
        backgroundColor: flujoTipoCliente.map((_, index) => flujoPieColors[index % flujoPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const filasFlujo = (Array.isArray(data?.detalle) ? data.detalle : []).filter((row) => {
    const matchPlaca = row.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
    const matchTipo = filtroTipoCliente === 'Todos' || row.tipoCliente === filtroTipoCliente;
    const matchFecha =
      !filtroFechaFlujo ||
      dateOnly(row.horaEntrada) === filtroFechaFlujo ||
      dateOnly(row.horaSalida) === filtroFechaFlujo;
    return matchPlaca && matchTipo && matchFecha;
  });

  const tiempoRows = Array.isArray(data?.promedioPorDiaSemana) ? data.promedioPorDiaSemana : [];
  const tiempoTotales = tiempoRows.reduce((sum, row) => sum + Number(row.cantidadRegistros || 0), 0);
  const tiempoPieColors = [
    REPORT_PALETTE.blue,
    REPORT_PALETTE.cyan,
    REPORT_PALETTE.teal,
    REPORT_PALETTE.green,
    REPORT_PALETTE.amber,
    REPORT_PALETTE.orange,
    REPORT_PALETTE.violet,
  ];

  const tiempoPieData = {
    labels: tiempoRows.map((row) => row.diaSemana),
    datasets: [
      {
        data: tiempoRows.map((row) => Number(row.cantidadRegistros || 0)),
        backgroundColor: tiempoRows.map((_, index) => tiempoPieColors[index % tiempoPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const tiempoBarData = {
    labels: tiempoRows.map((row) => row.diaSemana),
    datasets: [
      {
        label: 'Promedio (min)',
        data: tiempoRows.map((row) => Number(row.promedioMinutos || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#c4b5fd', REPORT_PALETTE.violet);
        },
      },
    ],
  };

  const filasTiempo = tiempoRows.filter((row) => !filtroDia || row.diaSemana === filtroDia);
  const diaMasCargado = tiempoRows.reduce(
    (best, row) => (Number(row.cantidadRegistros || 0) > Number(best?.cantidadRegistros || 0) ? row : best),
    null
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-header__title-main">
          <h1 className="admin-page-title">Reportes</h1>
          <HelpHint label="Mostrar ayuda de reportes" title="Guia de reportes">
            <p>
              Este modulo concentra paneles visuales, filtros cruzados y graficas interactivas para
              cada seccion activa.
            </p>
            <p>Usa las pestanas superiores para cambiar entre movimiento, operacion, finanzas y afluencia.</p>
          </HelpHint>
        </div>
      </header>

      <div className="reporte-tabs" role="tablist" aria-label="Secciones de reportes">
        <button type="button" role="tab" aria-selected={seccion === 'movimiento'} className={`reporte-tab-btn${seccion === 'movimiento' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('movimiento')}>
          1) Movimiento vehicular
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'operativos'} className={`reporte-tab-btn${seccion === 'operativos' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('operativos')}>
          2) Reportes operativos de maquinas
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'financieros'} className={`reporte-tab-btn${seccion === 'financieros' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('financieros')}>
          3) Reportes financieros
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'membresias_clientes'} className={`reporte-tab-btn${seccion === 'membresias_clientes' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('membresias_clientes')}>
          4) Membresias y clientes
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'afluencia'} className={`reporte-tab-btn${seccion === 'afluencia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('afluencia')}>
          5) Reporte de afluencia
        </button>
      </div>

      {seccion === 'movimiento' ? (
        <>
          <div className="reporte-tabs" role="tablist" aria-label="Reportes de movimiento vehicular">
            <button type="button" role="tab" aria-selected={tabMov === 'frecuencia'} className={`reporte-tab-btn${tabMov === 'frecuencia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('frecuencia')}>
              Vehiculos frecuentes
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'entradas_salidas'} className={`reporte-tab-btn${tabMov === 'entradas_salidas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('entradas_salidas')}>
              Entradas y salidas
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'tiempo_estadia'} className={`reporte-tab-btn${tabMov === 'tiempo_estadia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('tiempo_estadia')}>
              Tiempo promedio de estadia
            </button>
          </div>

          <section className="reporte-inc-card">
            <h2 className="reporte-inc-card__title">
              {tabMov === 'frecuencia'
                ? 'Reporte de vehiculos con mayor frecuencia de visitas'
                : tabMov === 'entradas_salidas'
                  ? 'Reporte de entradas y salidas por rango de fechas'
                  : 'Reporte de tiempo promedio de estadia'}
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
                  {loading ? 'Generando...' : 'Generar reporte'}
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
              {!detalleFrecuencia.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {detalleFrecuencia.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Vehiculos en el rango</div>
                      <div className="admin-kpi-value">{data.totalVehiculos}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Top destacados</div>
                      <div className="admin-kpi-value">{Math.min(10, topFrecuencia.length)}</div>
                    </article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Ranking visual del top 10"
                      description="Haz clic en una barra para filtrar la tabla por placa."
                      insights={[
                        {
                          label: 'Placa lider',
                          value: topFrecuencia[0]?.placa || '—',
                        },
                        {
                          label: 'Max. visitas',
                          value: formatNumber(topFrecuencia[0]?.visitas || 0),
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={frecuenciaBarData}
                          options={buildCartesianOptions({
                            indexAxis: 'y',
                            showLegend: false,
                            maxTicksLimit: 10,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroPlaca(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Composicion por tipo de cliente"
                      description="Cada segmento resume cuantos vehiculos entraron en el ranking general."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={frecuenciaPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroTipoCliente(label);
                              },
                            })}
                            plugins={frecuenciaPiePlugins}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            frecuenciaPieData.labels,
                            frecuenciaPieData.datasets[0].data,
                            frecuenciaPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Top 10 vehiculos mas frecuentes</h3>
                      <div className="reporte-table-toolbar__controls">
                        <input
                          type="text"
                          placeholder="Buscar placa..."
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select
                          value={filtroTipoCliente}
                          onChange={(e) => setFiltroTipoCliente(e.target.value)}
                          className="reporte-table-input"
                        >
                          <option value="Todos">Todos los clientes</option>
                          {distribucionFrecuencia.map((item) => (
                            <option key={item.label} value={item.label}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
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
                          {filasFrecuencia.map((row, index) => (
                            <tr key={`${row.placa}-${index}`}>
                              <td>{index + 1}</td>
                              <td>{row.placa}</td>
                              <td>{row.modelo}</td>
                              <td>{row.color}</td>
                              <td>{row.tipoCliente}</td>
                              <td>{row.visitas}</td>
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

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Flujo diario"
                      description="Haz clic sobre una columna para concentrarte en ese dia."
                      insights={[
                        {
                          label: 'Dias con actividad',
                          value: formatNumber(flujoPorDia.length),
                        },
                        {
                          label: 'Pico de flujo',
                          value: flujoPorDia.reduce(
                            (best, row) => {
                              const total = row.entradas + row.salidas;
                              return total > best.total ? { label: row.label, total } : best;
                            },
                            { label: '—', total: 0 }
                          ).label,
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={flujoBarData}
                          options={buildCartesianOptions({
                            maxTicksLimit: 10,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroFechaFlujo(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Mix de clientes"
                      description="Selecciona un segmento para dejar solo ese perfil en la tabla."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={flujoPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroTipoCliente(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(data.totalRegistros || 0), color: '#0f172a' },
                                { text: 'registros', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            flujoPieData.labels,
                            flujoPieData.datasets[0].data,
                            flujoPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de flujo vehicular</h3>
                      <div className="reporte-table-toolbar__controls">
                        <input
                          type="text"
                          placeholder="Buscar placa..."
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select
                          value={filtroTipoCliente}
                          onChange={(e) => setFiltroTipoCliente(e.target.value)}
                          className="reporte-table-input"
                        >
                          <option value="Todos">Todos los clientes</option>
                          {flujoTipoCliente.map((item) => (
                            <option key={item.label} value={item.label}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        {filtroFechaFlujo ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroFechaFlujo('')}>
                            Fecha: {filtroFechaFlujo} x
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Tipo cliente</th>
                            <th>Referencia</th>
                            <th>Placa</th>
                            <th>Hora de entrada</th>
                            <th>Hora de salida</th>
                            <th>Tiempo de estadia</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filasFlujo.map((row, index) => (
                            <tr key={`${row.referencia}-${index}`}>
                              <td>{row.tipoCliente}</td>
                              <td>{row.referencia}</td>
                              <td>{row.placa}</td>
                              <td>{row.horaEntrada ? new Date(row.horaEntrada).toLocaleString('es-GT') : '—'}</td>
                              <td>{row.horaSalida ? new Date(row.horaSalida).toLocaleString('es-GT') : '—'}</td>
                              <td>{row.tiempoEstadia}</td>
                              <td>{row.estadoTicket}</td>
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
                      <div className="admin-kpi-label">Maximo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.maximo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.maximo ? `${data.maximo.placa} · ${new Date(data.maximo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Minimo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.minimo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.minimo ? `${data.minimo.placa} · ${new Date(data.minimo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Distribucion de registros por dia"
                      description="Haz clic en un segmento para filtrar la tabla por dia de la semana."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={tiempoPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroDia(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(tiempoTotales), color: '#0f172a' },
                                { text: 'registros', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            tiempoPieData.labels,
                            tiempoPieData.datasets[0].data,
                            tiempoPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Promedio de estadia por dia"
                      description="Cada barra muestra la permanencia media en minutos."
                      insights={[
                        {
                          label: 'Dia mas cargado',
                          value: diaMasCargado?.diaSemana || '—',
                        },
                        {
                          label: 'Registros del dia lider',
                          value: formatNumber(diaMasCargado?.cantidadRegistros || 0),
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={tiempoBarData}
                          options={buildCartesianOptions({
                            showLegend: false,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroDia(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Promedio por dia de la semana</h3>
                      <div className="reporte-table-toolbar__controls">
                        {filtroDia ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroDia('')}>
                            Quitar filtro: {filtroDia} x
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Dia</th>
                            <th>Promedio</th>
                            <th>Registros</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filasTiempo.map((row) => (
                            <tr key={row.diaSemana}>
                              <td>{row.diaSemana}</td>
                              <td>{row.promedioEtiqueta}</td>
                              <td>{row.cantidadRegistros}</td>
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

      {seccion === 'operativos' ? <ReportesOperativosMaquinasSection /> : null}
      {seccion === 'financieros' ? <ReportesFinancierosSection /> : null}
      {seccion === 'membresias_clientes' ? <ReportesMembresiasClientesSection /> : null}
      {seccion === 'afluencia' ? <ReportesAfluenciaSection /> : null}
    </div>
  );
}
