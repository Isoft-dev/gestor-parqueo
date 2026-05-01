import PDFDocument from 'pdfkit/js/pdfkit.js';
import { executeSql } from '../db/oracle.js';

const BASE_SQL = `
  FROM PAR_BITACORA_INCIDENTE_VEHICULO b
  JOIN PAR_VEHICULO v ON b.VEH_ID = v.VEH_ID
  JOIN PAR_INCIDENTE i ON b.INC_ID = i.INC_ID
`;

const BASE_SQL_CON_USUARIO = `
  FROM PAR_BITACORA_INCIDENTE_VEHICULO b
  JOIN PAR_VEHICULO v ON b.VEH_ID = v.VEH_ID
  JOIN PAR_INCIDENTE i ON b.INC_ID = i.INC_ID
  LEFT JOIN PAR_USUARIO u ON b.USU_ID = u.USU_ID
`;

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

function eachYmdInRange(desde, hasta) {
  const out = [];
  const cur = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const end = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function estadoResolucion(bivResuelto) {
  const n = Number(bivResuelto ?? 0);
  return n === 1 ? 'Resuelto' : 'Pendiente';
}

function esResueltoFlag(bivResuelto) {
  return Number(bivResuelto ?? 0) === 1;
}

function formatDuracionMinutos(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function nombreUsuarioResolvio(r) {
  const parts = [
    r.USU_PRIMER_NOMBRE ?? r.usu_primer_nombre,
    r.USU_SEGUNDO_NOMBRE ?? r.usu_segundo_nombre,
    r.USU_PRIMER_APELLIDO ?? r.usu_primer_apellido,
    r.USU_SEGUNDO_APELLIDO ?? r.usu_segundo_apellido,
  ]
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'La fecha de inicio no es válida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'La fecha de fin no es válida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  const span = daysInclusive(desde, hasta);
  if (span > 731) return { error: 'El rango máximo permitido es de 731 días (2 años).' };
  return { desde, hasta, span };
}

export async function getIncidentesPorRango(desdeStr, hastaStr, incIdOpt) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const { desde, hasta, span } = v;

  const incFilter =
    incIdOpt != null && String(incIdOpt).trim() !== ''
      ? ' AND b.INC_ID = :incId'
      : '';
  const binds = {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };
  if (incFilter) binds.incId = incIdOpt;

  const porDia = await executeSql(
    `SELECT TO_CHAR(TRUNC(b.BIV_FECHA_HORA), 'YYYY-MM-DD') AS FECHA_DIA,
            COUNT(*) AS CNT
       ${BASE_SQL}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ${incFilter}
      GROUP BY TRUNC(b.BIV_FECHA_HORA)
      ORDER BY TRUNC(b.BIV_FECHA_HORA)`,
    binds
  );

  const detalleRows = await executeSql(
    `SELECT b.BIV_ID,
            b.BIV_FECHA_HORA,
            b.BIV_DESCRIPCION,
            b.BIV_RESUELTO,
            b.INC_ID,
            i.INC_TIPO,
            i.INC_DESCRIPCION AS INC_DESC_CAT,
            v.VEH_PLACA
       ${BASE_SQL}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ${incFilter}
      ORDER BY b.BIV_FECHA_HORA DESC`,
    binds
  );

  const countMap = new Map();
  for (const row of porDia) {
    const key = row.FECHA_DIA ?? row.fecha_dia;
    countMap.set(String(key), Number(row.CNT ?? row.cnt ?? 0));
  }

  const fechas = eachYmdInRange(desde, hasta);
  const serieDiaria = fechas.map((fecha) => ({
    fecha,
    cantidad: countMap.get(fecha) ?? 0,
  }));

  const total = detalleRows.length;
  let maxCant = 0;
  let fechaMax = null;
  for (const p of serieDiaria) {
    if (p.cantidad > maxCant) {
      maxCant = p.cantidad;
      fechaMax = p.fecha;
    }
  }
  const promedioDiario = span > 0 ? Number((total / span).toFixed(2)) : 0;

  const detalle = detalleRows.map((r) => ({
    id: r.BIV_ID ?? r.biv_id,
    fechaHora: r.BIV_FECHA_HORA ?? r.biv_fecha_hora,
    tipoIncidente: r.INC_TIPO ?? r.inc_tipo ?? '—',
    descripcion: r.INC_DESC_CAT ?? r.inc_desc_cat ?? r.BIV_DESCRIPCION ?? r.biv_descripcion ?? '—',
    placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
    estadoResolucion: estadoResolucion(r.BIV_RESUELTO ?? r.biv_resuelto),
    incId: r.INC_ID ?? r.inc_id,
  }));

  return {
    periodo: { desde: binds.desde, hasta: binds.hasta },
    resumen: {
      totalIncidentes: total,
      promedioDiario,
      fechaConMasIncidentes: maxCant > 0 ? fechaMax : null,
      maxIncidentesEnUnDia: maxCant,
    },
    serieDiaria,
    detalle,
  };
}

/**
 * Agrupa bitácora por tipo de incidente (INC_TIPO) en el rango de fechas.
 */
export async function getIncidentesPorTipoRango(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const { desde, hasta } = v;

  const binds = {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };

  const rows = await executeSql(
    `SELECT i.INC_ID,
            i.INC_TIPO,
            COUNT(*) AS TOTAL,
            SUM(CASE WHEN NVL(b.BIV_RESUELTO, 0) = 1 THEN 1 ELSE 0 END) AS RESUELTOS,
            SUM(CASE WHEN NVL(b.BIV_RESUELTO, 0) <> 1 THEN 1 ELSE 0 END) AS PENDIENTES
       ${BASE_SQL}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      GROUP BY i.INC_ID, i.INC_TIPO
      ORDER BY COUNT(*) DESC, i.INC_TIPO`,
    binds
  );

  const parsed = rows.map((r) => {
    const ocurrencias = Number(r.TOTAL ?? r.total ?? 0);
    const resueltos = Number(r.RESUELTOS ?? r.resueltos ?? 0);
    const pendientes = Number(r.PENDIENTES ?? r.pendientes ?? 0);
    return {
      incidenteId: r.INC_ID ?? r.inc_id,
      tipoIncidente: r.INC_TIPO ?? r.inc_tipo ?? '—',
      ocurrencias,
      resueltos,
      pendientes,
    };
  });

  const maxOcc = parsed.reduce((m, r) => Math.max(m, r.ocurrencias), 0);
  const porTipo = parsed.map((r) => ({
    ...r,
    esMasFrecuente: maxOcc > 0 && r.ocurrencias === maxOcc,
  }));

  const top = porTipo.find((r) => r.esMasFrecuente) ?? null;
  const totalRegistros = parsed.reduce((s, r) => s + r.ocurrencias, 0);

  return {
    periodo: { desde: binds.desde, hasta: binds.hasta },
    totalRegistros,
    tipoMasFrecuente: top
      ? { tipoIncidente: top.tipoIncidente, ocurrencias: top.ocurrencias }
      : null,
    porTipo,
  };
}

/**
 * Agrupa por BIV_RESUELTO (resuelto / pendiente), detalle con usuario y tiempo promedio de resolución.
 */
export async function getIncidentesPorResolucionRango(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const { desde, hasta } = v;

  const binds = {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };

  const grupos = await executeSql(
    `SELECT NVL(b.BIV_RESUELTO, 0) AS FLAG,
            COUNT(*) AS CNT
       ${BASE_SQL_CON_USUARIO}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      GROUP BY NVL(b.BIV_RESUELTO, 0)
      ORDER BY NVL(b.BIV_RESUELTO, 0)`,
    binds
  );

  let resueltos = 0;
  let pendientes = 0;
  for (const row of grupos) {
    const flag = Number(row.FLAG ?? row.flag ?? 0);
    const cnt = Number(row.CNT ?? row.cnt ?? 0);
    if (flag === 1) resueltos = cnt;
    else pendientes += cnt;
  }
  const totalRegistros = resueltos + pendientes;

  const porResolucion = [];
  if (totalRegistros > 0) {
    porResolucion.push({
      clave: 'resuelto',
      etiqueta: 'Resueltos',
      cantidad: resueltos,
      porcentaje: Number(((resueltos / totalRegistros) * 100).toFixed(1)),
    });
    porResolucion.push({
      clave: 'pendiente',
      etiqueta: 'Pendientes',
      cantidad: pendientes,
      porcentaje: Number(((pendientes / totalRegistros) * 100).toFixed(1)),
    });
  }

  const avgRows = await executeSql(
    `SELECT AVG((b.BIV_FECHA_RESOLUCION - b.BIV_FECHA_HORA) * 24 * 60) AS AVG_MIN
       ${BASE_SQL_CON_USUARIO}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
        AND NVL(b.BIV_RESUELTO, 0) = 1
        AND b.BIV_FECHA_RESOLUCION IS NOT NULL
        AND b.BIV_FECHA_RESOLUCION >= b.BIV_FECHA_HORA`,
    binds
  );
  const avgMinRaw = avgRows[0]?.AVG_MIN ?? avgRows[0]?.avg_min;
  const tiempoPromedioResolucionMinutos =
    avgMinRaw != null && Number.isFinite(Number(avgMinRaw)) ? Number(avgMinRaw) : null;

  const detalleRows = await executeSql(
    `SELECT b.BIV_ID,
            i.INC_TIPO,
            v.VEH_PLACA,
            b.BIV_FECHA_HORA,
            b.BIV_RESUELTO,
            b.BIV_FECHA_RESOLUCION,
            u.USU_PRIMER_NOMBRE,
            u.USU_SEGUNDO_NOMBRE,
            u.USU_PRIMER_APELLIDO,
            u.USU_SEGUNDO_APELLIDO
       ${BASE_SQL_CON_USUARIO}
      WHERE TRUNC(b.BIV_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ORDER BY b.BIV_FECHA_HORA DESC`,
    binds
  );

  const detalle = detalleRows.map((r) => {
    const res = esResueltoFlag(r.BIV_RESUELTO ?? r.biv_resuelto);
    return {
      id: r.BIV_ID ?? r.biv_id,
      tipoIncidente: r.INC_TIPO ?? r.inc_tipo ?? '—',
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      fechaRegistro: r.BIV_FECHA_HORA ?? r.biv_fecha_hora,
      estadoResolucion: estadoResolucion(r.BIV_RESUELTO ?? r.biv_resuelto),
      estadoClave: res ? 'resuelto' : 'pendiente',
      fechaResolucion: res ? (r.BIV_FECHA_RESOLUCION ?? r.biv_fecha_resolucion ?? null) : null,
      usuarioResolvio: res ? nombreUsuarioResolvio(r) : '—',
    };
  });

  return {
    periodo: { desde: binds.desde, hasta: binds.hasta },
    totalRegistros,
    resueltos,
    pendientes,
    porResolucion,
    tiempoPromedioResolucionMinutos,
    tiempoPromedioResolucionEtiqueta:
      resueltos > 0 && tiempoPromedioResolucionMinutos != null
        ? formatDuracionMinutos(tiempoPromedioResolucionMinutos)
        : resueltos > 0
          ? '—'
          : null,
    detalle,
  };
}

export async function buildIncidentesPdfBuffer(data) {
  const { periodo, resumen, serieDiaria, detalle } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 17;
    const headH = 20;

    const drawTable = (title, headers, widths, rows) => {
      const drawHead = () => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
        doc.moveDown(0.2);
        const y = doc.y;
        doc.rect(left, y, fullW, headH).fill('#e2e8f0');
        let x = left;
        doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#0f172a');
        headers.forEach((h, i) => {
          doc.text(h, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        });
        doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
        doc.y = y + headH;
      };
      drawHead();
      rows.forEach((r, idx) => {
        if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          drawHead();
        }
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(left, y, fullW, rowH).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, fullW, rowH).stroke();
        let x = left;
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
        r.forEach((cell, i) => {
          const txt = String(cell ?? '—').replace(/\s+/g, ' ').trim();
          doc.text(txt.length > 42 ? `${txt.slice(0, 41)}…` : txt, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        });
        doc.y = y + rowH;
      });
      doc.moveDown(0.6);
    };

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de incidentes', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    doc.text(`Total de incidentes: ${resumen.totalIncidentes}`);
    doc.text(`Promedio diario: ${resumen.promedioDiario}`);
    doc.text(`Día con más incidentes: ${resumen.fechaConMasIncidentes || '—'} (${resumen.maxIncidentesEnUnDia || 0})`);
    doc.moveDown(0.6);

    const porDiaConIncidentes = (serieDiaria || []).filter((p) => Number(p.cantidad || 0) > 0);
    drawTable(
      'Detalle por día (solo con incidentes)',
      ['Fecha', 'Incidentes'],
      [fullW * 0.68, fullW * 0.32],
      porDiaConIncidentes.map((p) => [p.fecha, p.cantidad])
    );

    drawTable(
      'Detalle de registros',
      ['Fecha y hora', 'Tipo', 'Placa', 'Estado', 'Descripción'],
      [fullW * 0.25, fullW * 0.2, fullW * 0.12, fullW * 0.13, fullW * 0.3],
      (detalle || []).map((row) => [
        row.fechaHora ? new Date(row.fechaHora).toLocaleString('es-GT') : '—',
        row.tipoIncidente,
        row.placa,
        row.estadoResolucion,
        row.descripcion,
      ])
    );

    doc.end();
  });
}

export async function buildIncidentesPorTipoPdfBuffer(data) {
  const { periodo, totalRegistros, tipoMasFrecuente, porTipo } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 17;
    const headH = 20;

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de incidentes por tipo', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Total de registros: ${totalRegistros}`);
    doc.text(`Tipo más frecuente: ${tipoMasFrecuente ? `${tipoMasFrecuente.tipoIncidente} (${tipoMasFrecuente.ocurrencias})` : '—'}`);
    doc.moveDown(0.45);

    const y = doc.y;
    doc.rect(left, y, fullW, headH).fill('#e2e8f0');
    const widths = [fullW * 0.46, fullW * 0.18, fullW * 0.18, fullW * 0.18];
    const headers = ['Tipo de incidente', 'Ocurrencias', 'Resueltos', 'Pendientes'];
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#0f172a');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
    doc.y = y + headH;

    (porTipo || []).forEach((row, idx) => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      if (idx % 2 === 0) doc.rect(left, yy, fullW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowH).stroke();
      const vals = [row.esMasFrecuente ? `★ ${row.tipoIncidente}` : row.tipoIncidente, row.ocurrencias, row.resueltos, row.pendientes];
      x = left;
      doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
      vals.forEach((v2, i) => {
        doc.text(String(v2), x + 4, yy + 5, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.y = yy + rowH;
    });

    doc.end();
  });
}

export async function buildIncidentesPorResolucionPdfBuffer(data) {
  const {
    periodo,
    totalRegistros,
    resueltos,
    pendientes,
    tiempoPromedioResolucionEtiqueta,
    detalle,
  } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 17;
    const headH = 20;
    const widths = [fullW * 0.22, fullW * 0.1, fullW * 0.2, fullW * 0.12, fullW * 0.2, fullW * 0.16];
    const headers = ['Tipo incidente', 'Placa', 'Fecha registro', 'Estado', 'Fecha resolución', 'Usuario'];

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de incidentes por resolución', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Total: ${totalRegistros} | Resueltos: ${resueltos} | Pendientes: ${pendientes}`);
    doc.text(`Tiempo promedio de resolución: ${tiempoPromedioResolucionEtiqueta || '—'}`);
    doc.moveDown(0.45);

    const y = doc.y;
    doc.rect(left, y, fullW, headH).fill('#e2e8f0');
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.3).fillColor('#0f172a');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
    doc.y = y + headH;

    (detalle || []).forEach((row, idx) => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      if (idx % 2 === 0) doc.rect(left, yy, fullW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowH).stroke();
      const vals = [
        row.tipoIncidente,
        row.placa,
        row.fechaRegistro ? new Date(row.fechaRegistro).toLocaleString('es-GT') : '—',
        row.estadoResolucion,
        row.fechaResolucion ? new Date(row.fechaResolucion).toLocaleString('es-GT') : '—',
        row.usuarioResolvio,
      ];
      x = left;
      doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
      vals.forEach((v2, i) => {
        const txt = String(v2 ?? '—');
        doc.text(txt.length > 28 ? `${txt.slice(0, 27)}…` : txt, x + 4, yy + 5, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.y = yy + rowH;
    });

    doc.end();
  });
}
