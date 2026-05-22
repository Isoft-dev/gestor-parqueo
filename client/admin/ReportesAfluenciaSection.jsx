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

export default function ReportesAfluenciaSection() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState('detallado');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [agrupacion, setAgrupacion] = useState('hora');
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
  }, [tab]);

  const generate = async () => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      const q = new URLSearchParams(
        tab === 'detallado'
          ? { desde, hasta, agrupacion }
          : { anio_inicio: anioInicio, anio_fin: anioFin }
      );
      const path = tab === 'detallado' ? '/reportes/afluencia/detallado' : '/reportes/afluencia/anual';
      const res = await fetch(`${API_BASE}${path}?${q}`, { cache: 'no-store' });
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
      tab === 'detallado'
        ? { desde, hasta, agrupacion }
        : { anio_inicio: anioInicio, anio_fin: anioFin }
    );
    const path = tab === 'detallado' ? '/reportes/afluencia/detallado/pdf' : '/reportes/afluencia/anual/pdf';
    window.open(`${API_BASE}${path}?${q}`, '_blank', 'noopener,noreferrer');
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
      <div className="reporte-tabs" role="tablist" aria-label="Subreportes de afluencia">
        <button type="button" role="tab" aria-selected={tab === 'detallado'} className={`reporte-tab-btn${tab === 'detallado' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('detallado')}>
          Afluencia detallada
        </button>
        <button type="button" role="tab" aria-selected={tab === 'anual'} className={`reporte-tab-btn${tab === 'anual' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('anual')}>
          Afluencia anual y resumen
        </button>
      </div>

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">{tab === 'detallado' ? 'Reporte de afluencia detallado' : 'Reporte de afluencia anual y resumen ejecutivo'}</h2>
        <form className="reporte-inc-form" onSubmit={(e) => { e.preventDefault(); generate(); }}>
          {tab === 'detallado' ? (
            <>
              <label className="reporte-inc-field"><span>Fecha inicio</span><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required /></label>
              <label className="reporte-inc-field"><span>Fecha fin</span><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required /></label>
              <label className="reporte-inc-field"><span>Agrupacion</span>
                <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)}>
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

              <div className="reporte-chart-grid">
                <ReportChartCard title="Afluencia por periodo" description="Haz clic en una barra para filtrar la tabla.">
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={chartData}
                      options={buildCartesianOptions({
                        onClick: (_, elements, chart) => {
                          const label = clickedLabel(elements, chart);
                          if (label) setFiltroPeriodo(label);
                        },
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
