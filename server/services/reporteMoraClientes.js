import PDFDocument from 'pdfkit/js/pdfkit.js';
import { executeSql } from '../db/oracle.js';

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
 * Membresías activas con vencimiento estrictamente anterior a hoy (mora).
 * Días de mora = TRUNC(hoy) − TRUNC(vencimiento), alineado al job de suspensión (>3 días ⇒ riesgo).
 */
export async function getClientesMoraActual() {
  const rows = await executeSql(
    `SELECT m.MEM_ID,
            v.VEH_PLACA,
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
       LEFT JOIN PAR_CLIENTE c ON v.CLI_ID = c.CLI_ID
      WHERE TRUNC(m.MEM_FECHA_VENCIMIENTO) < TRUNC(SYSDATE)
        AND LOWER(NVL(em.EME_ESTADO, '')) LIKE '%activ%'
        AND LOWER(NVL(em.EME_ESTADO, '')) NOT LIKE '%inactiv%'
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
      tipoPlan: r.TME_TIPO ?? r.tme_tipo ?? '—',
      fechaVencimiento: toYmd(r.MEM_FECHA_VENCIMIENTO ?? r.mem_fecha_vencimiento),
      diasMora: Number.isFinite(diasMora) ? diasMora : 0,
      montoTipoReferencia: Number.isFinite(precio) ? precio : 0,
      /** Misma regla que el job automático: TRUNC(hoy) > TRUNC(venc) + 3 */
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

    doc.fontSize(16).text('Reporte de clientes en mora', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text('Estado al momento de la generación (sin filtro de fechas).', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11).text('Resumen', { underline: true });
    doc.fontSize(10);
    doc.text(`Clientes distintos en mora: ${totalClientesDistintos}`);
    doc.text(`Membresías vencidas en mora (activas): ${totalMembresiasEnMora}`);
    const montoSafe = Number.isFinite(Number(montoTotalReferencia)) ? Number(montoTotalReferencia) : 0;
    doc.text(`Monto total referencial (suma de precios de tipo de plan): Q ${montoSafe.toFixed(2)}`);
    doc.moveDown(0.75);
    doc.fontSize(8).text(
      '* Filas marcadas: más de 3 días de mora (criterio de suspensión automática si no hay pago registrado).',
      { width: 500 }
    );
    doc.moveDown(1);

    doc.fontSize(11).text('Detalle', { underline: true });
    doc.fontSize(7.5);
    detalle.forEach((row) => {
      const tag = row.alertaSuspension ? '[RIESGO SUSPENSIÓN] ' : '';
      const ref = Number.isFinite(Number(row.montoTipoReferencia))
        ? Number(row.montoTipoReferencia).toFixed(2)
        : '0.00';
      doc.text(
        `${tag}${row.nombreCompleto} | ${row.correo} | ${row.telefono} | ${row.placa} | Vence: ${row.fechaVencimiento ?? '—'} | Mora: ${row.diasMora} d | Ref. Q${ref}`
      );
    });

    doc.end();
  });
}
