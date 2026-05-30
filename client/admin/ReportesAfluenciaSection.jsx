import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  buildDoughnutOptions,
  buildLegendItems,
  createCenterTextPlugin,
  createVerticalGradient,
  formatNumber,
} from './reportChartUtils.js';
import { ReportChartCard, ReportLegend } from './ReportChartPrimitives.jsx';
import { ReportCardMenu, ReportDetailNav } from './ReportCardMenu.jsx';

import { useReportFilter } from './ReportFilterContext.jsx';
import { useDrillDown, drillRange, nextAgrupacion } from './useDrillDown.js';
import DrillBreadcrumb from './DrillBreadcrumb.jsx';
const AFLUENCIA_REPORT_CARDS = [
  { id: 'detallado', badge: 'DET', eyebrow: 'Detalle', label: 'Afluencia detallada', summary: 'Agrupa entradas por hora, dia, semana o mes dentro del rango elegido.', traits: ['Hora', 'Dia', 'Mes'], icon: 'calendar', tone: 'ocean' },
  { id: 'anual', badge: 'ANU', eyebrow: 'Resumen', label: 'Afluencia anual', summary: 'Compara anios completos y muestra el resumen ejecutivo de visitas.', traits: ['Anio', 'Resumen', 'PDF'], icon: 'chart', tone: 'mint' },
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

export default function ReportesAfluenciaSection({ onBackToReports = null }) {
  const { filtros, setFiltro } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [tab, setTab] = useState('detallado');
  const [agrupacion, setAgrupacion] = useState('mes');

  const {
    drillDesde,
    drillHasta,
    drillAgrupacion,
    isDrilling,
    breadcrumbs,
    drillInto,
    drillBack,
    drillReset,
    drillDepth,
    drillStack,
  } = useDrillDown(desde, hasta, agrupacion);
  const [anioInicio, setAnioInicio] = useState(String(new Date().getFullYear() - 1));
  const [anioFin, setAnioFin] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');

  useEffect(() => {
    setError('');
    setData(null);
    setFiltroPeriodo('');
    drillReset();
  }, [tab]);


  /** Carga datos con parámetros explícitos (para drill) o usa los efectivos actuales */
  const generateWith = async (pDesde, pHasta, pAgr, pTab = null) => {
    const efectivoTab = pTab ?? tab;
    setError('');
    setData(null);
    setFiltroPeriodo('');
    setLoading(true);
    try {
      const q = new URLSearchParams(
        efectivoTab === 'detallado'
          ? { desde: pDesde ?? drillDesde, hasta: pHasta ?? drillHasta, agrupacion: pAgr ?? drillAgrupacion }
          : { anio_inicio: anioInicio, anio_fin: anioFin }
      );
      const apiPath = efectivoTab === 'detallado' ? '/reportes/afluencia/detallado' : '/reportes/afluencia/anual';
      const res = await fetch(`${API_BASE}${apiPath}?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setData(json);
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  /** Genera usando los valores actuales del drill (llamado desde el botón) */
  const generate = () => generateWith();

  const exportPdf = () => {
    const q = new URLSearchParams(
      tab === 'detallado'
        ? { desde: drillDesde, hasta: drillHasta, agrupacion: drillAgrupacion }
        : { anio_inicio: anioInicio, anio_fin: anioFin }
    );
    const path = tab === 'detallado' ? '/reportes/afluencia/detallado/pdf' : '/reportes/afluencia/anual/pdf';
    window.open(`${API_BASE}${path}?${q}`, '_blank', 'noopener,noreferrer');
  };

  /**
   * Maneja el drill-down al hacer clic en una barra de la gráfica.
   * Solo aplica en el tab 'detallado' con agrupaciones que tienen sub-niveles.
   */
  /** Drill-down: baja un nivel y auto-genera el reporte con los nuevos params */
  const handleBarDrill = async (periodoClave, periodoLabel) => {
    const next = nextAgrupacion(drillAgrupacion);
    if (!next) return;
    const range = drillRange(periodoClave, drillAgrupacion);
    if (!range) return;
    drillInto(periodoLabel, range.desde, range.hasta, next);
    // Auto-genera con los params calculados (no espera la actualización de estado del hook)
    await generateWith(range.desde, range.hasta, next);
  };

  /** Sube un nivel y regenera con los params del nivel anterior */
  const handleDrillBack = async () => {
    const prevStack = drillStack.slice(0, -1);
    const prev = prevStack[prevStack.length - 1];
    const pDesde = prev?.desde ?? desde;
    const pHasta = prev?.hasta ?? hasta;
    const pAgr   = prev?.agrupacion ?? agrupacion;
    drillBack();
    await generateWith(pDesde, pHasta, pAgr);
  };

  /** Vuelve al nivel raíz y regenera con los params globales */
  const handleDrillReset = async () => {
    drillReset();
    await generateWith(desde, hasta, agrupacion);
  };

  /** Drill-down desde el tab anual: click en año → abre detallado filtrado */
  const handleAnnualBarDrill = async (year) => {
    const pDesde = `${year}-01-01`;
    const pHasta = `${year}-12-31`;
    const pAgr   = 'mes';
    // Cambiar tab primero (lo que triggerea drillReset via useEffect)
    // Luego drillInto + generate con los nuevos params
    setTab('detallado');
    setAgrupacion(pAgr);
    // Usamos timeout cero para que el useEffect([tab]) se ejecute antes
    setTimeout(async () => {
      drillInto(String(year), pDesde, pHasta, pAgr);
      await generateWith(pDesde, pHasta, pAgr);
    }, 0);
  };

  const chartRows = tab === 'detallado' ? (data?.detalle || []) : (data?.detalleAnual || []);
  const chartData = {
    labels: chartRows.map((row) => row.periodoLabel || row.anio),
    datasets: [
      {
        label: 'Esporadico',
        data: chartRows.map((row) => Number(row.esporadico || 0)),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#7dd3fc', REPORT_PALETTE.blue);
        },
      },
      {
        label: 'Membresia',
        data: chartRows.map((row) => Number(row.membresia || 0)),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#86efac', REPORT_PALETTE.green);
        },
      },
    ],
  };

  const totalEsporadico = chartRows.reduce((sum, row) => sum + Number(row.esporadico || 0), 0);
  const totalMembresia = chartRows.reduce((sum, row) => sum + Number(row.membresia || 0), 0);
  const mixData = {
    labels: ['Esporadico', 'Membresia'],
    datasets: [
      {
        data: [totalEsporadico, totalMembresia],
        backgroundColor: [REPORT_PALETTE.blue, REPORT_PALETTE.green],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  return (
    <>
      <ReportDetailNav
        eyebrow="Reportes"
        title="Afluencia"
        backLabel="Volver a reportes"
        onBack={onBackToReports}
      />
      <ReportCardMenu
        ariaLabel="Subreportes de afluencia"
        items={AFLUENCIA_REPORT_CARDS}
        onSelect={setTab}
      />

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">{tab === 'detallado' ? 'Reporte de afluencia detallado' : 'Reporte de afluencia anual y resumen ejecutivo'}</h2>
        <form className="reporte-inc-form" onSubmit={(e) => { e.preventDefault(); generate(); }}>
          {tab === 'detallado' ? (
            <>
              <label className="reporte-inc-field"><span>Agrupacion</span>
                <select value={drillAgrupacion} onChange={(e) => { setAgrupacion(e.target.value); drillReset(); }} disabled={isDrilling} title={isDrilling ? "Salir del drill-down para cambiar la agrupación" : ""}>
                  <option value="hora">Por hora del dia</option>
                  <option value="dia_semana">Por dia de la semana</option>
                  <option value="semana">Por semana</option>
                  <option value="mes">Por mes</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="reporte-inc-field"><span>Anio inicio</span><input type="number" min="2000" max="2100" value={anioInicio} onChange={(e) => setAnioInicio(e.target.value)} required /></label>
              <label className="reporte-inc-field"><span>Anio fin</span><input type="number" min="2000" max="2100" value={anioFin} onChange={(e) => setAnioFin(e.target.value)} required /></label>
            </>
          )}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>{loading ? 'Generando...' : 'Generar reporte'}</button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading}>Exportar PDF</button>
          </div>
        </form>
      </section>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {data == null ? null : (
        <>
          {!chartRows.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
          {chartRows.length ? (
            <>
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Total ingresos</div><div className="admin-kpi-value">{tab === 'detallado' ? data.totalIngresos : data.totalIngresos}</div></article>
                <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Mayor afluencia</div><div className="admin-kpi-value" style={{ fontSize: '1rem' }}>{tab === 'detallado' ? (data.periodoMayorAfluencia?.periodo || '—') : (data.anioMayorAfluencia?.anio || '—')}</div></article>
              </div>

              <DrillBreadcrumb
                breadcrumbs={breadcrumbs}
                onBack={handleDrillBack}
                onReset={handleDrillReset}
                isDrilling={isDrilling}
              />
              <div className="reporte-chart-grid">
                <ReportChartCard title={
                    tab === 'anual'
                      ? 'Afluencia anual'
                      : isDrilling
                        ? ('Afluencia por periodo — ' + (breadcrumbs[breadcrumbs.length - 1]?.label ?? ''))
                        : 'Afluencia por periodo'
                  }
                  description={
                    tab === 'anual'
                      ? 'Haz clic en un año para ver el detalle mensual.'
                      : nextAgrupacion(drillAgrupacion)
                        ? 'Haz clic en una barra para profundizar (drill-down).'
                        : 'Haz clic en una barra para filtrar la tabla.'
                  }>
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={chartData}
                      options={buildCartesianOptions({
                        onClick: (_, elements, chart) => {
                          if (!elements?.length) return;
                          const idx = elements[0].index;
                          const row = chartRows[idx];
                          if (!row) return;
                          // Tab anual: drill hacia detallado por año
                          if (tab === 'anual') {
                            if (row.anio) handleAnnualBarDrill(row.anio);
                            return;
                          }
                          // Tab detallado: drill jerárquico o filtro de tabla
                          const next = nextAgrupacion(drillAgrupacion);
                          if (next) {
                            handleBarDrill(row.periodoClave ?? String(row.anio ?? ''), row.periodoLabel ?? String(row.anio ?? ''));
                          } else {
                            const label = clickedLabel(elements, chart);
                            if (label) setFiltroPeriodo(label);
                          }
                        }
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard title="Mix de afluencia" description="Comparativo global entre esporadicos y membresias.">
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut
                        data={mixData}
                        options={buildDoughnutOptions()}
                        plugins={[
                          createCenterTextPlugin([
                            { text: formatNumber(totalEsporadico + totalMembresia) },
                            { text: 'ingresos', color: '#64748b' },
                          ]),
                        ]}
                      />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        mixData.labels,
                        mixData.datasets[0].data,
                        mixData.datasets[0].backgroundColor
                      )}
                    />
                  </div>
                </ReportChartCard>
              </div>

              {tab === 'detallado' ? (
                <div className="reporte-inc-table-wrap">
                  <div className="reporte-table-toolbar">
                    <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle numerico</h3>
                    <div className="reporte-table-toolbar__controls">
                      {filtroPeriodo ? (
                        <button type="button" className="admin-btn-ghost" onClick={() => setFiltroPeriodo('')}>
                          Quitar filtro: {filtroPeriodo} x
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>Periodo</th><th>Esporadico</th><th>Membresia</th><th>Total</th></tr></thead>
                      <tbody>
                        {(data.detalle || [])
                          .filter((row) => !filtroPeriodo || row.periodoLabel === filtroPeriodo)
                          .map((row) => <tr key={row.periodoClave}><td>{row.periodoLabel}</td><td>{row.esporadico}</td><td>{row.membresia}</td><td>{row.total}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Resumen ejecutivo</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Indicador</th><th>Periodo</th><th>Esporadico</th><th>Membresia</th><th>Total</th></tr></thead>
                        <tbody>
                          <tr><td>Hora pico</td><td>{data.resumenEjecutivo?.horaPico?.label || '—'}</td><td>{data.resumenEjecutivo?.horaPico?.esporadico || 0}</td><td>{data.resumenEjecutivo?.horaPico?.membresia || 0}</td><td>{data.resumenEjecutivo?.horaPico?.total || 0}</td></tr>
                          <tr><td>Dia mas frecuentado</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.label || '—'}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.esporadico || 0}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.membresia || 0}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.total || 0}</td></tr>
                          <tr><td>Semana mayor</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Mes mayor</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Anio mayor</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Promedio diario</td><td>—</td><td>{data.resumenEjecutivo?.promedioDiarioEsporadico || 0}</td><td>{data.resumenEjecutivo?.promedioDiarioMembresia || 0}</td><td>{data.resumenEjecutivo?.promedioDiarioVehiculos || 0}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle anual</h3>
                      <div className="reporte-table-toolbar__controls">
                        {filtroPeriodo ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroPeriodo('')}>
                            Quitar filtro: {filtroPeriodo} x
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Anio</th><th>Esporadico</th><th>Membresia</th><th>Total</th></tr></thead>
                        <tbody>
                          {(data.detalleAnual || [])
                            .filter((row) => !filtroPeriodo || String(row.anio) === filtroPeriodo)
                            .map((row) => <tr key={row.anio}><td>{row.anio}</td><td>{row.esporadico}</td><td>{row.membresia}</td><td>{row.total}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </>
  );
}

