import PDFDocument from 'pdfkit/js/pdfkit.js';
import { executeSql } from '../db/oracle.js';
import { vehiculoCatalogJoin, vehiculoCatalogSelect } from '../utils/vehiculoCatalogSql.js';

function nombreCompleto(r) {
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

function toYmd(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Membresías en estado Vencida (la fecha de vencimiento ya pasó y el cliente no ha renovado).
 * Días de mora = TRUNC(hoy) − TRUNC(vencimiento). Más de 3 días: se resalta en el reporte.
 */
export async function getClientesMoraActual() {
  const rows = await executeSql(
    `SELECT m.MEM_ID,
            v.VEH_PLACA,
            ${vehiculoCatalogSelect('v')},
            m.MEM_FECHA_VENCIMIENTO,
            (TRUNC(SYSDATE) - TRUNC(m.MEM_FECHA_VENCIMIENTO)) AS DIAS_MORA,
            tm.TME_PRECIO,
            tm.TME_TIPO,
            v.CLI_ID,
            c.CLI_PRIMER_NOMBRE,
            c.CLI_SEGUNDO_NOMBRE,
            c.CLI_PRIMER_APELLIDO,
            c.CLI_SEGUNDO_APELLIDO,
            c.CLI_CORREO,
            c.CLI_TELEFONO
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON m.EME_ID = em.EME_ID
       JOIN PAR_TIPO_MEMBRESIA tm ON m.TME_ID = tm.TME_ID
       JOIN PAR_VEHICULO v ON m.VEH_ID = v.VEH_ID
       ${vehiculoCatalogJoin('v')}
       LEFT JOIN PAR_CLIENTE c ON v.CLI_ID = c.CLI_ID
      WHERE LOWER(NVL(em.EME_ESTADO, '')) LIKE '%venc%'
        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) < TRUNC(SYSDATE)
      ORDER BY (TRUNC(SYSDATE) - TRUNC(m.MEM_FECHA_VENCIMIENTO)) DESC, m.MEM_ID DESC`
  );

  const cliIds = new Set();
  let montoTotalReferencia = 0;

  const detalle = rows.map((r) => {
    const diasMora = Number(r.DIAS_MORA ?? r.dias_mora ?? 0);
    const precio = Number(r.TME_PRECIO ?? r.tme_precio ?? 0);
    if (Number.isFinite(precio)) montoTotalReferencia += precio;
    const cliId = r.CLI_ID ?? r.cli_id;
    if (cliId != null) cliIds.add(Number(cliId));

    return {
      memId: r.MEM_ID ?? r.mem_id,
      nombreCompleto: nombreCompleto(r),
      correo: r.CLI_CORREO ?? r.cli_correo ?? '—',
      telefono: r.CLI_TELEFONO ?? r.cli_telefono ?? '—',
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      modelo: r.VEH_MODELO ?? r.veh_modelo ?? '—',
      tipoVehiculo: r.TVE_TIPO ?? r.tve_tipo ?? '—',
      tipoPlan: r.TME_TIPO ?? r.tme_tipo ?? '—',
      fechaVencimiento: toYmd(r.MEM_FECHA_VENCIMIENTO ?? r.mem_fecha_vencimiento),
      diasMora: Number.isFinite(diasMora) ? diasMora : 0,
      montoTipoReferencia: Number.isFinite(precio) ? precio : 0,
      /** Resaltado en rojo si lleva más de 3 días vencida sin renovar */
      alertaSuspension: diasMora > 3,
    };
  });

  return {
    generadoEn: new Date().toISOString(),
    totalMembresiasEnMora: detalle.length,
    totalClientesDistintos: cliIds.size,
    montoTotalReferencia: Number(montoTotalReferencia.toFixed(2)),
    detalle,
  };
}

export async function buildClientesMoraPdfBuffer(data) {
  const { totalMembresiasEnMora, totalClientesDistintos, montoTotalReferencia, detalle } = data;
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
    const widths = [fullW * 0.23, fullW * 0.17, fullW * 0.12, fullW * 0.1, fullW * 0.12, fullW * 0.1, fullW * 0.16];

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Reporte de clientes en mora', { align: 'center' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text('Estado al momento de la generación (sin filtro de fechas).', { align: 'center' });
    doc.moveDown(0.6);
    const montoSafe = Number.isFinite(Number(montoTotalReferencia)) ? Number(montoTotalReferencia) : 0;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Clientes distintos: ${totalClientesDistintos} | Membresías en mora: ${totalMembresiasEnMora} | Monto referencial: Q ${montoSafe.toFixed(2)}`);
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#64748b').text('* Resaltado en rojo: más de 3 días vencida sin renovar.');
    doc.moveDown(0.5);

    const y = doc.y;
    doc.rect(left, y, fullW, headH).fill('#e2e8f0');
    const headers = ['Nombre', 'Correo', 'Teléfono', 'Placa', 'Vencimiento', 'Días mora', 'Monto ref.'];
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
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
      const ref = Number.isFinite(Number(row.montoTipoReferencia)) ? Number(row.montoTipoReferencia).toFixed(2) : '0.00';
      const vals = [row.nombreCompleto, row.correo, row.telefono, row.placa, row.fechaVencimiento || '—', row.diasMora, `Q${ref}`];
      x = left;
      doc.font('Helvetica').fontSize(7.6).fillColor(row.alertaSuspension ? '#9a3412' : '#0f172a');
      vals.forEach((v2, i) => {
        const txt = String(v2 ?? '—');
        doc.text(txt.length > 30 ? `${txt.slice(0, 29)}…` : txt, x + 4, yy + 5, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.y = yy + rowH;
    });

    doc.end();
  });
}
