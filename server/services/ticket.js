import oracledb from 'oracledb';
import PDFDocument from 'pdfkit';
import { executeCursor, executeProcedure, executeSql, getConnection } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function getByCodigo(codigo) {
  const rows = await executeSql(
    `SELECT t.TIC_ID, t.TIC_CODIGO,
            t.VEH_ID, v.VEH_PLACA, v.VEH_MODELO, v.VEH_COLOR,
            t.TIC_FECHA_HORA_ENTRADA, t.TIC_FECHA_HORA_SALIDA,
            t.ETI_ID, e.ETI_ESTADO,
            t.COB_ID
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON t.VEH_ID = v.VEH_ID
       JOIN PAR_ESTADO_TICKET e ON t.ETI_ID = e.ETI_ID
      WHERE UPPER(TRIM(t.TIC_CODIGO)) = UPPER(TRIM(:codigo))
      ORDER BY t.TIC_ID DESC`,
    { codigo: String(codigo || '') }
  );
  return rows[0] || null;
}

async function getTarifaVigente() {
  const hasGraciaCol = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME='PAR_TARIFA' AND COLUMN_NAME='TAR_TIEMPO_GRACIA'`
  );
  const withGrace = Number(hasGraciaCol[0]?.TOTAL || 0) > 0;
  const rows = await executeSql(
    withGrace
      ? `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
           FROM PAR_TARIFA
          ORDER BY TAR_ID DESC`
      : `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO
           FROM PAR_TARIFA
          ORDER BY TAR_ID DESC`
  );
  return rows[0] || null;
}

async function getTarifaVigenteTx(conn) {
  const hasGraciaCol = await conn.execute(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME='PAR_TARIFA' AND COLUMN_NAME='TAR_TIEMPO_GRACIA'`
  );
  const withGrace = Number(hasGraciaCol.rows?.[0]?.TOTAL || 0) > 0;
  const rows = await conn.execute(
    withGrace
      ? `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
           FROM PAR_TARIFA
          ORDER BY TAR_ID DESC`
      : `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO
           FROM PAR_TARIFA
          ORDER BY TAR_ID DESC`
  );
  return rows.rows?.[0] || null;
}

export async function quoteByCodigo(codigo) {
  const ticket = await getByCodigo(codigo);
  if (!ticket) throw new Error('Ticket no reconocido');
  if (ticket.COB_ID != null && String(ticket.COB_ID).trim() !== '') {
    throw new Error('Ticket ya saldado');
  }

  const tarifa = await getTarifaVigente();
  if (!tarifa) throw new Error('No hay tarifa vigente configurada');

  const entrada = new Date(ticket.TIC_FECHA_HORA_ENTRADA);
  if (Number.isNaN(entrada.getTime())) throw new Error('Ticket con fecha de entrada inválida');

  const ahora = new Date();
  const mins = Math.max(0, (ahora.getTime() - entrada.getTime()) / (1000 * 60));
  const gracia = Math.max(0, Number(tarifa.TAR_TIEMPO_GRACIA ?? 0));
  const minsFacturables = Math.max(0, mins - gracia);
  const horas = minsFacturables / 60;
  const horasRedondeadas = Math.ceil(horas);
  const precio = Number(tarifa.TAR_PRECIO || 0);
  const monto = Number((horasRedondeadas * precio).toFixed(2));

  return {
    ticket: {
      TIC_ID: ticket.TIC_ID,
      TIC_CODIGO: ticket.TIC_CODIGO,
      VEH_PLACA: ticket.VEH_PLACA,
      TIC_FECHA_HORA_ENTRADA: ticket.TIC_FECHA_HORA_ENTRADA,
    },
    tarifa: {
      TAR_ID: tarifa.TAR_ID,
      TAR_TIPO: tarifa.TAR_TIPO,
      TAR_PRECIO: precio,
      TAR_TIEMPO_GRACIA: Number(tarifa.TAR_TIEMPO_GRACIA ?? 0),
    },
    estadia: {
      minutosTotales: Math.round(mins),
      minutosFacturables: Math.round(minsFacturables),
      horasFacturables: Number(horas.toFixed(2)),
      horasCobradas: horasRedondeadas,
    },
    montoTotal: monto,
    calculadoEn: ahora.toISOString(),
  };
}

function normalizeCobNit(inputNit, useCf) {
  if (useCf) return 'CF';
  const nit = String(inputNit || '').trim();
  if (!nit) throw new Error('Debes ingresar NIT o seleccionar CF');
  return nit;
}

async function hasCobNitColumnTx(conn) {
  const r = await conn.execute(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME='PAR_COBRO' AND COLUMN_NAME='COB_NIT'`
  );
  return Number(r.rows?.[0]?.TOTAL || 0) > 0;
}

async function cobroIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_COBRO' AND COLUMN_NAME='COB_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function detalleMaquinaTicketIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_MAQUINA_TICKET' AND COLUMN_NAME='DMT_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function findEstadoPagadoIdTx(conn, fallback) {
  const r = await conn.execute(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%pagad%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? fallback ?? null;
}

function buildPdfBuffer({ ticket, cobro }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Comprobante de pago', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11);
    doc.text(`Ticket: ${ticket.TIC_CODIGO} (ID ${ticket.TIC_ID})`);
    doc.text(`Vehiculo: ${ticket.VEH_PLACA || 'N/D'}`);
    doc.text(`Hora entrada: ${new Date(ticket.TIC_FECHA_HORA_ENTRADA).toLocaleString('es-GT')}`);
    doc.text(`Hora pago: ${new Date(cobro.COB_FECHA_HORA).toLocaleString('es-GT')}`);
    doc.text(`Tiempo estadia (horas): ${cobro.COB_HORAS_TOTALES}`);
    doc.text(`Monto cobrado: Q${Number(cobro.COB_MONTO_TOTAL || 0).toFixed(2)}`);
    doc.text(`Monto recibido: Q${Number(cobro.COB_MONTO_RECIBIDO || 0).toFixed(2)}`);
    doc.text(`Vuelto: Q${Number(cobro.COB_VUELTO || 0).toFixed(2)}`);
    doc.text(`NIT/CF: ${cobro.COB_NIT || 'N/D'}`);
    doc.text(`Tipo cobro (TCO_ID): ${cobro.TCO_ID}`);
    doc.moveDown(1);
    doc.text('Gracias por su visita.', { align: 'center' });
    doc.end();
  });
}

export async function checkoutByCodigo({ TIC_CODIGO, TCO_ID, COB_NIT, USE_CF, COB_MONTO_RECIBIDO, MAQ_ID }) {
  const codigo = String(TIC_CODIGO || '').trim();
  if (!codigo) throw new Error('TIC_CODIGO es requerido');
  if (!TCO_ID) throw new Error('Debes seleccionar un tipo de cobro');
  if (!MAQ_ID) throw new Error('MAQ_ID es requerido para registrar el cobro');
  const cobNit = normalizeCobNit(COB_NIT, !!USE_CF);

  let conn;
  try {
    conn = await getConnection();
    const hasNit = await hasCobNitColumnTx(conn);
    if (!hasNit) {
      throw new Error('Falta la columna COB_NIT en PAR_COBRO. Esta HU requiere persistir NIT/CF.');
    }

    const tRes = await conn.execute(
      `SELECT t.TIC_ID, t.TIC_CODIGO, t.TIC_FECHA_HORA_ENTRADA, t.COB_ID
         FROM PAR_TICKET t
        WHERE UPPER(TRIM(t.TIC_CODIGO)) = UPPER(TRIM(:codigo))
        FOR UPDATE`,
      { codigo }
    );
    const ticket = tRes.rows?.[0];
    if (!ticket) throw new Error('Ticket no reconocido');
    if (ticket.COB_ID != null && String(ticket.COB_ID).trim() !== '') throw new Error('Ticket ya saldado');

    const tipoCobro = await conn.execute(
      `SELECT TCO_ID FROM PAR_TIPO_COBRO WHERE TCO_ID = :id`,
      { id: TCO_ID }
    );
    if (!tipoCobro.rows?.length) throw new Error('Tipo de cobro no válido');

    const tarifa = await getTarifaVigenteTx(conn);
    if (!tarifa) throw new Error('No hay tarifa vigente configurada');

    const entrada = new Date(ticket.TIC_FECHA_HORA_ENTRADA);
    if (Number.isNaN(entrada.getTime())) throw new Error('Ticket con fecha de entrada inválida');

    const ahora = new Date();
    const mins = Math.max(0, (ahora.getTime() - entrada.getTime()) / (1000 * 60));
    const gracia = Math.max(0, Number(tarifa.TAR_TIEMPO_GRACIA ?? 0));
    const minsFacturables = Math.max(0, mins - gracia);
    const horas = minsFacturables / 60;
    const horasCobradas = Math.ceil(horas);
    const precio = Number(tarifa.TAR_PRECIO || 0);
    const monto = Number((horasCobradas * precio).toFixed(2));
    const montoRecibido = Number(COB_MONTO_RECIBIDO);
    if (!Number.isFinite(montoRecibido) || montoRecibido < monto) {
      throw new Error('El monto recibido debe ser mayor o igual al monto total');
    }
    const vuelto = Number((montoRecibido - monto).toFixed(2));

    let cobId;
    if (await cobroIdentityAlwaysTx(conn)) {
      const ins = await conn.execute(
        `INSERT INTO PAR_COBRO
          (COB_HORAS_TOTALES, TCO_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO,
           COB_FECHA_HORA, COB_PROCESADO_MAQUINA, TAR_ID, COB_NIT)
         VALUES
          (:COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL, :COB_MONTO_RECIBIDO, :COB_VUELTO,
           :COB_FECHA_HORA, :COB_PROCESADO_MAQUINA, :TAR_ID, :COB_NIT)
         RETURNING COB_ID INTO :COB_ID_OUT`,
        {
          COB_HORAS_TOTALES: Number(horas.toFixed(2)),
          TCO_ID,
          COB_MONTO_TOTAL: monto,
          COB_MONTO_RECIBIDO: montoRecibido,
          COB_VUELTO: vuelto,
          COB_FECHA_HORA: ahora,
          COB_PROCESADO_MAQUINA: 1,
          TAR_ID: tarifa.TAR_ID,
          COB_NIT: cobNit,
          COB_ID_OUT: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      cobId = ins.outBinds?.COB_ID_OUT?.[0];
    } else {
      const next = await conn.execute(`SELECT NVL(MAX(COB_ID), 0) + 1 AS NEXT_ID FROM PAR_COBRO`);
      cobId = Number(next.rows?.[0]?.NEXT_ID || 1);
      await conn.execute(
        `INSERT INTO PAR_COBRO
          (COB_ID, COB_HORAS_TOTALES, TCO_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO,
           COB_FECHA_HORA, COB_PROCESADO_MAQUINA, TAR_ID, COB_NIT)
         VALUES
          (:COB_ID, :COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL, :COB_MONTO_RECIBIDO, :COB_VUELTO,
           :COB_FECHA_HORA, :COB_PROCESADO_MAQUINA, :TAR_ID, :COB_NIT)`,
        {
          COB_ID: cobId,
          COB_HORAS_TOTALES: Number(horas.toFixed(2)),
          TCO_ID,
          COB_MONTO_TOTAL: monto,
          COB_MONTO_RECIBIDO: montoRecibido,
          COB_VUELTO: vuelto,
          COB_FECHA_HORA: ahora,
          COB_PROCESADO_MAQUINA: 1,
          TAR_ID: tarifa.TAR_ID,
          COB_NIT: cobNit,
        }
      );
    }

    const etiPagadoId = await findEstadoPagadoIdTx(conn, ticket.ETI_ID);
    await conn.execute(
      `UPDATE PAR_TICKET
          SET COB_ID = :cobId,
              ETI_ID = :etiId
        WHERE TIC_ID = :ticId`,
      { cobId, etiId: etiPagadoId, ticId: ticket.TIC_ID }
    );

    const dmtIdentity = await detalleMaquinaTicketIdentityAlwaysTx(conn);
    if (dmtIdentity) {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:transaccion, :ticId, :maqId, :fecha)`,
        {
          transaccion: 'PROCESAMIENTO_COBRO',
          ticId: ticket.TIC_ID,
          maqId: MAQ_ID,
          fecha: ahora,
        }
      );
    } else {
      const nxt = await conn.execute(`SELECT NVL(MAX(DMT_ID), 0) + 1 AS NEXT_ID FROM PAR_DETALLE_MAQUINA_TICKET`);
      const dmtId = Number(nxt.rows?.[0]?.NEXT_ID || 1);
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_ID, DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:id, :transaccion, :ticId, :maqId, :fecha)`,
        {
          id: dmtId,
          transaccion: 'PROCESAMIENTO_COBRO',
          ticId: ticket.TIC_ID,
          maqId: MAQ_ID,
          fecha: ahora,
        }
      );
    }
    await conn.commit();

    return {
      TIC_ID: ticket.TIC_ID,
      TIC_CODIGO: ticket.TIC_CODIGO,
      COB_ID: cobId,
      TCO_ID,
      COB_NIT: cobNit,
      montoTotal: monto,
      horasCobradas,
      COB_MONTO_RECIBIDO: montoRecibido,
      COB_VUELTO: vuelto,
      MAQ_ID,
    };
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

export async function getReceiptDataByTicketId(ticketId) {
  const rows = await executeSql(
    `SELECT t.TIC_ID, t.TIC_CODIGO, t.TIC_FECHA_HORA_ENTRADA,
            v.VEH_PLACA,
            c.COB_ID, c.COB_HORAS_TOTALES, c.COB_MONTO_TOTAL, c.COB_MONTO_RECIBIDO, c.COB_VUELTO,
            c.COB_FECHA_HORA, c.COB_NIT, c.TCO_ID
       FROM PAR_TICKET t
       LEFT JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
       JOIN PAR_COBRO c ON c.COB_ID = t.COB_ID
      WHERE t.TIC_ID = :ticketId`,
    { ticketId }
  );
  return rows[0] || null;
}

export async function generateReceiptPdfByTicketId(ticketId) {
  const row = await getReceiptDataByTicketId(ticketId);
  if (!row) throw new Error('No se encontró comprobante para el ticket');
  const pdfBuffer = await buildPdfBuffer({
    ticket: row,
    cobro: row,
  });
  return {
    pdfBuffer,
    fileName: `comprobante-ticket-${row.TIC_ID}.pdf`,
  };
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TICKET' AND COLUMN_NAME='TIC_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.TIC_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TICKET
        (TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID, COB_ID)
       VALUES
        (:TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID)`,
      {
        TIC_CODIGO: data.TIC_CODIGO ?? null,
        VEH_ID: data.VEH_ID ?? null,
        TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
        TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
        ETI_ID: data.ETI_ID ?? null,
        COB_ID: data.COB_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TIC_ID FROM PAR_TICKET
        WHERE TIC_CODIGO = :codigo
        ORDER BY TIC_ID DESC`,
      { codigo: data.TIC_CODIGO ?? null }
    );
    return rows[0] ? getById(rows[0].TIC_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_TICKET_CREATE(:TIC_ID, :TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID); END;`,
    {
      TIC_ID: data.TIC_ID ?? null,
      TIC_CODIGO: data.TIC_CODIGO ?? null,
      VEH_ID: data.VEH_ID ?? null,
      TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
      COB_ID: data.COB_ID ?? null,
    }
  );
  return getById(data.TIC_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_TICKET_UPDATE(:id, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID); END;`,
    {
      id,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
      COB_ID: data.COB_ID ?? null,
    }
  );
  return getById(id);
}
