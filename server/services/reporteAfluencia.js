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
    periodo: {
      desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
      hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
    },
  };
}

function validateAnios(inicio, fin) {
  const ai = Number(inicio);
  const af = Number(fin);
  if (!Number.isInteger(ai) || !Number.isInteger(af)) return { error: 'Años inválidos.' };
  if (ai > af) return { error: 'Año inicio no puede ser mayor a año fin.' };
  if (af - ai > 10) return { error: 'Rango máximo: 10 años.' };
  return { ai, af };
}

const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

async function fetchEntradasPorRango(periodo) {
  const [tickets, membresias] = await Promise.all([
    executeSql(
      `SELECT t.TIC_FECHA_HORA_ENTRADA AS FECHA
         FROM PAR_TICKET t
        WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
          AND t.TIC_FECHA_HORA_ENTRADA IS NOT NULL`,
      periodo
    ),
    executeSql(
      `SELECT r.RMM_FECHA_HORA_ENTRADA AS FECHA
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
        WHERE TRUNC(r.RMM_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
          AND r.RMM_FECHA_HORA_ENTRADA IS NOT NULL`,
      periodo
    ),
  ]);
  return [
    ...tickets.map((r) => ({ tipo: 'Esporádico', fecha: new Date(r.FECHA ?? r.fecha) })),
    ...membresias.map((r) => ({ tipo: 'Membresía', fecha: new Date(r.FECHA ?? r.fecha) })),
  ].filter((x) => x.fecha && !Number.isNaN(x.fecha.getTime()));
}

function keyFor(dt, agrupacion) {
  if (agrupacion === 'hora') return String(dt.getHours()).padStart(2, '0');
  if (agrupacion === 'dia_semana') return String(dt.getDay());
  if (agrupacion === 'semana') {
    const firstJan = new Date(dt.getFullYear(), 0, 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const week = Math.ceil((((dt - firstJan) / dayMs) + firstJan.getDay() + 1) / 7);
    return `${dt.getFullYear()}-S${String(week).padStart(2, '0')}`;
  }
  if (agrupacion === 'mes') return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function labelFor(key, agrupacion) {
  if (agrupacion === 'hora') return `${key}:00`;
  if (agrupacion === 'dia_semana') return dias[Number(key)] || key;
  if (agrupacion === 'mes') {
    const [y, m] = key.split('-');
    return `${meses[Math.max(0, Number(m) - 1)] || key} ${y}`;
  }
  return key;
}

function sortKeys(keys, agrupacion) {
  const arr = [...keys];
  if (agrupacion === 'hora') return arr.sort((a, b) => Number(a) - Number(b));
  if (agrupacion === 'dia_semana') return arr.sort((a, b) => Number(a) - Number(b));
  return arr.sort();
}

export async function getAfluenciaDetallada({ desde, hasta, agrupacion }) {
  const v = validateRango(desde, hasta);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const agr = ['hora', 'dia_semana', 'semana', 'mes'].includes(agrupacion) ? agrupacion : 'hora';
  const entradas = await fetchEntradasPorRango(v.periodo);
  const map = new Map();
  entradas.forEach((e) => {
    const k = keyFor(e.fecha, agr);
    if (!map.has(k)) map.set(k, { esporadico: 0, membresia: 0 });
    const row = map.get(k);
    if (e.tipo === 'Esporádico') row.esporadico += 1;
    else row.membresia += 1;
  });
  const keys = sortKeys(map.keys(), agr);
  const detalle = keys.map((k) => {
    const row = map.get(k);
    const total = row.esporadico + row.membresia;
    return {
      periodoClave: k,
      periodoLabel: labelFor(k, agr),
      esporadico: row.esporadico,
      membresia: row.membresia,
      total,
    };
  });
  const top = detalle.reduce((m, r) => (r.total > (m?.total || 0) ? r : m), null);
  return {
    periodo: v.periodo,
    agrupacion: agr,
    totalIngresos: detalle.reduce((s, r) => s + r.total, 0),
    periodoMayorAfluencia: top ? { periodo: top.periodoLabel, total: top.total } : null,
    detalle,
  };
}

function calcTop(entries, selectorKey, selectorLabel) {
  const map = new Map();
  entries.forEach((e) => {
    const key = selectorKey(e.fecha);
    const lbl = selectorLabel(e.fecha, key);
    if (!map.has(key)) map.set(key, { label: lbl, esporadico: 0, membresia: 0 });
    const r = map.get(key);
    if (e.tipo === 'Esporádico') r.esporadico += 1;
    else r.membresia += 1;
  });
  let best = null;
  for (const [, r] of map.entries()) {
    const total = r.esporadico + r.membresia;
    if (!best || total > best.total) best = { label: r.label, total, esporadico: r.esporadico, membresia: r.membresia };
  }
  return best;
}

export async function getAfluenciaAnualResumen({ anioInicio, anioFin }) {
  const v = validateAnios(anioInicio, anioFin);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const periodo = { desde: `${v.ai}-01-01`, hasta: `${v.af}-12-31` };
  const entries = await fetchEntradasPorRango(periodo);
  const byYear = new Map();
  entries.forEach((e) => {
    const y = String(e.fecha.getFullYear());
    if (!byYear.has(y)) byYear.set(y, { esporadico: 0, membresia: 0 });
    const r = byYear.get(y);
    if (e.tipo === 'Esporádico') r.esporadico += 1;
    else r.membresia += 1;
  });
  const detalleAnual = [...byYear.keys()].sort().map((y) => {
    const r = byYear.get(y);
    return { anio: y, esporadico: r.esporadico, membresia: r.membresia, total: r.esporadico + r.membresia };
  });
  const anioTop = detalleAnual.reduce((m, r) => (r.total > (m?.total || 0) ? r : m), null);

  const topHora = calcTop(entries, (d) => d.getHours(), (d, k) => `${String(k).padStart(2, '0')}:00`);
  const topDia = calcTop(entries, (d) => d.getDay(), (d, k) => dias[k] || String(k));
  const topSemana = calcTop(entries, (d) => {
    const firstJan = new Date(d.getFullYear(), 0, 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const w = Math.ceil((((d - firstJan) / dayMs) + firstJan.getDay() + 1) / 7);
    return `${d.getFullYear()}-S${String(w).padStart(2, '0')}`;
  }, (d, k) => k);
  const topMes = calcTop(entries, (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, (d) => `${meses[d.getMonth()]} ${d.getFullYear()}`);

  const uniqueDays = new Set(entries.map((e) => `${e.fecha.getFullYear()}-${e.fecha.getMonth()}-${e.fecha.getDate()}`)).size;
  const totalIngresos = entries.length;
  const totalEsp = entries.filter((e) => e.tipo === 'Esporádico').length;
  const totalMem = entries.filter((e) => e.tipo === 'Membresía').length;

  return {
    periodo: { anioInicio: v.ai, anioFin: v.af },
    totalIngresos,
    detalleAnual,
    anioMayorAfluencia: anioTop ? { anio: anioTop.anio, total: anioTop.total, esporadico: anioTop.esporadico, membresia: anioTop.membresia } : null,
    resumenEjecutivo: {
      horaPico: topHora,
      diaMasFrecuentado: topDia,
      semanaMayorAfluencia: topSemana,
      mesMayorAfluencia: topMes,
      anioMayorAfluencia: anioTop ? { label: anioTop.anio, total: anioTop.total, esporadico: anioTop.esporadico, membresia: anioTop.membresia } : null,
      promedioDiarioVehiculos: uniqueDays > 0 ? Number((totalIngresos / uniqueDays).toFixed(2)) : 0,
      promedioDiarioEsporadico: uniqueDays > 0 ? Number((totalEsp / uniqueDays).toFixed(2)) : 0,
      promedioDiarioMembresia: uniqueDays > 0 ? Number((totalMem / uniqueDays).toFixed(2)) : 0,
      totalIngresos,
      totalEsporadico: totalEsp,
      totalMembresia: totalMem,
    },
  };
}

function drawTable(doc, title, headers, widths, rows) {
  const left = doc.page.margins.left;
  const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowH = 17;
  const headH = 20;
  doc.font('Helvetica-Bold').fontSize(10.6).fillColor('#0f172a').text(title, left, doc.y, { width: fullW });
  doc.moveDown(0.2);
  const y = doc.y;
  doc.rect(left, y, fullW, headH).fill('#e2e8f0');
  let x = left;
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 6, { width: widths[i] - 8, lineBreak: false });
    x += widths[i];
  });
  doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
  doc.y = y + headH;
  (rows || []).forEach((r, idx) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const yy = doc.y;
    if (idx % 2 === 0) doc.rect(left, yy, fullW, rowH).fill('#f8fafc');
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowH).stroke();
    x = left;
    doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
    r.forEach((v, i) => {
      doc.text(String(v ?? '—'), x + 4, yy + 5, { width: widths[i] - 8, lineBreak: false });
      x += widths[i];
    });
    doc.y = yy + rowH;
  });
  doc.moveDown(0.55);
}

export async function buildAfluenciaDetalladaPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de afluencia detallado', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Período: ${data.periodo.desde} al ${data.periodo.hasta} | Agrupación: ${data.agrupacion}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(9).text(`Total ingresos: ${data.totalIngresos} | Mayor afluencia: ${data.periodoMayorAfluencia?.periodo || '—'} (${data.periodoMayorAfluencia?.total || 0})`);
    doc.moveDown(0.35);
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawTable(doc, 'Detalle de afluencia', ['Período', 'Esporádico', 'Membresía', 'Total'], [fullW * 0.46, fullW * 0.18, fullW * 0.18, fullW * 0.18], data.detalle.map((r) => [r.periodoLabel, r.esporadico, r.membresia, r.total]));
    doc.end();
  });
}

export async function buildAfluenciaAnualPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de afluencia anual y resumen ejecutivo', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text(`Años: ${data.periodo.anioInicio} a ${data.periodo.anioFin}`, { align: 'center' });
    doc.moveDown(0.4);
    const r = data.resumenEjecutivo;
    drawTable(
      doc,
      'Resumen ejecutivo',
      ['Indicador', 'Período', 'Esporádico', 'Membresía', 'Total'],
      [220, 180, 110, 110, 110],
      [
        ['Hora pico', r.horaPico?.label || '—', r.horaPico?.esporadico || 0, r.horaPico?.membresia || 0, r.horaPico?.total || 0],
        ['Día más frecuentado', r.diaMasFrecuentado?.label || '—', r.diaMasFrecuentado?.esporadico || 0, r.diaMasFrecuentado?.membresia || 0, r.diaMasFrecuentado?.total || 0],
        ['Semana con mayor afluencia', r.semanaMayorAfluencia?.label || '—', r.semanaMayorAfluencia?.esporadico || 0, r.semanaMayorAfluencia?.membresia || 0, r.semanaMayorAfluencia?.total || 0],
        ['Mes con mayor afluencia', r.mesMayorAfluencia?.label || '—', r.mesMayorAfluencia?.esporadico || 0, r.mesMayorAfluencia?.membresia || 0, r.mesMayorAfluencia?.total || 0],
        ['Año con mayor afluencia', r.anioMayorAfluencia?.label || '—', r.anioMayorAfluencia?.esporadico || 0, r.anioMayorAfluencia?.membresia || 0, r.anioMayorAfluencia?.total || 0],
        ['Promedio diario', '—', r.promedioDiarioEsporadico || 0, r.promedioDiarioMembresia || 0, r.promedioDiarioVehiculos || 0],
        ['Total ingresos', 'Período completo', r.totalEsporadico || 0, r.totalMembresia || 0, r.totalIngresos || 0],
      ]
    );
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawTable(doc, 'Detalle anual', ['Año', 'Esporádico', 'Membresía', 'Total'], [fullW * 0.3, fullW * 0.23, fullW * 0.23, fullW * 0.24], data.detalleAnual.map((x) => [x.anio, x.esporadico, x.membresia, x.total]));
    doc.end();
  });
}
