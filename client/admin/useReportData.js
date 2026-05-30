/**
 * useReportData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook centralizado para peticiones al backend de reportes.
 *
 * Lee los filtros globales de ReportFilterContext y añade parámetros extra
 * específicos de cada sección. Devuelve { data, loading, error, refetch }.
 *
 * Uso básico:
 *   const { data, loading, error } = useReportData('/reportes/movimiento-vehicular/frecuencia');
 *
 * Con parámetros extra propios de la sección:
 *   const { data, loading, error } = useReportData(
 *     '/reportes/movimiento-vehicular/frecuencia',
 *     { placa: filtroPlacaLocal }
 *   );
 *
 * El hook NO dispara la petición automáticamente al montar — use autoFetch:
 *   const { data } = useReportData(path, extra, { autoFetch: true });
 *
 * O llama a refetch() manualmente cuando el usuario presione "Aplicar".
 */

import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '../config.js';
import { useReportFilter } from './ReportFilterContext.jsx';

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * @param {string} path        - Ruta relativa, ej. '/reportes/afluencia/detallado'
 * @param {object} extraParams - Params adicionales que NO están en el contexto global
 * @param {object} options
 * @param {boolean} [options.autoFetch=false] - Si true, hace fetch al montar y cuando cambian los filtros
 */
export function useReportData(path, extraParams = {}, { autoFetch = false } = {}) {
  const { filtros } = useReportFilter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const fetch_ = useCallback(
    async (overrideParams = {}) => {
      // Cancela la petición anterior si sigue en vuelo
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError('');
      setLoading(true);
      setData(null);

      try {
        // Mezcla filtros globales + params extra + override puntual
        const params = new URLSearchParams({
          desde: filtros.desde,
          hasta: filtros.hasta,
          ...(filtros.tipoCliente !== 'Todos' && { tipoCliente: filtros.tipoCliente }),
          ...(filtros.tipoVehiculo !== 'Todos' && { tipoVehiculo: filtros.tipoVehiculo }),
          ...extraParams,
          ...overrideParams,
        });

        const res = await fetch(`${API_BASE}${path}?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      } catch (e) {
        if (e.name === 'AbortError') return; // petición cancelada, no es error real
        setError(e.message || 'Error al obtener el reporte');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, filtros.desde, filtros.hasta, filtros.tipoCliente, filtros.tipoVehiculo,
     JSON.stringify(extraParams)]
  );

  return { data, loading, error, refetch: fetch_ };
}

export default useReportData;
