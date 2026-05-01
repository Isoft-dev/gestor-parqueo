import PDFDocument from 'pdfkit/js/pdfkit.js';
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
    desde,
    hasta,
    periodo: {
      desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
      hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
    },
  };
}

function validateAnios(anioInicio, anioFin) {
  const ai = Number(anioInicio);
  const af = Number(anioFin);
  if (!Number.isInteger(ai) || ai < 2000 || ai > 2100) {
    return { error: 'El año inicio no es válido.' };
  }
  if (!Number.isInteger(af) || af < 2000 || af > 2100) {
    return { error: 'El año fin no es válido.' };
  }
  if (ai > af) return { error: 'El año inicio no puede ser mayor al año fin.' };
  if (af - ai > 10) return { error: 'El rango máximo permitido es de 10 años.' };
  return { ai, af };
}

function parseYm(s) {
  const m = String(s ?? '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || mo < 1 || mo > 12) return null;
  return { y, mo };
}

function validateMeses(mesInicio, mesFin) {
  const a = parseYm(mesInicio);
  const b = parseYm(mesFin);
  if (!a) return { error: 'El mes inicio no es válido (use AAAA-MM).' };
  if (!b) return { error: 'El mes fin no es válido (use AAAA-MM).' };
  const keyA = a.y * 100 + a.mo;
  const keyB = b.y * 100 + b.mo;
  if (keyA > keyB) return { error: 'El mes inicio no puede ser mayor al mes fin.' };
  if (keyB - keyA > 36) return { error: 'El rango máximo permitido es de 36 meses.' };
  return {
    mesInicio: `${a.y}-${String(a.mo).padStart(2, '0')}`,
    mesFin: `${b.y}-${String(b.mo).padStart(2, '0')}`,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function drawSimpleTable(doc, title, headers, widths, rows) {
  const left = doc.page.margins.left;
  const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowH = 17;
  const headH = 20;
  const drawHead = () => {
    doc.font('Helvetica-Bold').fontSize(10.6).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
    doc.moveDown(0.2);
    const y = doc.y;
    doc.rect(left, y, fullW, headH).fill('#e2e8f0');
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.1).fillColor('#0f172a');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
    doc.y = y + headH;
  };
  drawHead();
  (rows || []).forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHead();
    }
    const y = doc.y;
    if (idx % 2 === 0) doc.rect(left, y, fullW, rowH).fill('#f8fafc');
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, fullW, rowH).stroke();
    let x = left;
    doc.font('Helvetica').fontSize(7.6).fillColor('#0f172a');
    r.forEach((v, i) => {
      const t = String(v ?? '—').replace(/\s+/g, ' ').trim();
      doc.text(t.length > 42 ? `${t.slice(0, 41)}…` : t, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.55);
}

export async function getCobrosProcesadosPorMaquina({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }

  const rows = await executeSql(
    `WITH dmt_last AS (
      SELECT d.TIC_ID, d.MAQ_ID,
             ROW_NUMBER() OVER (PARTITION BY d.TIC_ID ORDER BY d.DMT_HORA_TRANSACCION DESC, d.DMT_ID DESC) AS rn
        FROM PAR_DETALLE_MAQUINA_TICKET d
    )
    SELECT NVL(m.MAQ_ID, -1) AS MAQ_ID,
           NVL(m.MAQ_CODIGO, 'Sin máquina') AS MAQ_CODIGO,
           COUNT(*) AS TRANSACCIONES,
           SUM(NVL(c.COB_MONTO_TOTAL, 0)) AS MONTO_TOTAL,
           SUM(NVL(c.COB_VUELTO, 0)) AS VUELTO_TOTAL,
           AVG(NVL(c.COB_MONTO_TOTAL, 0)) AS PROMEDIO,
           SUM(CASE WHEN NVL(c.COB_PROCESADO_MAQUINA, 0) = 1 THEN 1 ELSE 0 END) AS AUTO_CNT,
           SUM(CASE WHEN NVL(c.COB_PROCESADO_MAQUINA, 0) <> 1 THEN 1 ELSE 0 END) AS MANUAL_CNT
      FROM PAR_COBRO c
      LEFT JOIN dmt_last dl ON dl.TIC_ID = c.TIC_ID AND dl.rn = 1
      LEFT JOIN PAR_MAQUINA m ON m.MAQ_ID = dl.MAQ_ID
     WHERE TRUNC(c.COB_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
     GROUP BY NVL(m.MAQ_ID, -1), NVL(m.MAQ_CODIGO, 'Sin máquina')
     ORDER BY COUNT(*) DESC, NVL(m.MAQ_CODIGO, 'Sin máquina')`,
    v.periodo
  );

  const detalle = rows.map((r) => ({
    maquinaId: r.MAQ_ID ?? r.maq_id,
    maquina: r.MAQ_CODIGO ?? r.maq_codigo ?? 'Sin máquina',
    totalTransacciones: num(r.TRANSACCIONES ?? r.transacciones),
    montoTotalCobrado: num(r.MONTO_TOTAL ?? r.monto_total),
    montoTotalVuelto: num(r.VUELTO_TOTAL ?? r.vuelto_total),
    promedioCobro: num(r.PROMEDIO ?? r.promedio),
    transaccionesAutomaticas: num(r.AUTO_CNT ?? r.auto_cnt),
    transaccionesManual: num(r.MANUAL_CNT ?? r.manual_cnt),
  }));

  return {
    periodo: v.periodo,
    totalTransacciones: detalle.reduce((s, x) => s + x.totalTransacciones, 0),
    totalCobrado: Number(detalle.reduce((s, x) => s + x.montoTotalCobrado, 0).toFixed(2)),
    totalVuelto: Number(detalle.reduce((s, x) => s + x.montoTotalVuelto, 0).toFixed(2)),
    detalle,
  };
}

export async function getPagosMembresiasPorMes({ anioInicio, anioFin }) {
  const v = validateMeses(anioInicio, anioFin);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const { mesInicio, mesFin } = v;

  const porMesRows = await executeSql(
    `SELECT TO_CHAR(p.PAG_FECHA_HORA, 'YYYY-MM') AS ANIO_MES,
            COUNT(*) AS MEMBRESIAS_PAGADAS,
            SUM(NVL(p.PAG_MONTO_TOTAL, 0)) AS MONTO_TOTAL,
            AVG(NVL(p.PAG_MONTO_TOTAL, 0)) AS PROMEDIO
       FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
       JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
      WHERE TO_CHAR(p.PAG_FECHA_HORA, 'YYYY-MM') BETWEEN :mesInicio AND :mesFin
      GROUP BY TO_CHAR(p.PAG_FECHA_HORA, 'YYYY-MM')
      ORDER BY TO_CHAR(p.PAG_FECHA_HORA, 'YYYY-MM')`,
    { mesInicio, mesFin }
  );

  const detalleRows = await executeSql(
    `SELECT dpm.DPM_ID,
            p.PAG_FECHA_HORA,
            p.PAG_MONTO_TOTAL,
            tp.TPA_TIPO,
            v.VEH_PLACA,
            c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO
       FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
       JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
       LEFT JOIN PAR_TIPO_PAGO tp ON tp.TPA_ID = p.TPA_ID
       JOIN PAR_MEMBRESIA m ON m.MEM_ID = dpm.MEM_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE TO_CHAR(p.PAG_FECHA_HORA, 'YYYY-MM') BETWEEN :mesInicio AND :mesFin
      ORDER BY p.PAG_FECHA_HORA DESC, dpm.DPM_ID DESC`,
    { mesInicio, mesFin }
  );

  const nombreCliente = (r) =>
    [r.CLI_PRIMER_NOMBRE, r.CLI_SEGUNDO_NOMBRE, r.CLI_PRIMER_APELLIDO, r.CLI_SEGUNDO_APELLIDO]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ') || '—';

  return {
    periodo: { mesInicio, mesFin },
    porMes: porMesRows.map((r) => ({
      anioMes: r.ANIO_MES ?? r.anio_mes,
      membresiasPagadas: num(r.MEMBRESIAS_PAGADAS ?? r.membresias_pagadas),
      montoTotalRecaudado: num(r.MONTO_TOTAL ?? r.monto_total),
      promedioPagoMembresia: num(r.PROMEDIO ?? r.promedio),
    })),
    detalle: detalleRows.map((r) => ({
      id: r.DPM_ID ?? r.dpm_id,
      cliente: nombreCliente(r),
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      fechaPago: r.PAG_FECHA_HORA ?? r.pag_fecha_hora,
      monto: num(r.PAG_MONTO_TOTAL ?? r.pag_monto_total),
      metodoPago: r.TPA_TIPO ?? r.tpa_tipo ?? '—',
    })),
  };
}

export async function getIngresosPorTipoCliente({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const [espRow = {}, menRow = {}] = await Promise.all([
    executeSql(
      `SELECT COUNT(*) AS CNT, SUM(NVL(c.COB_MONTO_TOTAL, 0)) AS TOTAL
         FROM PAR_COBRO c
        WHERE TRUNC(c.COB_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
      v.periodo
    ).then((x) => x),
    executeSql(
      `SELECT COUNT(*) AS CNT, SUM(NVL(p.PAG_MONTO_TOTAL, 0)) AS TOTAL
         FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
         JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
        WHERE TRUNC(p.PAG_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
      v.periodo
    ).then((x) => x),
  ]);

  const espCnt = num(espRow[0]?.CNT ?? espRow[0]?.cnt);
  const menCnt = num(menRow[0]?.CNT ?? menRow[0]?.cnt);
  const espTot = num(espRow[0]?.TOTAL ?? espRow[0]?.total);
  const menTot = num(menRow[0]?.TOTAL ?? menRow[0]?.total);
  const all = espTot + menTot;

  return {
    periodo: v.periodo,
    esporadico: {
      totalRecaudado: Number(espTot.toFixed(2)),
      transacciones: espCnt,
      promedioPorTransaccion: espCnt > 0 ? Number((espTot / espCnt).toFixed(2)) : 0,
      porcentajeSobreTotal: all > 0 ? Number(((espTot / all) * 100).toFixed(1)) : 0,
    },
    mensual: {
      totalRecaudado: Number(menTot.toFixed(2)),
      transacciones: menCnt,
      promedioPorTransaccion: menCnt > 0 ? Number((menTot / menCnt).toFixed(2)) : 0,
      porcentajeSobreTotal: all > 0 ? Number(((menTot / all) * 100).toFixed(1)) : 0,
    },
    totalGeneral: Number(all.toFixed(2)),
  };
}

export async function getIngresosTotalesPorRango({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }

  const [espRows, menRows, detEsp, detMen] = await Promise.all([
    executeSql(
      `SELECT TO_CHAR(TRUNC(c.COB_FECHA_HORA), 'YYYY-MM-DD') AS FECHA_DIA,
              SUM(NVL(c.COB_MONTO_TOTAL, 0)) AS MONTO
         FROM PAR_COBRO c
        WHERE TRUNC(c.COB_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
        GROUP BY TRUNC(c.COB_FECHA_HORA)
        ORDER BY TRUNC(c.COB_FECHA_HORA)`,
      v.periodo
    ),
    executeSql(
      `SELECT TO_CHAR(TRUNC(p.PAG_FECHA_HORA), 'YYYY-MM-DD') AS FECHA_DIA,
              SUM(NVL(p.PAG_MONTO_TOTAL, 0)) AS MONTO
         FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
         JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
        WHERE TRUNC(p.PAG_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
        GROUP BY TRUNC(p.PAG_FECHA_HORA)
        ORDER BY TRUNC(p.PAG_FECHA_HORA)`,
      v.periodo
    ),
    executeSql(
      `SELECT c.COB_ID, c.COB_FECHA_HORA, c.COB_MONTO_TOTAL, tc.TCO_TIPO
         FROM PAR_COBRO c
         LEFT JOIN PAR_TIPO_COBRO tc ON tc.TCO_ID = c.TCO_ID
        WHERE TRUNC(c.COB_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
      v.periodo
    ),
    executeSql(
      `SELECT dpm.DPM_ID, p.PAG_FECHA_HORA, p.PAG_MONTO_TOTAL, tp.TPA_TIPO
         FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
         JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
         LEFT JOIN PAR_TIPO_PAGO tp ON tp.TPA_ID = p.TPA_ID
        WHERE TRUNC(p.PAG_FECHA_HORA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')`,
      v.periodo
    ),
  ]);

  const espByDay = new Map(espRows.map((r) => [String(r.FECHA_DIA ?? r.fecha_dia), num(r.MONTO ?? r.monto)]));
  const menByDay = new Map(menRows.map((r) => [String(r.FECHA_DIA ?? r.fecha_dia), num(r.MONTO ?? r.monto)]));
  const allDays = [...new Set([...espByDay.keys(), ...menByDay.keys()])].sort();
  const ingresosPorDia = allDays.map((d) => ({
    fecha: d,
    ingresoEsporadico: Number((espByDay.get(d) || 0).toFixed(2)),
    ingresoMensual: Number((menByDay.get(d) || 0).toFixed(2)),
  }));

  const detalleTransacciones = [
    ...detEsp.map((r) => ({
      fecha: r.COB_FECHA_HORA ?? r.cob_fecha_hora,
      tipoCliente: 'Esporádico',
      monto: num(r.COB_MONTO_TOTAL ?? r.cob_monto_total),
      metodoPago: r.TCO_TIPO ?? r.tco_tipo ?? '—',
      referencia: `COB-${r.COB_ID ?? r.cob_id}`,
    })),
    ...detMen.map((r) => ({
      fecha: r.PAG_FECHA_HORA ?? r.pag_fecha_hora,
      tipoCliente: 'Mensual',
      monto: num(r.PAG_MONTO_TOTAL ?? r.pag_monto_total),
      metodoPago: r.TPA_TIPO ?? r.tpa_tipo ?? '—',
      referencia: `DPM-${r.DPM_ID ?? r.dpm_id}`,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const ingresoEsp = detalleTransacciones
    .filter((x) => x.tipoCliente === 'Esporádico')
    .reduce((s, x) => s + x.monto, 0);
  const ingresoMen = detalleTransacciones
    .filter((x) => x.tipoCliente === 'Mensual')
    .reduce((s, x) => s + x.monto, 0);

  return {
    periodo: v.periodo,
    ingresoEsporadico: Number(ingresoEsp.toFixed(2)),
    ingresoMensual: Number(ingresoMen.toFixed(2)),
    ingresoTotal: Number((ingresoEsp + ingresoMen).toFixed(2)),
    ingresosPorDia,
    detalleTransacciones,
  };
}

export async function buildCobrosMaquinaPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de cobros procesados por máquina', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).text(`Transacciones: ${data.totalTransacciones} | Cobrado: Q${data.totalCobrado.toFixed(2)} | Vuelto: Q${data.totalVuelto.toFixed(2)}`);
    doc.moveDown(0.35);

    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(
      doc,
      'Detalle por máquina',
      ['Máquina', 'Transacciones', 'Cobrado total', 'Vuelto total', 'Promedio', 'Automáticas'],
      [fullW * 0.24, fullW * 0.15, fullW * 0.17, fullW * 0.16, fullW * 0.16, fullW * 0.12],
      data.detalle.map((r) => [
        r.maquina,
        r.totalTransacciones,
        `Q${r.montoTotalCobrado.toFixed(2)}`,
        `Q${r.montoTotalVuelto.toFixed(2)}`,
        `Q${r.promedioCobro.toFixed(2)}`,
        r.transaccionesAutomaticas,
      ])
    );
    doc.end();
  });
}

export async function buildPagosMembresiasMesPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de pagos de membresías por mes', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Meses: ${data.periodo.mesInicio} a ${data.periodo.mesFin}`, { align: 'center' });
    doc.moveDown(0.45);
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(
      doc,
      'Resumen mensual',
      ['Mes', 'Membresías pagadas', 'Monto recaudado', 'Promedio pago'],
      [fullW * 0.2, fullW * 0.22, fullW * 0.29, fullW * 0.29],
      data.porMes.map((r) => [r.anioMes, r.membresiasPagadas, `Q${r.montoTotalRecaudado.toFixed(2)}`, `Q${r.promedioPagoMembresia.toFixed(2)}`])
    );
    drawSimpleTable(
      doc,
      'Detalle de pagos',
      ['Cliente', 'Placa', 'Fecha pago', 'Monto', 'Método pago'],
      [fullW * 0.3, fullW * 0.11, fullW * 0.24, fullW * 0.13, fullW * 0.22],
      data.detalle.map((r) => [r.cliente, r.placa, r.fechaPago ? new Date(r.fechaPago).toLocaleString('es-GT') : '—', `Q${r.monto.toFixed(2)}`, r.metodoPago])
    );
    doc.end();
  });
}

export async function buildIngresosTipoClientePdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 46, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de ingresos por tipo de cliente', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).text('Resumen financiero');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Total general: Q${data.totalGeneral.toFixed(2)}`);
    doc.text(`Esporádico: Q${data.esporadico.totalRecaudado.toFixed(2)} (${data.esporadico.porcentajeSobreTotal}%) · Promedio: Q${data.esporadico.promedioPorTransaccion.toFixed(2)}`);
    doc.text(`Membresía: Q${data.mensual.totalRecaudado.toFixed(2)} (${data.mensual.porcentajeSobreTotal}%) · Promedio: Q${data.mensual.promedioPorTransaccion.toFixed(2)}`);
    doc.moveDown(0.6);
    drawSimpleTable(
      doc,
      'Proporción por tipo',
      ['Tipo de cliente', 'Transacciones', 'Total recaudado', 'Promedio por transacción'],
      [130, 110, 150, 160],
      [
        ['Esporádico', data.esporadico.transacciones, `Q${data.esporadico.totalRecaudado.toFixed(2)}`, `Q${data.esporadico.promedioPorTransaccion.toFixed(2)}`],
        ['Membresía', data.mensual.transacciones, `Q${data.mensual.totalRecaudado.toFixed(2)}`, `Q${data.mensual.promedioPorTransaccion.toFixed(2)}`],
      ]
    );
    doc.end();
  });
}

export async function buildIngresosTotalesPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de ingresos totales por rango de fechas', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.45);
    doc.font('Helvetica').fontSize(9).text(`Ingreso total: Q${data.ingresoTotal.toFixed(2)} | Esporádico: Q${data.ingresoEsporadico.toFixed(2)} | Mensual: Q${data.ingresoMensual.toFixed(2)}`);
    doc.moveDown(0.35);
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(
      doc,
      'Ingresos por día',
      ['Fecha', 'Esporádico', 'Mensual'],
      [fullW * 0.4, fullW * 0.3, fullW * 0.3],
      data.ingresosPorDia.map((r) => [r.fecha, `Q${r.ingresoEsporadico.toFixed(2)}`, `Q${r.ingresoMensual.toFixed(2)}`])
    );
    drawSimpleTable(
      doc,
      'Detalle de transacciones',
      ['Fecha', 'Tipo cliente', 'Monto', 'Método pago', 'Referencia'],
      [fullW * 0.25, fullW * 0.17, fullW * 0.16, fullW * 0.22, fullW * 0.2],
      data.detalleTransacciones.map((r) => [
        r.fecha ? new Date(r.fecha).toLocaleString('es-GT') : '—',
        r.tipoCliente,
        `Q${Number(r.monto || 0).toFixed(2)}`,
        r.metodoPago || '—',
        r.referencia || '—',
      ])
    );
    doc.end();
  });
}
