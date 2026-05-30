/**
 * server/utils/reporteFiltros.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilidad centralizada para construir cláusulas WHERE adicionales
 * a partir de los filtros globales que llegan en req.query.
 *
 * Diseño:
 *   • tipoVehiculo → se filtra en Oracle (columna tv.TVE_TIPO del JOIN)
 *   • tipoCliente  → se normaliza aquí; cada servicio lo aplica en JS
 *     (TIPO_CLIENTE es un alias CASE en el SELECT, no una columna directa)
 *
 * Uso en un servicio:
 *
 *   import { normalizarFiltrosGlobales, whereVehiculo, filtrarPorCliente } from '../utils/reporteFiltros.js';
 *
 *   export async function getMiReporte(desdeStr, hastaStr, params = {}) {
 *     const v = validateRango(desdeStr, hastaStr);
 *     const f = normalizarFiltrosGlobales(params);
 *     const { clause: tvWhere, binds: tvBinds } = whereVehiculo(f);
 *
 *     const rows = await executeSql(
 *       `SELECT ... FROM PAR_TICKET t
 *          JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
 *          ${vehiculoCatalogJoin('v')}
 *         WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN ...
 *           ${tvWhere}`,
 *       { ...v.periodo, ...tvBinds }
 *     );
 *
 *     return filtrarPorCliente(rows.map(mapRow), f);
 *   }
 */

// ─── Normalización ────────────────────────────────────────────────────────────

/**
 * Normaliza los parámetros globales que vienen de req.query.
 * Devuelve cadenas vacías para valores ausentes o "Todos".
 */
export function normalizarFiltrosGlobales(query = {}) {
  const norm = (x) => {
    const s = String(x ?? '').trim();
    return s && s !== 'Todos' ? s : '';
  };
  return {
    tipoVehiculo: norm(query.tipoVehiculo),
    tipoCliente:  norm(query.tipoCliente),
  };
}

// ─── WHERE de Oracle ──────────────────────────────────────────────────────────

/**
 * Genera la cláusula AND para filtrar por tipo de vehículo en Oracle.
 *
 * Requiere que la query ya tenga el join vehiculoCatalogJoin() activo,
 * que expone el alias de PAR_TIPO_VEHICULO como 'tv' (por defecto).
 *
 * @param {object} filtros  - Resultado de normalizarFiltrosGlobales()
 * @param {string} tvAlias  - Alias de PAR_TIPO_VEHICULO en la query (default 'tv')
 * @returns {{ clause: string, binds: object }}
 */
export function whereVehiculo(filtros, tvAlias = 'tv') {
  if (!filtros.tipoVehiculo) return { clause: '', binds: {} };
  return {
    clause: `AND ${tvAlias}.TVE_TIPO = :tipoVehiculo`,
    binds:  { tipoVehiculo: filtros.tipoVehiculo },
  };
}

// ─── Filtrado JS post-fetch ───────────────────────────────────────────────────

/**
 * Filtra un array de filas por tipoCliente (comparación de string).
 * Se aplica después del fetch porque TIPO_CLIENTE es un alias CASE en Oracle.
 *
 * Espera que cada fila tenga la propiedad `tipoCliente`.
 * Si filtros.tipoCliente está vacío, devuelve el array sin cambios.
 *
 * @param {Array}  rows
 * @param {object} filtros - Resultado de normalizarFiltrosGlobales()
 */
export function filtrarPorCliente(rows, filtros) {
  if (!filtros.tipoCliente) return rows;
  return rows.filter((r) => r.tipoCliente === filtros.tipoCliente);
}

/**
 * Aplica todos los filtros globales JS-side sobre un array de filas.
 * Útil cuando el servicio trae los datos por fecha y luego filtra en memoria.
 */
export function aplicarFiltrosGlobales(rows, filtros) {
  let result = rows;
  if (filtros.tipoCliente)  result = result.filter((r) => r.tipoCliente  === filtros.tipoCliente);
  if (filtros.tipoVehiculo) result = result.filter((r) => r.tipoVehiculo === filtros.tipoVehiculo);
  return result;
}
