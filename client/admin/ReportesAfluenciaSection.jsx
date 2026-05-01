import { useEffect, useMemo, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { API_BASE } from '../config.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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
  try { return JSON.parse(text); } catch { return { message: text }; }
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

  useEffect(() => {
    setError('');
    setData(null);
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
  const maxTotal = chartRows.reduce((m, x) => Math.max(m, Number(x.total || 0)), 0);
  const chartData = {
    labels: chartRows.map((x) => x.periodoLabel || x.anio),
    datasets: [
      {
        label: 'Esporádico',
        data: chartRows.map((x) => Number(x.esporadico || 0)),
        backgroundColor: chartRows.map((x) => (Number(x.total || 0) === maxTotal && maxTotal > 0 ? '#0369a1' : '#0ea5e9')),
      },
      {
        label: 'Membresía',
        data: chartRows.map((x) => Number(x.membresia || 0)),
        backgroundColor: chartRows.map((x) => (Number(x.total || 0) === maxTotal && maxTotal > 0 ? '#166534' : '#22c55e')),
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
              <label className="reporte-inc-field"><span>Agrupación</span>
                <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)}>
                  <option value="hora">Por hora del día</option>
                  <option value="dia_semana">Por día de la semana</option>
                  <option value="semana">Por semana</option>
                  <option value="mes">Por mes</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="reporte-inc-field"><span>Año inicio</span><input type="number" min="2000" max="2100" value={anioInicio} onChange={(e) => setAnioInicio(e.target.value)} required /></label>
              <label className="reporte-inc-field"><span>Año fin</span><input type="number" min="2000" max="2100" value={anioFin} onChange={(e) => setAnioFin(e.target.value)} required /></label>
            </>
          )}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>{loading ? 'Generando…' : 'Generar reporte'}</button>
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
              <div className="reporte-inc-chart-wrap">
                <h3 className="reporte-inc-subtitle">Afluencia por período</h3>
                <div style={{ height: 300 }}><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
              </div>
              {tab === 'detallado' ? (
                <div className="reporte-inc-table-wrap">
                  <h3 className="reporte-inc-subtitle">Detalle numérico</h3>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>Período</th><th>Esporádico</th><th>Membresía</th><th>Total</th></tr></thead>
                      <tbody>{(data.detalle || []).map((r) => <tr key={r.periodoClave}><td>{r.periodoLabel}</td><td>{r.esporadico}</td><td>{r.membresia}</td><td>{r.total}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Resumen ejecutivo</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Indicador</th><th>Período</th><th>Esporádico</th><th>Membresía</th><th>Total</th></tr></thead>
                        <tbody>
                          <tr><td>Hora pico</td><td>{data.resumenEjecutivo?.horaPico?.label || '—'}</td><td>{data.resumenEjecutivo?.horaPico?.esporadico || 0}</td><td>{data.resumenEjecutivo?.horaPico?.membresia || 0}</td><td>{data.resumenEjecutivo?.horaPico?.total || 0}</td></tr>
                          <tr><td>Día más frecuentado</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.label || '—'}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.esporadico || 0}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.membresia || 0}</td><td>{data.resumenEjecutivo?.diaMasFrecuentado?.total || 0}</td></tr>
                          <tr><td>Semana mayor</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.semanaMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Mes mayor</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.mesMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Año mayor</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.label || '—'}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.esporadico || 0}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.membresia || 0}</td><td>{data.resumenEjecutivo?.anioMayorAfluencia?.total || 0}</td></tr>
                          <tr><td>Promedio diario</td><td>—</td><td>{data.resumenEjecutivo?.promedioDiarioEsporadico || 0}</td><td>{data.resumenEjecutivo?.promedioDiarioMembresia || 0}</td><td>{data.resumenEjecutivo?.promedioDiarioVehiculos || 0}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Detalle anual</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Año</th><th>Esporádico</th><th>Membresía</th><th>Total</th></tr></thead>
                        <tbody>{(data.detalleAnual || []).map((r) => <tr key={r.anio}><td>{r.anio}</td><td>{r.esporadico}</td><td>{r.membresia}</td><td>{r.total}</td></tr>)}</tbody>
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
