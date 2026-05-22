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

export async function searchClientesMembresia(qRaw) {
  const q = String(qRaw ?? '').trim();
  if (q.length < 2) return [];
  const needle = `%${q.toUpperCase().replace(/\s+/g, '')}%`;
  const rows = await executeSql(
    `SELECT DISTINCT c.CLI_ID,
            c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO,
            v.VEH_PLACA
       FROM PAR_CLIENTE c
       JOIN PAR_VEHICULO v ON v.CLI_ID = c.CLI_ID
      WHERE UPPER(REPLACE(TRIM(NVL(v.VEH_PLACA, ' ')), ' ', '')) LIKE :q
         OR UPPER(REPLACE(TRIM(
              NVL(c.CLI_PRIMER_NOMBRE, '') || ' ' ||
              NVL(c.CLI_SEGUNDO_NOMBRE, '') || ' ' ||
              NVL(c.CLI_PRIMER_APELLIDO, '') || ' ' ||
              NVL(c.CLI_SEGUNDO_APELLIDO, '')
            ), ' ', '')) LIKE :q
      ORDER BY c.CLI_ID DESC`,
    { q: needle }
  );
  const map = new Map();
  rows.forEach((r) => {
    const cliId = Number(r.CLI_ID ?? r.cli_id);
    if (!map.has(cliId)) {
      map.set(cliId, {
        cliId,
        nombre: nombreCompleto(r),
      });
    }
  });
  return [...map.values()].slice(0, 30);
}

export async function getHistorialPagosCliente(cliIdRaw) {
  const cliId = Number(cliIdRaw);
  if (!Number.isInteger(cliId) || cliId <= 0) {
    const err = new Error('Debe seleccionar un cliente válido.');
    err.code = 'VALIDATION';
    throw err;
  }

  const infoRows = await executeSql(
    `SELECT c.CLI_ID, c.CLI_DPI, c.CLI_CORREO, c.CLI_TELEFONO,
            c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO
       FROM PAR_CLIENTE c
      WHERE c.CLI_ID = :cliId`,
    { cliId }
  );
  if (!infoRows.length) {
    const err = new Error('Cliente no encontrado.');
    err.code = 'VALIDATION';
    throw err;
  }
  const baseInfo = infoRows[0];
  const cliente = {
    cliId,
    nombreCompleto: nombreCompleto(baseInfo),
    dpi: baseInfo.CLI_DPI ?? baseInfo.cli_dpi ?? '—',
    correo: baseInfo.CLI_CORREO ?? baseInfo.cli_correo ?? '—',
    telefono: baseInfo.CLI_TELEFONO ?? baseInfo.cli_telefono ?? '—',
  };

  const membresiaRows = await executeSql(
    `SELECT m.MEM_ID, m.MEM_FECHA_INICIO, m.MEM_FECHA_VENCIMIENTO, em.EME_ESTADO, v.VEH_PLACA
       FROM PAR_MEMBRESIA m
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       LEFT JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
      WHERE v.CLI_ID = :cliId
      ORDER BY m.MEM_FECHA_VENCIMIENTO DESC, m.MEM_ID DESC`,
    { cliId }
  );
  const membresiasActivas = membresiaRows
    .filter((r) => {
      const estado = String(r.EME_ESTADO ?? r.eme_estado ?? '').toLowerCase();
      return estado.includes('activ') && !estado.includes('inactiv');
    })
    .map((r) => ({
      memId: r.MEM_ID ?? r.mem_id,
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      fechaInicio: toYmd(r.MEM_FECHA_INICIO ?? r.mem_fecha_inicio),
      fechaVencimiento: toYmd(r.MEM_FECHA_VENCIMIENTO ?? r.mem_fecha_vencimiento),
      estado: r.EME_ESTADO ?? r.eme_estado ?? '—',
    }));
  const membActual = membresiasActivas[0] || null;

  const pagosRows = await executeSql(
    `SELECT dpm.DPM_ID, dpm.DPM_MES_CANCELADO, p.PAG_FECHA_HORA, p.PAG_MONTO_TOTAL, tp.TPA_TIPO,
            v.VEH_PLACA
       FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
       JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
       LEFT JOIN PAR_TIPO_PAGO tp ON tp.TPA_ID = p.TPA_ID
       JOIN PAR_MEMBRESIA m ON m.MEM_ID = dpm.MEM_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
      WHERE v.CLI_ID = :cliId
      ORDER BY p.PAG_FECHA_HORA DESC, dpm.DPM_ID DESC`,
    { cliId }
  );

  const historial = pagosRows.map((r) => ({
    id: r.DPM_ID ?? r.dpm_id,
    fechaPago: r.PAG_FECHA_HORA ?? r.pag_fecha_hora,
    placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
    montoPagado: Number(r.PAG_MONTO_TOTAL ?? r.pag_monto_total ?? 0),
    metodoPago: r.TPA_TIPO ?? r.tpa_tipo ?? '—',
    mesCancelado: Number(r.DPM_MES_CANCELADO ?? r.dpm_mes_cancelado ?? 0),
  }));
  const totalHistoricoPagado = Number(
    historial.reduce((s, x) => s + Number(x.montoPagado || 0), 0).toFixed(2)
  );

  return {
    cliente,
    membresiasActivas,
    totalMembresiasActivas: membresiasActivas.length,
    membresiaActual: membActual
      ? {
          fechaInicio: membActual.fechaInicio,
          fechaVencimiento: membActual.fechaVencimiento,
          estado: membActual.estado,
        }
      : null,
    historial,
    totalHistoricoPagado,
  };
}

export async function buildHistorialPagosClientePdfBuffer(data) {
  const { cliente, membresiaActual, membresiasActivas, totalMembresiasActivas, historial, totalHistoricoPagado } = data;
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(16).text('Reporte de historial de pagos por cliente', { align: 'center' });
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11).text('Datos del cliente');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Nombre: ${cliente.nombreCompleto}`);
    doc.text(`DPI: ${cliente.dpi} | Correo: ${cliente.correo} | Teléfono: ${cliente.telefono}`);
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold').fontSize(11).text('Resumen de membresías');
    doc.font('Helvetica').fontSize(9);
    if (totalMembresiasActivas <= 1) {
      doc.text(
        membresiaActual
          ? `Inicio: ${membresiaActual.fechaInicio || '—'} | Vencimiento: ${membresiaActual.fechaVencimiento || '—'} | Estado: ${membresiaActual.estado}`
          : 'Sin membresía activa registrada.'
      );
    } else {
      doc.text(`Membresías activas: ${totalMembresiasActivas}`);
      doc.moveDown(0.35);
      const left = doc.page.margins.left;
      const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const headersAct = ['ID membresía', 'Placa', 'Inicio', 'Vencimiento', 'Estado'];
      const widthsAct = [fullW * 0.18, fullW * 0.17, fullW * 0.2, fullW * 0.2, fullW * 0.25];
      const rowHAct = 17;
      const headHAct = 20;
      const yAct = doc.y;
      doc.rect(left, yAct, fullW, headHAct).fill('#e2e8f0');
      let xAct = left;
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
      headersAct.forEach((h, i) => {
        doc.text(h, xAct + 4, yAct + 6, { width: widthsAct[i] - 8, lineBreak: false });
        xAct += widthsAct[i];
      });
      doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, yAct, fullW, headHAct).stroke();
      doc.y = yAct + headHAct;
      (membresiasActivas || []).forEach((m, idx) => {
        if (doc.y + rowHAct > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const yy = doc.y;
        if (idx % 2 === 0) doc.rect(left, yy, fullW, rowHAct).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowHAct).stroke();
        const vals = [m.memId, m.placa || '—', m.fechaInicio || '—', m.fechaVencimiento || '—', m.estado || '—'];
        xAct = left;
        doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
        vals.forEach((v2, i) => {
          doc.text(String(v2 ?? '—'), xAct + 4, yy + 5, { width: widthsAct[i] - 8, lineBreak: false });
          xAct += widthsAct[i];
        });
        doc.y = yy + rowHAct;
      });
    }
    doc.moveDown(0.35);
    doc.text(`Total histórico pagado: Q${Number(totalHistoricoPagado || 0).toFixed(2)}`);
    doc.moveDown(0.45);

    const left = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const headers = ['Fecha pago', 'Placa', 'Monto', 'Método pago', 'Mes cancelado'];
    const widths = [fullW * 0.28, fullW * 0.16, fullW * 0.16, fullW * 0.22, fullW * 0.18];
    const rowH = 17;
    const headH = 20;
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
    historial.forEach((r, idx) => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const yy = doc.y;
      if (idx % 2 === 0) doc.rect(left, yy, fullW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, yy, fullW, rowH).stroke();
      const vals = [
        r.fechaPago ? new Date(r.fechaPago).toLocaleString('es-GT') : '—',
        r.placa || '—',
        `Q${Number(r.montoPagado || 0).toFixed(2)}`,
        r.metodoPago,
        r.mesCancelado || '—',
      ];
      x = left;
      doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
      vals.forEach((v2, i) => {
        doc.text(String(v2 ?? '—'), x + 4, yy + 5, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.y = yy + rowH;
    });
    doc.end();
  });
}
