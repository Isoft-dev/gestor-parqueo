/**
 * ReportFilterContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de filtros para el módulo de Reportes (Fase 1).
 *
 * Filtros globales (afectan a todas las secciones):
 *   desde        — fecha inicial  "YYYY-MM-DD"
 *   hasta        — fecha final    "YYYY-MM-DD"
 *   tipoCliente  — "Todos" | string con el tipo
 *   tipoVehiculo — "Todos" | string con el tipo
 *
 * API expuesta por el contexto:
 *   filtros        — objeto con todos los valores actuales
 *   setFiltro(k,v) — cambia un filtro por clave
 *   limpiar()      — restablece todos a sus valores por defecto
 *   filtrosActivos — array [{key, label, valor}] (solo los que difieren del default)
 *   limpiarDimensiones() — restablece solo tipoCliente y tipoVehiculo (conserva fechas)
 *   desde/hasta helpers
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultRange() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 29);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}

// ─── Valores por defecto ──────────────────────────────────────────────────────

const range = defaultRange();

const DEFAULTS = {
  desde: range.desde,
  hasta: range.hasta,
  tipoCliente: 'Todos',
  tipoVehiculo: 'Todos',
};

// Etiquetas legibles para mostrar en chips
const LABELS = {
  desde: 'Desde',
  hasta: 'Hasta',
  tipoCliente: 'Cliente',
  tipoVehiculo: 'Vehículo',
};

// ─── Contexto ─────────────────────────────────────────────────────────────────

const ReportFilterContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ReportFilterProvider({ children }) {
  const [filtros, setFiltros] = useState({ ...DEFAULTS });

  /** Actualiza un único filtro */
  const setFiltro = useCallback((key, value) => {
    const today = ymd(new Date());
    setFiltros((prev) => {
      if (key !== 'desde' && key !== 'hasta') {
        return { ...prev, [key]: value };
      }

      const v = String(value ?? '').slice(0, 10);
      const clamped = v && v > today ? today : v;
      const next = { ...prev, [key]: clamped };

      if (next.desde && next.hasta && next.desde > next.hasta) {
        if (key === 'desde') next.hasta = next.desde;
        else next.desde = next.hasta;
      }

      return next;
    });
  }, []);

  /** Restablece todos los filtros a los valores por defecto */
  const limpiar = useCallback(() => {
    setFiltros({ ...DEFAULTS });
  }, []);

  /**
   * Restablece solo las dimensiones de tipoCliente y tipoVehiculo.
   * Se usa al cambiar de sección/tab para evitar que filtros de cruce
   * de una sección contaminen otra donde no aplican.
   */
  const limpiarDimensiones = useCallback(() => {
    setFiltros((prev) => ({
      ...prev,
      tipoCliente: DEFAULTS.tipoCliente,
      tipoVehiculo: DEFAULTS.tipoVehiculo,
    }));
  }, []);

  /**
   * Lista de filtros que difieren del valor por defecto.
   * Útil para pintar los chips de "filtros activos".
   */
  const filtrosActivos = useMemo(() => {
    return Object.entries(filtros)
      .filter(([key, val]) => val !== DEFAULTS[key])
      .map(([key, valor]) => ({
        key,
        label: LABELS[key] ?? key,
        valor: String(valor),
      }));
  }, [filtros]);

  const value = useMemo(
    () => ({ filtros, setFiltro, limpiar, limpiarDimensiones, filtrosActivos, DEFAULTS }),
    [filtros, setFiltro, limpiar, limpiarDimensiones, filtrosActivos]
  );

  return (
    <ReportFilterContext.Provider value={value}>
      {children}
    </ReportFilterContext.Provider>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────

/** Usa el contexto global de filtros. Debe estar dentro de <ReportFilterProvider>. */
export function useReportFilter() {
  const ctx = useContext(ReportFilterContext);
  if (!ctx) {
    throw new Error('useReportFilter debe usarse dentro de <ReportFilterProvider>');
  }
  return ctx;
}

export default ReportFilterContext;
