/**
 * ReportesDashboard.jsx — Fase 3 + Fase 7
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard de KPIs siempre visible arriba del módulo de reportes.
 *
 * Fase 7 añade:
 *   - Skeleton loaders animados mientras carga (reemplaza los "…").
 *   - Delta vs período anterior: fetch paralelo del rango previo de igual
 *     duración (justo antes de `desde`) → muestra ▲ +X % / ▼ −X % en
 *     cada tarjeta.
 */

import { useCallback, useEffect, useState } from 'react';
import { useReportFilter } from './ReportFilterContext.jsx';

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmtMoney(n) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-CR').format(n);
}

/**
 * Calcula el rango del período anterior de igual duración.
 * Ejemplo: desde=2026-05-01, hasta=2026-05-30 (30 días)
 *   → desdePrev=2026-04-01, hastaPrev=2026-04-30
 */
function prevRange(desdeStr, hastaStr) {
  const desde = new Date(desdeStr + 'T00:00:00');
  const hasta = new Date(hastaStr + 'T00:00:00');
  const days  = Math.round((hasta - desde) / 86_400_000) + 1; // duración en días
  const hastaPrev = new Date(desde);
  hastaPrev.setDate(hastaPrev.getDate() - 1);
  const desdePrev = new Date(hastaPrev);
  desdePrev.setDate(desdePrev.getDate() - (days - 1));

  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desdePrev: fmt(desdePrev), hastaPrev: fmt(hastaPrev) };
}

/**
 * Calcula el delta porcentual entre valor actual y anterior.
 * Devuelve null si no hay datos suficientes.
 */
function calcDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current > 0 ? Infinity : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── Sub-componente: chip de delta ────────────────────────────────────────────

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  if (!Number.isFinite(delta)) {
    return <span className="kpi-delta kpi-delta--up">▲ nuevo</span>;
  }
  if (Math.abs(delta) < 0.05) {
    return <span className="kpi-delta kpi-delta--neutral">≈ sin cambio</span>;
  }
  const up   = delta > 0;
  const sign = up ? '▲' : '▼';
  const cls  = up ? 'kpi-delta--up' : 'kpi-delta--down';
  return (
    <span className={'kpi-delta ' + cls}>
      {sign} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ─── Sub-componente: skeleton de una tarjeta KPI ──────────────────────────────

function KpiSkeleton() {
  return (
    <div className="admin-kpi kpi-skeleton-card" aria-busy="true" aria-label="Cargando...">
      <div className="kpi-skeleton kpi-skeleton--label" />
      <div className="kpi-skeleton kpi-skeleton--value" />
      <div className="kpi-skeleton kpi-skeleton--hint" />
    </div>
  );
}

// ─── Fetch de KPIs ────────────────────────────────────────────────────────────

async function fetchKpisRaw(desde, hasta) {
  const q = new URLSearchParams({ desde, hasta });
  const res = await fetch(`/api/reportes/dashboard?${q}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReportesDashboard() {
  const { filtros } = useReportFilter();

  const [data,     setData]     = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchKpis = useCallback(async () => {
    const { desde, hasta } = filtros;
    if (!desde || !hasta) return;

    setLoading(true);
    setError(null);
    setPrevData(null);

    try {
      const { desdePrev, hastaPrev } = prevRange(desde, hasta);

      // Fetch en paralelo: período actual + período anterior
      const [cur, prev] = await Promise.allSettled([
        fetchKpisRaw(desde, hasta),
        fetchKpisRaw(desdePrev, hastaPrev),
      ]);

      if (cur.status === 'fulfilled') {
        setData(cur.value);
      } else {
        throw new Error(cur.reason?.message || 'Error al cargar KPIs');
      }

      if (prev.status === 'fulfilled') {
        setPrevData(prev.value);
      }
      // Si el período anterior falla, no bloqueamos — simplemente no mostramos delta
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtros.desde, filtros.hasta]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const kpis     = data?.kpis     ?? null;
  const prevKpis = prevData?.kpis ?? null;

  // Deltas
  const deltaEntradas    = calcDelta(kpis?.totalEntradas,   prevKpis?.totalEntradas);
  const deltaCobrado     = calcDelta(kpis?.totalCobrado,    prevKpis?.totalCobrado);
  const deltaMembresias  = calcDelta(kpis?.membresiasActivas, prevKpis?.membresiasActivas);
  const deltaAlertas     = calcDelta(kpis?.alertasEnPeriodo, prevKpis?.alertasEnPeriodo);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="reporte-dashboard-wrap">
      <div className="reporte-dashboard-header">
        <span className="reporte-dashboard-title">Resumen del período</span>
        {data?.periodo && !loading && (
          <span className="reporte-dashboard-period">
            {data.periodo.desde} → {data.periodo.hasta}
          </span>
        )}
        {prevData?.periodo && !loading && (
          <span className="reporte-dashboard-prev-period" title="Período anterior comparado">
            vs {prevData.periodo.desde} → {prevData.periodo.hasta}
          </span>
        )}
        {loading && (
          <span className="reporte-dashboard-loading">Actualizando…</span>
        )}
      </div>

      {error && (
        <div className="reporte-dashboard-error">⚠ {error}</div>
      )}

      {!error && (
        <div className="admin-kpi-grid">

          {loading ? (
            // ── Skeleton ──────────────────────────────────────────────────
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            // ── KPIs reales ────────────────────────────────────────────────
            <>
              {/* KPI 1 — Entradas */}
              <div className="admin-kpi admin-kpi--spaces">
                <span className="admin-kpi-label">Entradas totales</span>
                <div className="admin-kpi-value">
                  {fmtNum(kpis?.totalEntradas ?? null)}
                </div>
                <div className="admin-kpi-hint">Tickets generados en el período</div>
                <DeltaBadge delta={deltaEntradas} />
              </div>

              {/* KPI 2 — Cobrado */}
              <div className="admin-kpi admin-kpi--members">
                <span className="admin-kpi-label">Total cobrado</span>
                <div
                  className="admin-kpi-value"
                  style={{
                    fontSize: kpis && kpis.totalCobrado >= 1_000_000 ? '1.6rem' : undefined,
                  }}
                >
                  {fmtMoney(kpis?.totalCobrado ?? null)}
                </div>
                <div className="admin-kpi-hint">
                  {kpis ? fmtNum(kpis.totalTransacciones) + ' transacciones' : '—'}
                </div>
                <DeltaBadge delta={deltaCobrado} />
              </div>

              {/* KPI 3 — Membresías activas */}
              <div className="admin-kpi admin-kpi--alerts2">
                <span className="admin-kpi-label">Membresías activas</span>
                <div className="admin-kpi-value">
                  {fmtNum(kpis?.membresiasActivas ?? null)}
                </div>
                <div className="admin-kpi-hint">
                  {kpis ? 'de ' + fmtNum(kpis.membresiasTotales) + ' registradas' : '—'}
                </div>
                <DeltaBadge delta={deltaMembresias} />
                {kpis?.membresiasByEstado && (
                  <div className="admin-kpi-split">
                    {Object.entries(kpis.membresiasByEstado)
                      .filter(([, v]) => v > 0)
                      .slice(0, 3)
                      .map(([estado, cant]) => (
                        <div key={estado}>
                          <span className="admin-kpi-sub">{estado}</span>
                          <span className="admin-kpi-num">{fmtNum(cant)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* KPI 4 — Alertas */}
              <div className="admin-kpi admin-kpi--alerts">
                <span className="admin-kpi-label">Alertas en período</span>
                <div className="admin-kpi-value">
                  {fmtNum(kpis?.alertasEnPeriodo ?? null)}
                </div>
                <div className="admin-kpi-hint">
                  {kpis
                    ? fmtNum(kpis.alertasPendientes) + ' pendientes de atención'
                    : '—'}
                </div>
                <DeltaBadge delta={deltaAlertas} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
