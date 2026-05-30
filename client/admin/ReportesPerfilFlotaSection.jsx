import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  createHorizontalGradient,
  formatNumber,
} from './reportChartUtils.js';
import { ReportChartCard } from './ReportChartPrimitives.jsx';
import { ReportCardMenu, ReportDetailNav } from './ReportCardMenu.jsx';

import { useReportFilter } from './ReportFilterContext.jsx';
const PROFILE_REPORT_CARDS = [
  { id: 'heatmap', badge: 'MAP', eyebrow: 'Afluencia', label: 'Mapa de calor', summary: 'Entradas por franja horaria y dia de semana para ver picos de uso.', traits: ['Hora', 'Dia', 'Tipo'], icon: 'clock', tone: 'ocean' },
  { id: 'geo', badge: 'GEO', eyebrow: 'Clientes', label: 'Geografia clientes', summary: 'Distribucion geografica de clientes y comparativo de activos.', traits: ['Ciudad', 'Activos', 'Cliente'], icon: 'map', tone: 'mint' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

// Intensidad heatmap: valor → color rgba azul
function heatCell(value, max) {
  if (!max || value === 0) return 'rgba(226,232,240,0.5)';
  const r = value / max;
  if (r < 0.15) return `rgba(191,219,254,${0.4 + r * 2})`;
  if (r < 0.35) return `rgba(96,165,250,${0.5 + r})`;
  if (r < 0.6)  return `rgba(59,130,246,${0.65 + r * 0.5})`;
  if (r < 0.8)  return `rgba(37,99,235,${0.75 + r * 0.25})`;
  return `rgba(30,64,175,${0.88 + r * 0.12})`;
}
function heatTextColor(value, max) {
  if (!max || !value) return '#94a3b8';
  return value / max > 0.35 ? '#fff' : '#1e3a8a';
}

// ─── Componente Heatmap ───────────────────────────────────────────────────────

function Heatmap({ data }) {
  const { matrix, diasLabel, maxTotal } = data;
  const horas = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}h`);

  return (
    <div className="rflota-heatmap-wrap">
      <div className="rflota-heatmap">
        <div className="rflota-heatmap__corner" />
        {horas.map((h) => (
          <div key={h} className="rflota-heatmap__hour-label">{h}</div>
        ))}
        {diasLabel.map((dia, dIdx) => (
          <div key={dIdx} style={{ display: 'contents' }}>
            <div className="rflota-heatmap__day-label">{dia}</div>
            {Array.from({ length: 24 }, (_, hIdx) => {
              const cell = matrix[dIdx]?.[hIdx] ?? { total: 0, esporadico: 0, membresia: 0 };
              return (
                <div
                  key={hIdx}
                  className="rflota-heatmap__cell"
                  style={{ background: heatCell(cell.total, maxTotal) }}
                  title={`${dia} ${horas[hIdx]}: ${cell.total} visitas (${cell.esporadico} esp. / ${cell.membresia} mem.)`}
                >
                  <span style={{ color: heatTextColor(cell.total, maxTotal) }}>
                    {cell.total > 0 ? cell.total : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="rflota-heatmap__legend">
        <span className="rflota-heatmap__legend-label">Menos visitas</span>
        <div className="rflota-heatmap__legend-scale">
          {[0, 0.12, 0.3, 0.55, 0.78, 1].map((r, i) => (
            <div key={i} className="rflota-heatmap__legend-swatch"
              style={{ background: heatCell(r * (maxTotal || 1), maxTotal || 1) }} />
          ))}
        </div>
        <span className="rflota-heatmap__legend-label">Más visitas</span>
      </div>
    </div>
  );
}

// ─── Sección principal ────────────────────────────────────────────────────────

export default function ReportesPerfilFlotaSection({ onBackToReports = null }) {
  const { filtros, setFiltro } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [tab, setTab] = useState('heatmap');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [dataHeat, setDataHeat] = useState(null);
  const [dataGeo,  setDataGeo]  = useState(null);

  useEffect(() => { setError(''); }, [tab]);

  // Geografía se carga automáticamente al entrar al tab
  useEffect(() => {
    if (tab === 'geo' && !dataGeo) generateGeo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function generate(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    const q = new URLSearchParams({ desde, hasta }).toString();
    try {
      const r = await fetch(`${API_BASE}/reportes/perfil-flota/heatmap?${q}`, { cache: 'no-store' });
      const j = await parseJsonSafe(r);
      if (!r.ok) throw new Error(j.error || r.statusText);
      setDataHeat(j);
    } catch (err) {
      setError(err.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  async function generateGeo() {
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/reportes/perfil-flota/geo-clientes`, { cache: 'no-store' });
      const j = await parseJsonSafe(r);
      if (!r.ok) throw new Error(j.error || r.statusText);
      setDataGeo(j);
    } catch (err) {
      setError(err.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  // ── Datasets: zona ────────────────────────────────────────────────────────
  const zonaRows  = dataGeo?.porZona ?? [];
  const zonaChart = {
    labels: zonaRows.map((r) => r.zona),
    datasets: [
      { label: 'Total clientes', data: zonaRows.map((r) => r.total), borderRadius: 8, borderSkipped: false, maxBarThickness: 20,
        backgroundColor(ctx) { return createHorizontalGradient(ctx.chart, '#a5b4fc', REPORT_PALETTE.violet); } },
      { label: 'Clientes activos', data: zonaRows.map((r) => r.activos), borderRadius: 8, borderSkipped: false, maxBarThickness: 20,
        backgroundColor(ctx) { return createHorizontalGradient(ctx.chart, '#86efac', REPORT_PALETTE.green); } },
    ],
  };
  const zonaOpts = buildCartesianOptions({ indexAxis: 'y', numericFormatter: formatNumber });

  // ── Datasets: ciudad ──────────────────────────────────────────────────────
  const ciudadRows  = dataGeo?.porCiudad ?? [];
  const ciudadChart = {
    labels: ciudadRows.map((r) => r.ciudad),
    datasets: [
      { label: 'Total clientes', data: ciudadRows.map((r) => r.total), borderRadius: 8, borderSkipped: false, maxBarThickness: 20,
        backgroundColor(ctx) { return createHorizontalGradient(ctx.chart, '#fdba74', REPORT_PALETTE.orange); } },
      { label: 'Clientes activos', data: ciudadRows.map((r) => r.activos), borderRadius: 8, borderSkipped: false, maxBarThickness: 20,
        backgroundColor(ctx) { return createHorizontalGradient(ctx.chart, '#6ee7b7', REPORT_PALETTE.teal); } },
    ],
  };
  const ciudadOpts = buildCartesianOptions({ indexAxis: 'y', numericFormatter: formatNumber });

  const hasData = dataHeat || dataGeo;

  return (
    <>
      <ReportDetailNav
        eyebrow="Reportes"
        title="Perfil de flota"
        backLabel="Volver a reportes"
        onBack={onBackToReports}
      />
      <ReportCardMenu
        ariaLabel="Subreportes de perfil de flota"
        items={PROFILE_REPORT_CARDS}
        onSelect={setTab}
      />

      {/* Tabs */}

      <div className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">
          {tab === 'heatmap' && 'Mapa de calor — afluencia por hora y día'}
          {tab === 'geo'     && 'Perfil geográfico de clientes'}
        </h2>

        <form className="reporte-inc-form" onSubmit={tab === 'heatmap' ? generate : (e) => { e.preventDefault(); generateGeo(); }}>
          {tab === 'heatmap' && (
            <>
            </>
          )}
          {tab === 'geo' && (
            <p className="reporte-inc-field" style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
              Muestra todos los clientes registrados con zona o ciudad capturada.
            </p>
          )}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>
              {loading ? 'Generando…' : tab === 'geo' ? 'Actualizar' : 'Generar reporte'}
            </button>
          </div>
        </form>

        {error && <div className="admin-banner admin-banner--error" style={{ marginTop: '1rem' }}>{error}</div>}

        {/* ── TAB: HEATMAP ────────────────────────────────────── */}
        {tab === 'heatmap' && dataHeat && (
          <div style={{ marginTop: '1.5rem' }}>
            <ReportChartCard
              title="Mapa de calor de afluencia"
              description="Total de entradas (esporádicas + membresías) por franja horaria y día de la semana. Pasa el cursor sobre cada celda para ver el detalle."
              insights={dataHeat.maxTotal > 0 ? [
                { label: 'Pico máximo', value: `${formatNumber(dataHeat.maxTotal)} visitas en la franja más concurrida` },
              ] : [{ label: 'Aviso', value: 'Sin datos suficientes en el período.' }]}
            >
              <Heatmap data={dataHeat} />
            </ReportChartCard>
          </div>
        )}

        {/* ── TAB: GEOGRAFÍA ──────────────────────────────────── */}
        {tab === 'geo' && dataGeo && (
          <div className="reporte-chart-grid" style={{ marginTop: '1.5rem' }}>

            <ReportChartCard
              title="Clientes por zona"
              description="Top 15 zonas con más clientes registrados. Verde = activos."
              insights={zonaRows[0] ? [
                { label: 'Zona principal', value: `${zonaRows[0].zona} — ${formatNumber(zonaRows[0].total)} clientes` },
              ] : []}
            >
              {zonaRows.length > 0
                ? <div className="reporte-chart-canvas" style={{ minHeight: `${Math.max(200, zonaRows.length * 28)}px` }}>
                    <Bar data={zonaChart} options={zonaOpts} />
                  </div>
                : <p className="reporte-inc-empty">No hay zona registrada en los clientes.</p>
              }
            </ReportChartCard>

            <ReportChartCard
              title="Clientes por ciudad"
              description="Top 15 ciudades con más clientes registrados. Verde-agua = activos."
              insights={ciudadRows[0] ? [
                { label: 'Ciudad principal', value: `${ciudadRows[0].ciudad} — ${formatNumber(ciudadRows[0].total)} clientes` },
              ] : []}
            >
              {ciudadRows.length > 0
                ? <div className="reporte-chart-canvas" style={{ minHeight: `${Math.max(200, ciudadRows.length * 28)}px` }}>
                    <Bar data={ciudadChart} options={ciudadOpts} />
                  </div>
                : <p className="reporte-inc-empty">No hay ciudad registrada en los clientes.</p>
              }
            </ReportChartCard>

          </div>
        )}

        {/* Estado vacío */}
        {!loading && !error && !hasData && (
          <p className="reporte-inc-empty" style={{ marginTop: '2rem' }}>
            {tab === 'geo'
              ? 'Cargando datos de clientes…'
              : 'Selecciona el rango de fechas y presiona Generar reporte.'}
          </p>
        )}
      </div>
    </>
  );
}

