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

function daysInclusive(desde, hasta) {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'La fecha de inicio no es válida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'La fecha de fin no es válida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  const span = daysInclusive(desde, hasta);
  if (span > 731) return { error: 'El rango máximo permitido es de 731 días (2 años).' };
  return {
    desde,
    hasta,
    periodo: {
      desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
      hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
    },
  };
}

function buildPdf(title, periodo, sections) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 46, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text(title, { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.8);
    (sections || []).forEach((s) => {
      doc.font('Helvetica-Bold').fontSize(11).text(s.title);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9);
      (s.lines || []).forEach((ln) => {
        if (doc.y > doc.page.height - 60) doc.addPage();
        doc.text(ln);
      });
      doc.moveDown(0.6);
    });
    doc.end();
  });
}

export async function getAlertasPorMaquinaTipo({ desde, hasta, maqId, talId, ealId }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const binds = { ...v.periodo };
  const filters = [];
  if (maqId != null && String(maqId).trim() !== '') {
    filters.push('a.MAQ_ID = :maqId');
    binds.maqId = maqId;
  }
  if (talId != null && String(talId).trim() !== '') {
    filters.push('a.TAL_ID = :talId');
    binds.talId = talId;
  }
  if (ealId != null && String(ealId).trim() !== '') {
    filters.push('a.EAL_ID = :ealId');
    binds.ealId = ealId;
  }
  const whereExtra = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  const rows = await executeSql(
    `SELECT a.ALE_ID, a.MAQ_ID, m.MAQ_CODIGO, a.TAL_ID, ta.TAL_TIPO, a.EAL_ID, ea.EAL_ESTADO,
            a.ALE_MOTIVO, a.ALE_FECHA_HORA_GENERACION, a.ALE_FECHA_ATENCION
       FROM PAR_ALERTA a
       LEFT JOIN PAR_MAQUINA m ON m.MAQ_ID = a.MAQ_ID
       LEFT JOIN PAR_TIPO_ALERTA ta ON ta.TAL_ID = a.TAL_ID
       LEFT JOIN PAR_ESTADO_ALERTA ea ON ea.EAL_ID = a.EAL_ID
      WHERE TRUNC(a.ALE_FECHA_HORA_GENERACION) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ${whereExtra}
      ORDER BY a.ALE_FECHA_HORA_GENERACION DESC, a.ALE_ID DESC`,
    binds
  );

  const detalle = rows.map((r) => ({
    alertaId: r.ALE_ID ?? r.ale_id,
    maquinaId: r.MAQ_ID ?? r.maq_id,
    maquina: r.MAQ_CODIGO ?? r.maq_codigo ?? `M-${r.MAQ_ID ?? r.maq_id ?? 'N/D'}`,
    tipoAlertaId: r.TAL_ID ?? r.tal_id,
    tipoAlerta: r.TAL_TIPO ?? r.tal_tipo ?? '—',
    estadoId: r.EAL_ID ?? r.eal_id,
    estadoActual: r.EAL_ESTADO ?? r.eal_estado ?? '—',
    motivo: r.ALE_MOTIVO ?? r.ale_motivo ?? '—',
    fechaGeneracion: r.ALE_FECHA_HORA_GENERACION ?? r.ale_fecha_hora_generacion,
    fechaAtencion: r.ALE_FECHA_ATENCION ?? r.ale_fecha_atencion ?? null,
  }));

  const byMachine = new Map();
  const byMachineType = new Map();
  detalle.forEach((d) => {
    byMachine.set(d.maquina, (byMachine.get(d.maquina) || 0) + 1);
    const k = `${d.maquina}|||${d.tipoAlerta}`;
    byMachineType.set(k, (byMachineType.get(k) || 0) + 1);
  });
  const alertasPorMaquina = [...byMachine.entries()]
    .map(([maquina, total]) => ({ maquina, total }))
    .sort((a, b) => b.total - a.total || String(a.maquina).localeCompare(String(b.maquina)));
  const alertasPorMaquinaTipo = [...byMachineType.entries()]
    .map(([k, total]) => {
      const [maquina, tipoAlerta] = k.split('|||');
      return { maquina, tipoAlerta, total };
    })
    .sort((a, b) => b.total - a.total || String(a.maquina).localeCompare(String(b.maquina)));

  return {
    periodo: v.periodo,
    totalAlertas: detalle.length,
    alertasPorMaquina,
    alertasPorMaquinaTipo,
    detalle,
  };
}

export async function getMantenimientosPorMaquina({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const rows = await executeSql(
    `SELECT r.REM_ID, r.MAQ_ID, m.MAQ_CODIGO, tm.TMA_TIPO,
            r.REM_MANTENIMIENTO_FECHA, r.REM_DESCRIPCION
       FROM PAR_REGISTRO_MANTENIMIENTO r
       JOIN PAR_MAQUINA m ON m.MAQ_ID = r.MAQ_ID
       LEFT JOIN PAR_TIPO_MAQUINA tm ON tm.TMA_ID = m.TMA_ID
      WHERE TRUNC(r.REM_MANTENIMIENTO_FECHA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ORDER BY r.REM_MANTENIMIENTO_FECHA DESC, r.REM_ID DESC`,
    v.periodo
  );
  const detalle = rows.map((r) => ({
    mantenimientoId: r.REM_ID ?? r.rem_id,
    maquinaId: r.MAQ_ID ?? r.maq_id,
    maquina: r.MAQ_CODIGO ?? r.maq_codigo ?? `M-${r.MAQ_ID ?? r.maq_id ?? 'N/D'}`,
    tipoMaquina: r.TMA_TIPO ?? r.tma_tipo ?? '—',
    fechaMantenimiento: r.REM_MANTENIMIENTO_FECHA ?? r.rem_mantenimiento_fecha,
    descripcion: r.REM_DESCRIPCION ?? r.rem_descripcion ?? '—',
  }));

  const totalPorMaquinaMap = new Map();
  const byMachineDates = new Map();
  detalle.forEach((d) => {
    totalPorMaquinaMap.set(d.maquina, (totalPorMaquinaMap.get(d.maquina) || 0) + 1);
    if (!byMachineDates.has(d.maquina)) byMachineDates.set(d.maquina, []);
    byMachineDates.get(d.maquina).push(new Date(d.fechaMantenimiento));
  });

  const totalPorMaquina = [...totalPorMaquinaMap.entries()]
    .map(([maquina, total]) => ({ maquina, total }))
    .sort((a, b) => b.total - a.total || String(a.maquina).localeCompare(String(b.maquina)));

  const promedioDiasEntreMantenimientos = [...byMachineDates.entries()].map(([maquina, fechas]) => {
    const sorted = fechas
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);
    if (sorted.length < 2) return { maquina, promedioDias: null, muestras: sorted.length };
    let suma = 0;
    let n = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      suma += (sorted[i].getTime() - sorted[i - 1].getTime()) / (24 * 60 * 60 * 1000);
      n += 1;
    }
    return { maquina, promedioDias: Number((suma / n).toFixed(2)), muestras: sorted.length };
  }).sort((a, b) => {
    if (a.promedioDias == null && b.promedioDias == null) return String(a.maquina).localeCompare(String(b.maquina));
    if (a.promedioDias == null) return 1;
    if (b.promedioDias == null) return -1;
    return a.promedioDias - b.promedioDias;
  });

  return {
    periodo: v.periodo,
    totalMantenimientos: detalle.length,
    totalPorMaquina,
    promedioDiasEntreMantenimientos,
    detalle,
  };
}

export async function getRecargasEfectivoPorMaquina({ desde, hasta }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const recargas = await executeSql(
    `SELECT r.RMA_ID, r.MAQ_ID, m.MAQ_CODIGO, r.RMA_MANTENIMIENTO_FECHA, r.RMA_DESCRIPCION
       FROM PAR_RECARGO_MAQUINA r
       JOIN PAR_MAQUINA m ON m.MAQ_ID = r.MAQ_ID
      WHERE TRUNC(r.RMA_MANTENIMIENTO_FECHA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ORDER BY r.RMA_MANTENIMIENTO_FECHA DESC, r.RMA_ID DESC`,
    v.periodo
  );
  const detalle = recargas.map((r) => ({
    recargaId: r.RMA_ID ?? r.rma_id,
    maquinaId: r.MAQ_ID ?? r.maq_id,
    maquina: r.MAQ_CODIGO ?? r.maq_codigo ?? `M-${r.MAQ_ID ?? r.maq_id ?? 'N/D'}`,
    fechaRecarga: r.RMA_MANTENIMIENTO_FECHA ?? r.rma_mantenimiento_fecha,
    descripcion: r.RMA_DESCRIPCION ?? r.rma_descripcion ?? '—',
  }));
  const totalPorMaquinaMap = new Map();
  detalle.forEach((d) => totalPorMaquinaMap.set(d.maquina, (totalPorMaquinaMap.get(d.maquina) || 0) + 1));
  const totalPorMaquina = [...totalPorMaquinaMap.entries()]
    .map(([maquina, total]) => ({ maquina, total }))
    .sort((a, b) => b.total - a.total || String(a.maquina).localeCompare(String(b.maquina)));

  const saldos = await executeSql(
    `SELECT ds.MAQ_ID, m.MAQ_CODIGO, sd.SDI_VALOR, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_MAQUINA m ON m.MAQ_ID = ds.MAQ_ID
       JOIN PAR_SALDO_DISPONIBLE sd ON sd.SDI_ID = ds.SDI_ID
      ORDER BY ds.MAQ_ID, sd.SDI_VALOR DESC`
  );
  const saldoActualPorMaquinaMap = new Map();
  saldos.forEach((r) => {
    const maq = r.MAQ_CODIGO ?? r.maq_codigo ?? `M-${r.MAQ_ID ?? r.maq_id ?? 'N/D'}`;
    if (!saldoActualPorMaquinaMap.has(maq)) {
      saldoActualPorMaquinaMap.set(maq, {
        maquina: maq,
        denominaciones: [],
      });
    }
    saldoActualPorMaquinaMap.get(maq).denominaciones.push({
      valorBillete: Number(r.SDI_VALOR ?? r.sdi_valor ?? 0),
      cantidad: Number(r.DSA_CANTIDAD ?? r.dsa_cantidad ?? 0),
      subtotal: Number(r.DSA_SUBTOTAL ?? r.dsa_subtotal ?? 0),
    });
  });
  const saldoActualPorMaquina = [...saldoActualPorMaquinaMap.values()].map((x) => ({
    ...x,
    saldoTotal: Number(x.denominaciones.reduce((s, d) => s + Number(d.subtotal || 0), 0).toFixed(2)),
  }));

  return {
    periodo: v.periodo,
    totalRecargas: detalle.length,
    totalPorMaquina,
    saldoActualPorMaquina,
    detalle,
  };
}

export async function buildAlertasPdfBuffer(data) {
  const { periodo } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const draw = (title, headers, widths, rows) => {
      const rowH = 17;
      const headH = 20;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
      doc.moveDown(0.2);
      const hy = doc.y;
      doc.rect(left, hy, fullW, headH).fill('#e2e8f0');
      let x = left;
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
      headers.forEach((h, i) => {
        doc.text(h, x + 4, hy + 6, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.strokeColor('#94a3b8').rect(left, hy, fullW, headH).stroke();
      doc.y = hy + headH;
      (rows || []).forEach((r, idx) => {
        if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(left, y, fullW, rowH).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, fullW, rowH).stroke();
        x = left;
        doc.font('Helvetica').fontSize(7.6).fillColor('#0f172a');
        r.forEach((v, i) => {
          const t = String(v ?? '—').replace(/\s+/g, ' ').trim();
          doc.text(t.length > 34 ? `${t.slice(0, 33)}…` : t, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        });
        doc.y = y + rowH;
      });
      doc.moveDown(0.55);
    };
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de alertas por máquina y tipo', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9).text(`Total de alertas: ${data.totalAlertas}`);
    doc.moveDown(0.3);
    draw(
      'Agrupación por máquina y tipo',
      ['Máquina', 'Tipo de alerta', 'Total'],
      [fullW * 0.35, fullW * 0.45, fullW * 0.2],
      data.alertasPorMaquinaTipo.map((r) => [r.maquina, r.tipoAlerta, r.total])
    );
    draw(
      'Detalle',
      ['Máquina', 'Tipo', 'Motivo', 'Fecha generación', 'Estado', 'Fecha atención'],
      [fullW * 0.15, fullW * 0.16, fullW * 0.28, fullW * 0.15, fullW * 0.12, fullW * 0.14],
      data.detalle.map((r) => [
        r.maquina,
        r.tipoAlerta,
        r.motivo,
        new Date(r.fechaGeneracion).toLocaleString('es-GT'),
        r.estadoActual,
        r.fechaAtencion ? new Date(r.fechaAtencion).toLocaleString('es-GT') : '—',
      ])
    );
    doc.end();
  });
}

export async function buildMantenimientosPdfBuffer(data) {
  const { periodo } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 17;
    const headH = 20;
    const drawTable = (title, headers, widths, rows) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
      doc.moveDown(0.2);
      const hy = doc.y;
      doc.rect(left, hy, fullW, headH).fill('#e2e8f0');
      let x = left;
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
      headers.forEach((h, i) => {
        doc.text(h, x + 4, hy + 6, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.strokeColor('#94a3b8').rect(left, hy, fullW, headH).stroke();
      doc.y = hy + headH;
      (rows || []).forEach((r, idx) => {
        if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(left, y, fullW, rowH).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, fullW, rowH).stroke();
        x = left;
        doc.font('Helvetica').fontSize(7.6).fillColor('#0f172a');
        r.forEach((v, i) => {
          const t = String(v ?? '—').replace(/\s+/g, ' ').trim();
          doc.text(t.length > 48 ? `${t.slice(0, 47)}…` : t, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        });
        doc.y = y + rowH;
      });
      doc.moveDown(0.55);
    };
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de mantenimientos por máquina', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9).text(`Total de mantenimientos: ${data.totalMantenimientos}`);
    doc.moveDown(0.3);
    drawTable(
      'Promedio de días entre mantenimientos',
      ['Máquina', 'Promedio días', 'Mantenimientos'],
      [fullW * 0.45, fullW * 0.25, fullW * 0.3],
      data.promedioDiasEntreMantenimientos.map((r) => [r.maquina, r.promedioDias == null ? 'N/D' : r.promedioDias, r.muestras])
    );
    drawTable(
      'Detalle',
      ['Máquina', 'Tipo máquina', 'Fecha mantenimiento', 'Descripción'],
      [fullW * 0.16, fullW * 0.2, fullW * 0.2, fullW * 0.44],
      data.detalle.map((r) => [r.maquina, r.tipoMaquina, new Date(r.fechaMantenimiento).toLocaleString('es-GT'), r.descripcion])
    );
    doc.end();
  });
}

export async function buildRecargasPdfBuffer(data) {
  const { periodo } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 17;
    const headH = 20;
    const drawTable = (title, headers, widths, rows) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
      doc.moveDown(0.2);
      const hy = doc.y;
      doc.rect(left, hy, fullW, headH).fill('#e2e8f0');
      let x = left;
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
      headers.forEach((h, i) => {
        doc.text(h, x + 4, hy + 6, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.strokeColor('#94a3b8').rect(left, hy, fullW, headH).stroke();
      doc.y = hy + headH;
      (rows || []).forEach((r, idx) => {
        if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(left, y, fullW, rowH).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, fullW, rowH).stroke();
        x = left;
        doc.font('Helvetica').fontSize(7.6).fillColor('#0f172a');
        r.forEach((v, i) => {
          const t = String(v ?? '—').replace(/\s+/g, ' ').trim();
          doc.text(t.length > 52 ? `${t.slice(0, 51)}…` : t, x + 4, y + 5, { width: widths[i] - 8, lineBreak: false });
          x += widths[i];
        });
        doc.y = y + rowH;
      });
      doc.moveDown(0.55);
    };
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de recargas de efectivo por máquina', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9).text(`Total de recargas: ${data.totalRecargas}`);
    doc.moveDown(0.3);
    drawTable(
      'Detalle de recargas',
      ['Máquina', 'Fecha recarga', 'Descripción'],
      [fullW * 0.2, fullW * 0.24, fullW * 0.56],
      data.detalle.map((r) => [r.maquina, new Date(r.fechaRecarga).toLocaleString('es-GT'), r.descripcion])
    );
    drawTable(
      'Saldo actual por máquina',
      ['Máquina', 'Denominación', 'Cantidad', 'Subtotal'],
      [fullW * 0.24, fullW * 0.24, fullW * 0.2, fullW * 0.32],
      data.saldoActualPorMaquina.flatMap((r) => r.denominaciones.map((d) => [
        r.maquina,
        `Q${Number(d.valorBillete || 0).toFixed(2)}`,
        d.cantidad,
        `Q${Number(d.subtotal || 0).toFixed(2)}`,
      ]))
    );
    doc.end();
  });
}
