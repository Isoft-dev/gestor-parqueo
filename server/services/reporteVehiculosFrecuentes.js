import { executeSql } from '../db/oracle.js';
import { buildVehiculosFrecuentesPdfBuffer as buildVehiculosFrecuentesPdfBufferBase } from './reporteMovimientoVehicular.js';
import { vehiculoCatalogGroupBy, vehiculoCatalogJoin, vehiculoCatalogSelect } from '../utils/vehiculoCatalogSql.js';

function parseYmd(s) {
  const m = String(s ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function daysInclusive(desde, hasta) {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'La fecha de inicio no es valida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'La fecha de fin no es valida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  const span = daysInclusive(desde, hasta);
  if (span > 731) return { error: 'El rango maximo permitido es de 731 dias (2 anios).' };
  return { desde, hasta };
}

function fmtPeriodo(desde, hasta) {
  return {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };
}

export async function getVehiculosFrecuentes(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const periodo = fmtPeriodo(v.desde, v.hasta);

  const [rowsEsp, rowsMem] = await Promise.all([
    executeSql(
      `SELECT t.VEH_ID,
              v.VEH_PLACA,
              ${vehiculoCatalogSelect('v')},
              COUNT(*) AS TOTAL_VISITAS
         FROM PAR_TICKET t
         JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
         ${vehiculoCatalogJoin('v')}
        WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
        GROUP BY t.VEH_ID, v.VEH_PLACA, ${vehiculoCatalogGroupBy('v')}`,
      periodo
    ),
    executeSql(
      `SELECT v.VEH_ID,
              v.VEH_PLACA,
              ${vehiculoCatalogSelect('v')},
              COUNT(*) AS TOTAL_VISITAS
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
         JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
         JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
         ${vehiculoCatalogJoin('v')}
        WHERE TRUNC(r.RMM_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
        GROUP BY v.VEH_ID, v.VEH_PLACA, ${vehiculoCatalogGroupBy('v')}`,
      periodo
    ),
  ]);

  const byVehiculo = new Map();
  const mergeRows = (rows, tipoCliente) => {
    rows.forEach((r) => {
      const vehiculoId = r.VEH_ID ?? r.veh_id;
      const placa = r.VEH_PLACA ?? r.veh_placa ?? '-';
      const modelo = r.VEH_MODELO ?? r.veh_modelo ?? '-';
      const marca = r.MAR_NOMBRE ?? r.mar_nombre ?? '-';
      const color = r.VEH_COLOR ?? r.veh_color ?? '-';
      const tipoVehiculo = r.TVE_TIPO ?? r.tve_tipo ?? '-';
      const visitas = Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0);
      const key = vehiculoId != null ? `veh-${vehiculoId}` : `placa-${placa}`;

      if (!byVehiculo.has(key)) {
        byVehiculo.set(key, {
          vehiculoId,
          placa,
          modelo,
          marca,
          color,
          tipoVehiculo,
          visitas: 0,
          tipoCliente,
        });
      }

      const current = byVehiculo.get(key);
      current.visitas += visitas;
      if (!current.modelo || current.modelo === '-') current.modelo = modelo;
      if (!current.marca || current.marca === '-') current.marca = marca;
      if (!current.color || current.color === '-') current.color = color;
      if (!current.tipoVehiculo || current.tipoVehiculo === '-') current.tipoVehiculo = tipoVehiculo;
      if (current.tipoCliente !== tipoCliente) current.tipoCliente = 'Mixto';
    });
  };

  mergeRows(rowsEsp, 'Esporadico');
  mergeRows(rowsMem, 'Mensual');

  const detalle = [...byVehiculo.values()].sort((a, b) => {
    if (b.visitas !== a.visitas) return b.visitas - a.visitas;
    return String(a.placa).localeCompare(String(b.placa));
  });

  return {
    periodo,
    totalVehiculos: detalle.length,
    top10: detalle.slice(0, 10),
    detalle,
  };
}

export const buildVehiculosFrecuentesPdfBuffer = buildVehiculosFrecuentesPdfBufferBase;
