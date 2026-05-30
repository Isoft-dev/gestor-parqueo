/**
 * useDrillDown.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook local de drill-down jerárquico para secciones de reportes (Fase 5).
 *
 * NO modifica el contexto global — el drill es interno a cada sección.
 *
 * Jerarquía temporal implementada:
 *   mes  →  semana  →  hora
 *
 * API expuesta:
 *   drillDesde     — string  fecha efectiva (override si hay drill activo)
 *   drillHasta     — string  fecha efectiva
 *   drillAgrupacion— string  agrupacion efectiva
 *   isDrilling     — bool
 *   breadcrumbs    — [{label, desde, hasta, agrupacion}]  ruta de vuelta
 *   drillInto(label, desde, hasta, agrupacion)  — baja un nivel
 *   drillBack()    — sube un nivel
 *   drillReset()   — vuelve al nivel raíz
 */

import { useCallback, useState } from 'react';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Calcula el rango de fechas (desde, hasta) para un mes dado.
 * @param {string} key — "YYYY-MM"
 */
export function monthRangeFromKey(key) {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-based
  const desde = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this
  const hasta = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { desde, hasta };
}

/**
 * Calcula el rango de fechas para una semana dada (formato servidor: "YYYY-SWW").
 * Usa la misma lógica de numeración que reporteAfluencia.js:
 *   week = ceil((dayOfYear + firstJan.getDay() + 1) / 7)
 */
export function weekRangeFromKey(key) {
  const m = key.match(/^(\d{4})-S(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const firstJan = new Date(year, 0, 1);
  // Inverse: start of this week in day-of-year terms
  // week = ceil((doy + dow0 + 1) / 7) => doy ≈ (week-1)*7 - dow0
  const dow0 = firstJan.getDay(); // 0=Sunday
  const approxDoy = (week - 1) * 7 - dow0; // 0-based day of year
  const weekStart = new Date(year, 0, 1 + Math.max(0, approxDoy));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { desde: ymd(weekStart), hasta: ymd(weekEnd) };
}

/**
 * Devuelve el siguiente nivel de agrupacion en la jerarquía.
 *   mes → semana → hora → null (ya no se puede bajar más)
 */
export function nextAgrupacion(current) {
  const map = { mes: 'semana', semana: 'hora' };
  return map[current] ?? null;
}

/**
 * Dado el periodoClave y la agrupacion actual, calcula el rango de fechas
 * para el drill-down al siguiente nivel.
 */
export function drillRange(periodoClave, agrupacion) {
  if (agrupacion === 'mes') return monthRangeFromKey(periodoClave);
  if (agrupacion === 'semana') return weekRangeFromKey(periodoClave);
  return null; // hora u otros son hojas
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * @param {string} baseDesde      — fecha raíz (del contexto global)
 * @param {string} baseHasta      — fecha raíz (del contexto global)
 * @param {string} baseAgrupacion — agrupacion raíz (del estado local de la sección)
 */
export function useDrillDown(baseDesde, baseHasta, baseAgrupacion) {
  // Cada entrada: { label, desde, hasta, agrupacion }
  const [stack, setStack] = useState([]);

  const isDrilling = stack.length > 0;

  // Valores efectivos: último del stack o valores raíz
  const current = stack[stack.length - 1];
  const drillDesde = current?.desde ?? baseDesde;
  const drillHasta = current?.hasta ?? baseHasta;
  const drillAgrupacion = current?.agrupacion ?? baseAgrupacion;

  /** Baja un nivel en la jerarquía */
  const drillInto = useCallback((label, desde, hasta, agrupacion) => {
    setStack((prev) => [...prev, { label, desde, hasta, agrupacion }]);
  }, []);

  /** Sube un nivel (vuelve al anterior) */
  const drillBack = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  /** Vuelve completamente al nivel raíz */
  const drillReset = useCallback(() => {
    setStack([]);
  }, []);

  /**
   * Breadcrumbs para mostrar la ruta de navegación.
   * Primer elemento = raíz; el resto = niveles del stack.
   */
  const breadcrumbs = [
    { label: 'Rango global', desde: baseDesde, hasta: baseHasta, agrupacion: baseAgrupacion, isRoot: true },
    ...stack.map((entry) => ({ ...entry, isRoot: false })),
  ];

  return {
    drillDesde,
    drillHasta,
    drillAgrupacion,
    isDrilling,
    breadcrumbs,
    drillInto,
    drillBack,
    drillReset,
    drillDepth: stack.length,
    drillStack: stack,
  };
}
