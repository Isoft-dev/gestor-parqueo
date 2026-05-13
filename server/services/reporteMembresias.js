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
  return { desde, hasta, span };
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Agrupa para KPI según texto de PAR_ESTADO_MEMBRESIA.EME_ESTADO */
function bucketEstadoKpi(emeEstado) {
  const s = norm(emeEstado);
  if (s.includes('venc')) return 'vencidas';
  if (s.includes('suspend')) return 'suspendidas';
  if (s.includes('inactiv')) return 'otros';
  if (s.includes('activ')) return 'activas';
  return 'otros';
}

function colorForEstadoPie(emeEstado, idx) {
  const b = bucketEstadoKpi(emeEstado);
  if (b === 'activas') return '#16a34a';
  if (b === 'suspendidas') return '#ea580c';
  if (b === 'vencidas') return '#64748b';
  const alt = ['#8b5cf6', '#0891b2', '#db2777', '#ca8a04'];
  return alt[idx % alt.length];
}

function toYmd(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nombreCliente(r) {
  const parts = [
    r.CLI_PRIMER_NOMBRE ?? r.cli_primer_nombre,
    r.CLI_SEGUNDO_NOMBRE ?? r.cli_segundo_nombre,
    r.CLI_PRIMER_APELLIDO ?? r.cli_primer_apellido,
    r.CLI_SEGUNDO_APELLIDO ?? r.cli_segundo_apellido,
  ]
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function espacioEtiqueta(r) {
  const cod = r.ESP_CODIGO ?? r.esp_codigo ?? '';
  const ubi = r.ESP_UBICACION ?? r.esp_ubicacion ?? '';
  const c = String(cod).trim();
  const u = String(ubi).trim();
  if (c && u) return `${c} · ${u}`;
  if (c) return c;
  if (u) return u;
  return '—';
}

/**
 * Membresías cuya vigencia intersecta el rango [desde, hasta] (inicio ≤ fin del rango y vencimiento ≥ inicio del rango).
 */
export async function getMembresiasPorEstadoRango(desdeStr, hastaStr) {
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
    `SELECT m.MEM_ID,
            m.MEM_FECHA_INICIO,
            m.MEM_FECHA_VENCIMIENTO,
            m.EME_ID,
            em.EME_ESTADO,
            v.VEH_PLACA,
            e.ESP_CODIGO,
            e.ESP_UBICACION,
            c.CLI_PRIMER_NOMBRE,
            c.CLI_SEGUNDO_NOMBRE,
            c.CLI_PRIMER_APELLIDO,
            c.CLI_SEGUNDO_APELLIDO
       FROM PAR_MEMBRESIA m
       LEFT JOIN PAR_ESTADO_MEMBRESIA em ON m.EME_ID = em.EME_ID
       JOIN PAR_VEHICULO v ON m.VEH_ID = v.VEH_ID
       JOIN PAR_ESPACIO e ON m.ESP_ID = e.ESP_ID
       LEFT JOIN PAR_CLIENTE c ON v.CLI_ID = c.CLI_ID
      WHERE TRUNC(m.MEM_FECHA_INICIO) <= TO_DATE(:hasta, 'YYYY-MM-DD')
        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) >= TO_DATE(:desde, 'YYYY-MM-DD')
      ORDER BY m.MEM_FECHA_VENCIMIENTO DESC, m.MEM_ID`,
    binds
  );

  const detalle = rows.map((r) => {
    const emeId = r.EME_ID ?? r.eme_id;
    const estadoRaw = r.EME_ESTADO ?? r.eme_estado;
    const estadoActual = estadoRaw != null && String(estadoRaw).trim() !== '' ? String(estadoRaw).trim() : 'Sin estado';
    return {
      memId: r.MEM_ID ?? r.mem_id,
      clienteNombre: nombreCliente(r),
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      espacioAsignado: espacioEtiqueta(r),
      fechaInicio: toYmd(r.MEM_FECHA_INICIO ?? r.mem_fecha_inicio),
      fechaVencimiento: toYmd(r.MEM_FECHA_VENCIMIENTO ?? r.mem_fecha_vencimiento),
      estadoActual,
      emeId: emeId != null ? Number(emeId) : null,
    };
  });

  const byEstado = new Map();
  for (const row of detalle) {
    const key = row.estadoActual;
    byEstado.set(key, (byEstado.get(key) || 0) + 1);
  }

  const porEstadoArr = [...byEstado.entries()]
    .map(([estadoTexto, cantidad]) => ({ estadoTexto, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const porEstado = porEstadoArr.map((p, idx) => ({
    estadoTexto: p.estadoTexto,
    cantidad: p.cantidad,
    porcentaje:
      detalle.length > 0 ? Number(((p.cantidad / detalle.length) * 100).toFixed(1)) : 0,
    color: colorForEstadoPie(p.estadoTexto, idx),
  }));

  let activas = 0;
  let suspendidas = 0;
  let vencidas = 0;
  let otros = 0;
  for (const row of detalle) {
    const b = bucketEstadoKpi(row.estadoActual);
    if (b === 'activas') activas += 1;
    else if (b === 'suspendidas') suspendidas += 1;
    else if (b === 'vencidas') vencidas += 1;
    else otros += 1;
  }

  return {
    periodo: { desde: binds.desde, hasta: binds.hasta },
    criterioVigencia:
      'Se incluyen membresías cuya vigencia (inicio–vencimiento) intersecta el rango de fechas seleccionado.',
    totalRegistros: detalle.length,
    resumen: { activas, suspendidas, vencidas, otros },
    porEstado,
    detalle,
  };
}

export async function buildMembresiasEstadoPdfBuffer(data) {
  const { periodo, criterioVigencia, totalRegistros, resumen, porEstado, detalle } = data;
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
    const w1 = [fullW * 0.3, fullW * 0.14, fullW * 0.2, fullW * 0.12, fullW * 0.12, fullW * 0.12];

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de membresías por estado', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.font('Helvetica').fontSize(8.2).fillColor('#475569').text(criterioVigencia, { align: 'center' });
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Membresías: ${totalRegistros} | Activas: ${resumen.activas} | Suspendidas: ${resumen.suspendidas} | Vencidas: ${resumen.vencidas}${resumen.otros > 0 ? ` | Otros: ${resumen.otros}` : ''}`);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(10).text('Proporción por estado');
    doc.font('Helvetica').fontSize(9);
    (porEstado.length ? porEstado : [{ estadoTexto: 'Sin datos', cantidad: 0, porcentaje: 0 }]).forEach((p) => {
      doc.text(`${p.estadoTexto}: ${p.cantidad} (${p.porcentaje}%)`);
    });
    doc.moveDown(0.5);

    const y = doc.y;
    doc.rect(left, y, fullW, headH).fill('#e2e8f0');
    const headers = ['Cliente', 'Placa', 'Espacio', 'Inicio', 'Vencimiento', 'Estado'];
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.3).fillColor('#0f172a');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 6, { width: w1[i] - 8, lineBreak: false });
      x += w1[i];
    });
    doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, fullW, headH).stroke();
    doc.y = y + headH;

    (detalle || []).forEach((row, idx) => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      if (idx % 2 === 0) doc.rect(left, yy, fullW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowH).stroke();
      const vals = [row.clienteNombre, row.placa, row.espacioAsignado, row.fechaInicio || '—', row.fechaVencimiento || '—', row.estadoActual];
      x = left;
      doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
      vals.forEach((v2, i) => {
        const txt = String(v2 ?? '—');
        doc.text(txt.length > 30 ? `${txt.slice(0, 29)}…` : txt, x + 4, yy + 5, { width: w1[i] - 8, lineBreak: false });
        x += w1[i];
      });
      doc.y = yy + rowH;
    });

    doc.end();
  });
}
