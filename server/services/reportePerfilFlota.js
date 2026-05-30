import { executeSql } from '../db/oracle.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseYmd(s) {
  const m = String(s ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function daysInclusive(a, b) {
  return Math.floor((b - a) / 86400000) + 1;
}

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'Fecha de inicio no valida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'Fecha de fin no valida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la de fin.' };
  if (daysInclusive(desde, hasta) > 731) return { error: 'Rango maximo: 731 dias.' };
  const fmtD = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  return { periodo: { desde: fmtD(desde), hasta: fmtD(hasta) } };
}

function throwValidation(msg) {
  const e = new Error(msg);
  e.code = 'VALIDATION';
  throw e;
}

// ─── 1. Distribución por modelo / marca ─────────────────────────────────────

export async function getPerfilPorModelo({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) throwValidation(v.error);

  const rows = await executeSql(
    `SELECT
       NVL(mar.MAR_NOMBRE, '(Sin marca)') AS MARCA,
       NVL(mod.MOD_NOMBRE, '(Sin modelo)') AS MODELO,
       COUNT(*) AS TOTAL_VISITAS
     FROM (
       SELECT v.MOD_ID
         FROM PAR_TICKET t
         JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
        WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND t.TIC_FECHA_HORA_ENTRADA IS NOT NULL
       UNION ALL
       SELECT v.MOD_ID
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
         JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
         JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
        WHERE TRUNC(r.RMM_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND r.RMM_FECHA_HORA_ENTRADA IS NOT NULL
     ) vis
     LEFT JOIN PAR_MODELO_VEHICULO mod ON mod.MOD_ID = vis.MOD_ID
     LEFT JOIN PAR_MARCA_VEHICULO  mar ON mar.MAR_ID = mod.MAR_ID
     GROUP BY mar.MAR_NOMBRE, mod.MOD_NOMBRE
     ORDER BY TOTAL_VISITAS DESC
     FETCH FIRST 15 ROWS ONLY`,
    v.periodo
  );

  const totalGeneral = rows.reduce((s, r) => s + Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0), 0);
  const detalle = rows.map((r) => ({
    marca: r.MARCA ?? r.marca ?? '(Sin marca)',
    modelo: r.MODELO ?? r.modelo ?? '(Sin modelo)',
    etiqueta: `${r.MARCA ?? r.marca ?? '—'} ${r.MODELO ?? r.modelo ?? '—'}`.trim(),
    visitas: Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0),
    porcentaje: totalGeneral > 0
      ? Math.round((Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0) / totalGeneral) * 1000) / 10
      : 0,
  }));

  return {
    generadoEn: new Date().toISOString(),
    periodo: v.periodo,
    totalVisitas: totalGeneral,
    detalle,
  };
}

// ─── 2. Distribución por color ───────────────────────────────────────────────

export async function getPerfilPorColor({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) throwValidation(v.error);

  const rows = await executeSql(
    `SELECT
       NVL(col.COL_NOMBRE, '(Sin color)') AS COLOR,
       COUNT(*) AS TOTAL_VISITAS
     FROM (
       SELECT v.COL_ID
         FROM PAR_TICKET t
         JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
        WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND t.TIC_FECHA_HORA_ENTRADA IS NOT NULL
       UNION ALL
       SELECT v.COL_ID
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
         JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
         JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
        WHERE TRUNC(r.RMM_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND r.RMM_FECHA_HORA_ENTRADA IS NOT NULL
     ) vis
     LEFT JOIN PAR_COLOR_VEHICULO col ON col.COL_ID = vis.COL_ID
     GROUP BY col.COL_NOMBRE
     ORDER BY TOTAL_VISITAS DESC`,
    v.periodo
  );

  const totalGeneral = rows.reduce((s, r) => s + Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0), 0);
  const detalle = rows.map((r) => ({
    color: r.COLOR ?? r.color ?? '(Sin color)',
    visitas: Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0),
    porcentaje: totalGeneral > 0
      ? Math.round((Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0) / totalGeneral) * 1000) / 10
      : 0,
  }));

  return {
    generadoEn: new Date().toISOString(),
    periodo: v.periodo,
    totalVisitas: totalGeneral,
    detalle,
  };
}

// ─── 3. Heatmap afluencia hora × día de semana ───────────────────────────────
// Devuelve matriz [dia 0..6][hora 0..23] con conteos.
// dia 0 = lunes, 6 = domingo (semana laboral primero).

export async function getHeatmapAfluencia({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) throwValidation(v.error);

  const rows = await executeSql(
    `SELECT
       MOD(TO_NUMBER(TO_CHAR(FECHA_HORA, 'D')) + 5, 7) AS DIA_SEMANA,
       TO_NUMBER(TO_CHAR(FECHA_HORA, 'HH24'))          AS HORA,
       COUNT(*) AS TOTAL,
       SUM(CASE WHEN TIPO = 'ESP' THEN 1 ELSE 0 END) AS ESPORADICO,
       SUM(CASE WHEN TIPO = 'MEM' THEN 1 ELSE 0 END) AS MEMBRESIA
     FROM (
       SELECT TIC_FECHA_HORA_ENTRADA AS FECHA_HORA, 'ESP' AS TIPO
         FROM PAR_TICKET
        WHERE TRUNC(TIC_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND TIC_FECHA_HORA_ENTRADA IS NOT NULL
       UNION ALL
       SELECT RMM_FECHA_HORA_ENTRADA AS FECHA_HORA, 'MEM' AS TIPO
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
        WHERE TRUNC(RMM_FECHA_HORA_ENTRADA)
              BETWEEN TO_DATE(:desde,'YYYY-MM-DD') AND TO_DATE(:hasta,'YYYY-MM-DD')
          AND RMM_FECHA_HORA_ENTRADA IS NOT NULL
     )
     GROUP BY
       MOD(TO_NUMBER(TO_CHAR(FECHA_HORA, 'D')) + 5, 7),
       TO_NUMBER(TO_CHAR(FECHA_HORA, 'HH24'))
     ORDER BY DIA_SEMANA, HORA`,
    v.periodo
  );

  // Construir matriz 7×24 (dia × hora)
  const matrix = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ total: 0, esporadico: 0, membresia: 0 }))
  );

  let maxTotal = 0;
  rows.forEach((r) => {
    const dia  = Number(r.DIA_SEMANA  ?? r.dia_semana  ?? 0);
    const hora = Number(r.HORA        ?? r.hora        ?? 0);
    const total = Number(r.TOTAL      ?? r.total       ?? 0);
    const esp   = Number(r.ESPORADICO ?? r.esporadico  ?? 0);
    const mem   = Number(r.MEMBRESIA  ?? r.membresia   ?? 0);
    if (dia >= 0 && dia < 7 && hora >= 0 && hora < 24) {
      matrix[dia][hora] = { total, esporadico: esp, membresia: mem };
      if (total > maxTotal) maxTotal = total;
    }
  });

  const diasLabel = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return {
    generadoEn: new Date().toISOString(),
    periodo: v.periodo,
    maxTotal,
    diasLabel,
    matrix,
  };
}

// ─── 4. Perfil geográfico de clientes ────────────────────────────────────────

export async function getPerfilGeoClientes() {
  const [byZona, byCiudad] = await Promise.all([
    executeSql(
      `SELECT
         NVL(TRIM(c.CLI_ZONA), '(Sin zona)') AS ZONA,
         COUNT(*) AS TOTAL_CLIENTES,
         SUM(CASE WHEN c.CLI_ACTIVO = 1 THEN 1 ELSE 0 END) AS CLIENTES_ACTIVOS
       FROM PAR_CLIENTE c
       GROUP BY TRIM(c.CLI_ZONA)
       ORDER BY TOTAL_CLIENTES DESC
       FETCH FIRST 15 ROWS ONLY`
    ),
    executeSql(
      `SELECT
         NVL(TRIM(c.CLI_CIUDAD), '(Sin ciudad)') AS CIUDAD,
         COUNT(*) AS TOTAL_CLIENTES,
         SUM(CASE WHEN c.CLI_ACTIVO = 1 THEN 1 ELSE 0 END) AS CLIENTES_ACTIVOS
       FROM PAR_CLIENTE c
       GROUP BY TRIM(c.CLI_CIUDAD)
       ORDER BY TOTAL_CLIENTES DESC
       FETCH FIRST 15 ROWS ONLY`
    ),
  ]);

  const mapZona = (r) => ({
    zona: r.ZONA ?? r.zona ?? '(Sin zona)',
    total: Number(r.TOTAL_CLIENTES ?? r.total_clientes ?? 0),
    activos: Number(r.CLIENTES_ACTIVOS ?? r.clientes_activos ?? 0),
  });
  const mapCiudad = (r) => ({
    ciudad: r.CIUDAD ?? r.ciudad ?? '(Sin ciudad)',
    total: Number(r.TOTAL_CLIENTES ?? r.total_clientes ?? 0),
    activos: Number(r.CLIENTES_ACTIVOS ?? r.clientes_activos ?? 0),
  });

  return {
    generadoEn: new Date().toISOString(),
    porZona:   byZona.map(mapZona),
    porCiudad: byCiudad.map(mapCiudad),
  };
}
