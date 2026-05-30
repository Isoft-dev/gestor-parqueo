import { executeSql } from '../db/oracle.js';

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

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'La fecha de inicio no es válida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'La fecha de fin no es válida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  return {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── KPI 1: Total entradas (tickets generados en el período) ──────────── */
async function queryTotalEntradas(binds) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM PAR_TICKET t
      WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN
            TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
    binds
  );
  return num((rows[0] ?? {}).TOTAL ?? (rows[0] ?? {}).total);
}

/* ── KPI 2: Total cobrado (suma de cobros procesados en el período) ───── */
async function queryTotalCobrado(binds) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TRANSACCIONES,
            NVL(SUM(c.COB_MONTO_TOTAL), 0) AS MONTO_TOTAL
       FROM PAR_COBRO c
      WHERE TRUNC(c.COB_FECHA_HORA) BETWEEN
            TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
    binds
  );
  const r = rows[0] ?? {};
  return {
    totalTransacciones: num(r.TRANSACCIONES ?? r.transacciones),
    totalCobrado: Number(num(r.MONTO_TOTAL ?? r.monto_total).toFixed(2)),
  };
}

/* ── KPI 3: Membresías activas al día de hoy ─────────────────────────── */
async function queryMembresiasActivas() {
  const rows = await executeSql(
    `SELECT em.EME_ESTADO AS ESTADO, COUNT(*) AS CANTIDAD
       FROM PAR_MEMBRESIA m
       LEFT JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
      WHERE em.EME_ESTADO IS NOT NULL
      GROUP BY em.EME_ESTADO
      ORDER BY CANTIDAD DESC`,
    {}
  );
  const byEstado = {};
  let total = 0;
  for (const r of rows) {
    const estado = String(r.ESTADO ?? r.estado ?? 'Sin estado').trim();
    const cant = num(r.CANTIDAD ?? r.cantidad);
    byEstado[estado] = cant;
    total += cant;
  }
  const activas = num(byEstado['Activa'] ?? byEstado['ACTIVA'] ?? byEstado['activa'] ?? 0);
  return { total, activas, byEstado };
}

/* ── KPI 4: Alertas generadas en el período ─────────────────────────── */
async function queryTotalAlertas(binds) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL,
            SUM(CASE WHEN ea.EAL_ESTADO IS NULL OR LOWER(TRIM(ea.EAL_ESTADO)) NOT IN ('resuelta','atendida','cerrada')
                     THEN 1 ELSE 0 END) AS PENDIENTES
       FROM PAR_ALERTA a
       LEFT JOIN PAR_ESTADO_ALERTA ea ON ea.EAL_ID = a.EAL_ID
      WHERE TRUNC(a.ALE_FECHA_HORA_GENERACION) BETWEEN
            TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
    binds
  );
  const r = rows[0] ?? {};
  return {
    total: num(r.TOTAL ?? r.total),
    pendientes: num(r.PENDIENTES ?? r.pendientes),
  };
}

/* ── Función principal exportada ─────────────────────────────────────── */
export async function getDashboardKpis(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }

  const binds = { desde: v.desde, hasta: v.hasta };

  // Ejecutar las 4 queries en paralelo
  const [totalEntradas, cobros, membresias, alertas] = await Promise.all([
    queryTotalEntradas(binds),
    queryTotalCobrado(binds),
    queryMembresiasActivas(),
    queryTotalAlertas(binds),
  ]);

  return {
    periodo: { desde: v.desde, hasta: v.hasta },
    kpis: {
      totalEntradas,
      totalCobrado: cobros.totalCobrado,
      totalTransacciones: cobros.totalTransacciones,
      membresiasActivas: membresias.activas,
      membresiasTotales: membresias.total,
      membresiasByEstado: membresias.byEstado,
      alertasEnPeriodo: alertas.total,
      alertasPendientes: alertas.pendientes,
    },
  };
}
