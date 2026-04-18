import oracledb from 'oracledb';
import PDFDocument from 'pdfkit/js/pdfkit.js';
import QRCode from 'qrcode';
import { getCobroMinimoSub1hEffective } from './cobroPoliticaRuntime.js';
import { executeCursor, executeProcedure, executeSql, getConnection } from '../db/oracle.js';
import { ensureClienteFromTicketNitTx } from './cliente.js';
import { applyCashMovementTx } from './cashMachine.js';
import { occupySporadicSlotTx, releaseSporadicSlotTx } from './espacioCapacity.js';
import {
  isTipoMaquinaCobro,
  isTipoMaquinaEntrada,
  isTipoMaquinaSalida,
} from '../utils/tipoMaquinaRules.js';

/** Aplica mínimo (p. ej. Q5) solo si la estadía facturable es estrictamente menor a 60 minutos. */
function aplicarMinimoSub1h(montoBruto, minsFacturables) {
  const cfg = getCobroMinimoSub1hEffective();
  if (!cfg.habilitado) {
    return { monto: montoBruto, politica: { ...cfg, aplicada: false } };
  }
  if (!(minsFacturables < 60)) {
    return { monto: montoBruto, politica: { ...cfg, aplicada: false } };
  }
  const monto = Math.max(cfg.quetzales, montoBruto);
  return { monto, politica: { ...cfg, aplicada: monto > montoBruto } };
}

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
            c.COB_ID AS COB_ID
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON t.VEH_ID = v.VEH_ID
       JOIN PAR_ESTADO_TICKET e ON t.ETI_ID = e.ETI_ID
       LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
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
  const montoBruto = Number((horasRedondeadas * precio).toFixed(2));
  const { monto, politica } = aplicarMinimoSub1h(montoBruto, minsFacturables);

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
    montoMinimoAplicado: monto > montoBruto,
    politicaMinimoSub1h: politica,
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

function buildTicketCodigo(placa, when = new Date()) {
  const d = String(when.getDate()).padStart(2, '0');
  const m = String(when.getMonth() + 1).padStart(2, '0');
  const y = String(when.getFullYear()).slice(-2);
  const hh = String(when.getHours()).padStart(2, '0');
  const mm = String(when.getMinutes()).padStart(2, '0');
  const placaClean = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `${d}${m}${y}${hh}${mm}${placaClean}`;
}

async function vehiculoIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_VEHICULO' AND COLUMN_NAME='VEH_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function ticketIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TICKET' AND COLUMN_NAME='TIC_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function findEstadoActivoIdTx(conn, fallback) {
  const r = await conn.execute(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%activ%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? fallback ?? null;
}

async function findEstadoAlertaPendienteIdTx(conn) {
  const rows = await conn.execute(
    `SELECT EAL_ID
       FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) LIKE '%pend%'
         OR LOWER(EAL_ESTADO) LIKE '%activ%'
      ORDER BY EAL_ID`
  );
  return rows.rows?.[0]?.EAL_ID ?? null;
}

async function findTipoAlertaTiempoGraciaIdTx(conn) {
  const rows = await conn.execute(
    `SELECT TAL_ID
       FROM PAR_TIPO_ALERTA
      WHERE LOWER(TAL_TIPO) LIKE '%gracia%'
         OR LOWER(TAL_TIPO) LIKE '%tiempo%'
         OR LOWER(TAL_TIPO) LIKE '%salida%'
      ORDER BY TAL_ID`
  );
  if (rows.rows?.[0]?.TAL_ID != null) return rows.rows[0].TAL_ID;

  const fallback = await conn.execute(`SELECT TAL_ID FROM PAR_TIPO_ALERTA ORDER BY TAL_ID`);
  return fallback.rows?.[0]?.TAL_ID ?? null;
}

async function alertaIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ALERTA' AND COLUMN_NAME='ALE_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function buildEntryTicketPdfBuffer({ ticket, vehiculo }) {
  const qrDataUrl = await QRCode.toDataURL(ticket.TIC_CODIGO, { margin: 1, scale: 6 });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBuffer = Buffer.from(qrBase64, 'base64');

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Ticket de entrada', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(11);
    doc.text(`Codigo ticket: ${ticket.TIC_CODIGO}`);
    doc.text(`Ticket ID: ${ticket.TIC_ID}`);
    doc.text(`Placa: ${vehiculo.VEH_PLACA || 'N/D'}`);
    doc.text(`Modelo: ${vehiculo.VEH_MODELO || 'N/D'}`);
    doc.text(`Color: ${vehiculo.VEH_COLOR || 'N/D'}`);
    doc.text(`Hora entrada: ${new Date(ticket.TIC_FECHA_HORA_ENTRADA).toLocaleString('es-GT')}`);
    doc.moveDown(0.8);
    doc.text('QR para lectura en salida/cobro:');
    doc.image(qrBuffer, { fit: [220, 220], align: 'center' });
    doc.end();
  });
}

export async function generateEntryTicket({
  VEH_PLACA, VEH_MODELO, VEH_COLOR, TVE_ID, MAQ_ID,
}) {
  const placa = String(VEH_PLACA || '').trim().toUpperCase();
  if (!placa) throw new Error('VEH_PLACA es requerido');
  if (!TVE_ID) throw new Error('TVE_ID es requerido');
  if (!MAQ_ID) throw new Error('MAQ_ID es requerido');

  let conn;
  try {
    conn = await getConnection();
    const placaExist = await conn.execute(
      `SELECT VEH_ID FROM PAR_VEHICULO WHERE UPPER(TRIM(VEH_PLACA)) = UPPER(TRIM(:placa))`,
      { placa }
    );
    if (placaExist.rows?.length) {
      throw new Error('Ya existe un vehiculo con la misma VEH_PLACA');
    }

    const tipoVehiculo = await conn.execute(
      `SELECT TVE_ID FROM PAR_TIPO_VEHICULO WHERE TVE_ID = :id`,
      { id: TVE_ID }
    );
    if (!tipoVehiculo.rows?.length) throw new Error('TVE_ID no válido');

    const maq = await conn.execute(
      `SELECT m.MAQ_ID, tm.TMA_TIPO
         FROM PAR_MAQUINA m
         JOIN PAR_TIPO_MAQUINA tm ON tm.TMA_ID = m.TMA_ID
        WHERE m.MAQ_ID = :id`,
      { id: MAQ_ID }
    );
    if (!maq.rows?.length) throw new Error('MAQ_ID no válido');
    const tmaEntrada = maq.rows[0]?.TMA_TIPO;
    if (!tmaEntrada || !isTipoMaquinaEntrada(tmaEntrada)) {
      throw new Error('La generación de ticket requiere una máquina de tipo entrada');
    }

    await occupySporadicSlotTx(conn);

    const now = new Date();
    let vehId;
    if (await vehiculoIdentityAlwaysTx(conn)) {
      const insVeh = await conn.execute(
        `INSERT INTO PAR_VEHICULO (VEH_PLACA, VEH_MODELO, VEH_COLOR, TVE_ID, CLI_ID)
         VALUES (:placa, :modelo, :color, :tveId, NULL)
         RETURNING VEH_ID INTO :vehIdOut`,
        {
          placa,
          modelo: VEH_MODELO ?? null,
          color: VEH_COLOR ?? null,
          tveId: TVE_ID,
          vehIdOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      vehId = insVeh.outBinds?.vehIdOut?.[0];
    } else {
      const nextVeh = await conn.execute(`SELECT NVL(MAX(VEH_ID), 0) + 1 AS NEXT_ID FROM PAR_VEHICULO`);
      vehId = Number(nextVeh.rows?.[0]?.NEXT_ID || 1);
      await conn.execute(
        `INSERT INTO PAR_VEHICULO (VEH_ID, VEH_PLACA, VEH_MODELO, VEH_COLOR, TVE_ID, CLI_ID)
         VALUES (:vehId, :placa, :modelo, :color, :tveId, NULL)`,
        {
          vehId,
          placa,
          modelo: VEH_MODELO ?? null,
          color: VEH_COLOR ?? null,
          tveId: TVE_ID,
        }
      );
    }

    const etiActivoId = await findEstadoActivoIdTx(conn, 1);
    const ticCodigo = buildTicketCodigo(placa, now);
    let ticId;
    if (await ticketIdentityAlwaysTx(conn)) {
      const insTicket = await conn.execute(
        `INSERT INTO PAR_TICKET
          (TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID)
         VALUES
          (:codigo, :vehId, :entrada, NULL, :etiId)
         RETURNING TIC_ID INTO :ticIdOut`,
        {
          codigo: ticCodigo,
          vehId,
          entrada: now,
          etiId: etiActivoId,
          ticIdOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      ticId = insTicket.outBinds?.ticIdOut?.[0];
    } else {
      const nextTic = await conn.execute(`SELECT NVL(MAX(TIC_ID), 0) + 1 AS NEXT_ID FROM PAR_TICKET`);
      ticId = Number(nextTic.rows?.[0]?.NEXT_ID || 1);
      await conn.execute(
        `INSERT INTO PAR_TICKET
          (TIC_ID, TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID)
         VALUES
          (:ticId, :codigo, :vehId, :entrada, NULL, :etiId)`,
        {
          ticId,
          codigo: ticCodigo,
          vehId,
          entrada: now,
          etiId: etiActivoId,
        }
      );
    }

    const dmtIdentity = await detalleMaquinaTicketIdentityAlwaysTx(conn);
    if (dmtIdentity) {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:tx, :ticId, :maqId, :fecha)`,
        {
          tx: 'GENERACION_TICKET',
          ticId,
          maqId: MAQ_ID,
          fecha: now,
        }
      );
    } else {
      const nextDmt = await conn.execute(`SELECT NVL(MAX(DMT_ID), 0) + 1 AS NEXT_ID FROM PAR_DETALLE_MAQUINA_TICKET`);
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_ID, DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:id, :tx, :ticId, :maqId, :fecha)`,
        {
          id: Number(nextDmt.rows?.[0]?.NEXT_ID || 1),
          tx: 'GENERACION_TICKET',
          ticId,
          maqId: MAQ_ID,
          fecha: now,
        }
      );
    }

    await conn.commit();

    return {
      TIC_ID: ticId,
      TIC_CODIGO: ticCodigo,
      VEH_ID: vehId,
      VEH_PLACA: placa,
      TIC_FECHA_HORA_ENTRADA: now.toISOString(),
      ETI_ID: etiActivoId,
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

export async function generateEntryTicketPdfByTicketId(ticketId) {
  const rows = await executeSql(
    `SELECT t.TIC_ID, t.TIC_CODIGO, t.TIC_FECHA_HORA_ENTRADA,
            v.VEH_PLACA, v.VEH_MODELO, v.VEH_COLOR
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
      WHERE t.TIC_ID = :ticketId`,
    { ticketId }
  );
  const row = rows[0];
  if (!row) throw new Error('Ticket no encontrado');
  const pdfBuffer = await buildEntryTicketPdfBuffer({ ticket: row, vehiculo: row });
  return {
    pdfBuffer,
    fileName: `ticket-entrada-${row.TIC_ID}.pdf`,
  };
}

export async function checkoutByCodigo({
  TIC_CODIGO,
  TCO_ID,
  COB_NIT,
  USE_CF,
  COB_MONTO_RECIBIDO,
  MAQ_ID,
  BILLETES_INGRESO,
  COB_PROCESADO_MAQUINA = 1,
}) {
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
      `SELECT t.TIC_ID, t.TIC_CODIGO, t.TIC_FECHA_HORA_ENTRADA, t.ETI_ID, t.VEH_ID,
              c.COB_ID AS COB_ID
         FROM PAR_TICKET t
         LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
        WHERE UPPER(TRIM(t.TIC_CODIGO)) = UPPER(TRIM(:codigo))
        FOR UPDATE OF t.TIC_ID`,
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
    const montoBruto = Number((horasCobradas * precio).toFixed(2));
    const { monto } = aplicarMinimoSub1h(montoBruto, minsFacturables);

    const maqTipo = await conn.execute(
      `SELECT tm.TMA_TIPO
         FROM PAR_MAQUINA m
         JOIN PAR_TIPO_MAQUINA tm ON tm.TMA_ID = m.TMA_ID
        WHERE m.MAQ_ID = :id`,
      { id: MAQ_ID }
    );
    const tmaCobro = maqTipo.rows?.[0]?.TMA_TIPO;
    if (!tmaCobro || !isTipoMaquinaCobro(tmaCobro)) {
      throw new Error('El cobro debe registrarse en una máquina de tipo cobro');
    }

    const montoRecibido = Number(COB_MONTO_RECIBIDO);
    if (!Number.isFinite(montoRecibido) || montoRecibido < monto) {
      throw new Error('El monto recibido debe ser mayor o igual al monto total');
    }
    const vuelto = Number((montoRecibido - monto).toFixed(2));

    let ingresoMap = null;
    if (BILLETES_INGRESO && typeof BILLETES_INGRESO === 'object') {
      ingresoMap = {};
      let suma = 0;
      for (const d of [50, 20, 10, 5]) {
        const n = Math.floor(
          Number(BILLETES_INGRESO[d] ?? BILLETES_INGRESO[String(d)] ?? 0),
        );
        if (n > 0) ingresoMap[d] = n;
        suma += n * d;
      }
      suma = Math.round(suma * 100) / 100;
      if (Math.abs(suma - montoRecibido) > 0.05) {
        throw new Error('La suma de billetes ingresados no coincide con el monto recibido');
      }
    }

    let cobId;
    if (await cobroIdentityAlwaysTx(conn)) {
      const ins = await conn.execute(
        `INSERT INTO PAR_COBRO
          (COB_HORAS_TOTALES, TCO_ID, TIC_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO,
           COB_FECHA_HORA, COB_PROCESADO_MAQUINA, TAR_ID, COB_NIT)
         VALUES
          (:COB_HORAS_TOTALES, :TCO_ID, :TIC_ID, :COB_MONTO_TOTAL, :COB_MONTO_RECIBIDO, :COB_VUELTO,
           :COB_FECHA_HORA, :COB_PROCESADO_MAQUINA, :TAR_ID, :COB_NIT)
         RETURNING COB_ID INTO :COB_ID_OUT`,
        {
          COB_HORAS_TOTALES: Number(horas.toFixed(2)),
          TCO_ID,
          TIC_ID: ticket.TIC_ID,
          COB_MONTO_TOTAL: monto,
          COB_MONTO_RECIBIDO: montoRecibido,
          COB_VUELTO: vuelto,
          COB_FECHA_HORA: ahora,
          COB_PROCESADO_MAQUINA: Number(COB_PROCESADO_MAQUINA) ? 1 : 0,
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
          (COB_ID, COB_HORAS_TOTALES, TCO_ID, TIC_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO,
           COB_FECHA_HORA, COB_PROCESADO_MAQUINA, TAR_ID, COB_NIT)
         VALUES
          (:COB_ID, :COB_HORAS_TOTALES, :TCO_ID, :TIC_ID, :COB_MONTO_TOTAL, :COB_MONTO_RECIBIDO, :COB_VUELTO,
           :COB_FECHA_HORA, :COB_PROCESADO_MAQUINA, :TAR_ID, :COB_NIT)`,
        {
          COB_ID: cobId,
          COB_HORAS_TOTALES: Number(horas.toFixed(2)),
          TCO_ID,
          TIC_ID: ticket.TIC_ID,
          COB_MONTO_TOTAL: monto,
          COB_MONTO_RECIBIDO: montoRecibido,
          COB_VUELTO: vuelto,
          COB_FECHA_HORA: ahora,
          COB_PROCESADO_MAQUINA: Number(COB_PROCESADO_MAQUINA) ? 1 : 0,
          TAR_ID: tarifa.TAR_ID,
          COB_NIT: cobNit,
        }
      );
    }

    const etiPagadoId = await findEstadoPagadoIdTx(conn, ticket.ETI_ID);
    await conn.execute(
      `UPDATE PAR_TICKET
          SET ETI_ID = :etiId
        WHERE TIC_ID = :ticId`,
      { etiId: etiPagadoId, ticId: ticket.TIC_ID }
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

    if (Number(COB_PROCESADO_MAQUINA)) {
      try {
        await applyCashMovementTx(conn, {
          maqId: MAQ_ID,
          vuelto,
          ingresoPorValor: ingresoMap,
        });
      } catch (cashErr) {
        throw cashErr;
      }
    }

    const vinculoNit = await ensureClienteFromTicketNitTx(conn, {
      useCf: !!USE_CF,
      cobNit,
      vehId: ticket.VEH_ID,
      ticId: ticket.TIC_ID,
    });

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
      clienteFacturaNit: vinculoNit,
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

export async function validateExitByCodigo({ TIC_CODIGO, MAQ_ID }) {
  const codigo = String(TIC_CODIGO || '').trim();
  if (!codigo) throw new Error('TIC_CODIGO es requerido');
  if (!MAQ_ID) throw new Error('MAQ_ID es requerido para registrar salida');

  let conn;
  try {
    conn = await getConnection();
    const hasGrace = await conn.execute(
      `SELECT COUNT(*) AS TOTAL
         FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME='PAR_TARIFA' AND COLUMN_NAME='TAR_TIEMPO_GRACIA'`
    );
    if (Number(hasGrace.rows?.[0]?.TOTAL || 0) <= 0) {
      throw new Error('Falta la columna TAR_TIEMPO_GRACIA en PAR_TARIFA');
    }

    const maq = await conn.execute(
      `SELECT m.MAQ_ID, tm.TMA_TIPO
         FROM PAR_MAQUINA m
         JOIN PAR_TIPO_MAQUINA tm ON tm.TMA_ID = m.TMA_ID
        WHERE m.MAQ_ID = :id`,
      { id: MAQ_ID }
    );
    if (!maq.rows?.length) throw new Error('MAQ_ID no válido');
    const tmaSalida = maq.rows[0]?.TMA_TIPO;
    if (!tmaSalida || !isTipoMaquinaSalida(tmaSalida)) {
      throw new Error('La validación de salida debe hacerse en una máquina de tipo salida');
    }

    const tRes = await conn.execute(
      `SELECT t.TIC_ID, t.TIC_CODIGO, t.ETI_ID, et.ETI_ESTADO, c.COB_ID AS COB_ID,
              c.COB_FECHA_HORA, c.TAR_ID,
              tr.TAR_TIEMPO_GRACIA
         FROM PAR_TICKET t
         LEFT JOIN PAR_ESTADO_TICKET et ON et.ETI_ID = t.ETI_ID
         LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
         LEFT JOIN PAR_TARIFA tr ON tr.TAR_ID = c.TAR_ID
        WHERE UPPER(TRIM(t.TIC_CODIGO)) = UPPER(TRIM(:codigo))
        FOR UPDATE OF t.TIC_ID`,
      { codigo }
    );
    const ticket = tRes.rows?.[0];
    if (!ticket) throw new Error('Ticket no reconocido');

    const estado = String(ticket.ETI_ESTADO || '').toLowerCase();
    const isPaid = estado.includes('pagad') || ticket.COB_ID != null;
    if (!isPaid) {
      throw new Error('Salida bloqueada: el ticket no esta pagado, dirigete a la maquina de cobro');
    }
    if (!ticket.COB_FECHA_HORA) {
      throw new Error('No se encontró fecha de pago para validar salida');
    }

    const now = new Date();
    const pagoAt = new Date(ticket.COB_FECHA_HORA);
    if (Number.isNaN(pagoAt.getTime())) throw new Error('Fecha de pago inválida');
    const minsDesdePago = Math.max(0, (now.getTime() - pagoAt.getTime()) / (1000 * 60));
    const graceMins = Math.max(0, Number(ticket.TAR_TIEMPO_GRACIA ?? 0));
    const withinGrace = minsDesdePago <= graceMins;

    if (!withinGrace) {
      const ealId = await findEstadoAlertaPendienteIdTx(conn);
      const talId = await findTipoAlertaTiempoGraciaIdTx(conn);
      if (!ealId || !talId) {
        throw new Error('No se pudo generar alerta por tiempo de gracia superado');
      }

      const motivo = 'Tiempo de gracia superado';
      const descripcion = `Ticket ${ticket.TIC_CODIGO} excedio los ${graceMins} min de gracia post-pago`;
      if (await alertaIdentityAlwaysTx(conn)) {
        await conn.execute(
          `INSERT INTO PAR_ALERTA
            (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
           VALUES
            (:maqId, :motivo, :descripcion, :fecha, :ealId, :talId, NULL)`,
          { maqId: MAQ_ID, motivo, descripcion, fecha: now, ealId, talId }
        );
      } else {
        const nxt = await conn.execute(`SELECT NVL(MAX(ALE_ID), 0) + 1 AS NEXT_ID FROM PAR_ALERTA`);
        await conn.execute(
          `INSERT INTO PAR_ALERTA
            (ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
           VALUES
            (:id, :maqId, :motivo, :descripcion, :fecha, :ealId, :talId, NULL)`,
          {
            id: Number(nxt.rows?.[0]?.NEXT_ID || 1),
            maqId: MAQ_ID,
            motivo,
            descripcion,
            fecha: now,
            ealId,
            talId,
          }
        );
      }
      await conn.commit();
      throw new Error('Salida bloqueada: tiempo de gracia superado, solicita asistencia');
    }

    const dmtIdentity = await detalleMaquinaTicketIdentityAlwaysTx(conn);
    if (dmtIdentity) {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:transaccion, :ticId, :maqId, :fecha)`,
        {
          transaccion: 'REGISTRO_SALIDA',
          ticId: ticket.TIC_ID,
          maqId: MAQ_ID,
          fecha: now,
        }
      );
    } else {
      const nxt = await conn.execute(`SELECT NVL(MAX(DMT_ID), 0) + 1 AS NEXT_ID FROM PAR_DETALLE_MAQUINA_TICKET`);
      await conn.execute(
        `INSERT INTO PAR_DETALLE_MAQUINA_TICKET
          (DMT_ID, DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION)
         VALUES
          (:id, :transaccion, :ticId, :maqId, :fecha)`,
        {
          id: Number(nxt.rows?.[0]?.NEXT_ID || 1),
          transaccion: 'REGISTRO_SALIDA',
          ticId: ticket.TIC_ID,
          maqId: MAQ_ID,
          fecha: now,
        }
      );
    }

    await releaseSporadicSlotTx(conn);

    await conn.commit();
    return {
      access: 'granted',
      message: 'Salida autorizada',
      TIC_ID: ticket.TIC_ID,
      TIC_CODIGO: ticket.TIC_CODIGO,
      MAQ_ID,
      minutesSincePayment: Number(minsDesdePago.toFixed(2)),
      graceMinutes: graceMins,
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
       JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
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
        (TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID)
       VALUES
        (:TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID)`,
      {
        TIC_CODIGO: data.TIC_CODIGO ?? null,
        VEH_ID: data.VEH_ID ?? null,
        TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
        TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
        ETI_ID: data.ETI_ID ?? null,
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
    `BEGIN SP_TICKET_CREATE(:TIC_ID, :TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID); END;`,
    {
      TIC_ID: data.TIC_ID ?? null,
      TIC_CODIGO: data.TIC_CODIGO ?? null,
      VEH_ID: data.VEH_ID ?? null,
      TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
    }
  );
  return getById(data.TIC_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_TICKET_UPDATE(:id, :TIC_FECHA_HORA_SALIDA, :ETI_ID); END;`,
    {
      id,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
    }
  );
  return getById(id);
}

async function findEstadoTicketExtraviadoTx(conn) {
  const r = await conn.execute(
    `SELECT ETI_ID FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%extrav%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? null;
}

/** Protocolo ticket extraviado: marca estado y devuelve cotización vigente. */
export async function prepararTicketExtraviadoPorPlaca(vehPlaca) {
  const placa = String(vehPlaca || '').trim().toUpperCase();
  if (!placa) throw new Error('VEH_PLACA es requerido');
  let conn;
  try {
    conn = await getConnection();
    const etiEx = await findEstadoTicketExtraviadoTx(conn);
    if (!etiEx) {
      throw new Error(
        'No existe estado de ticket «extraviado» en PAR_ESTADO_TICKET (crea un registro con ETI_ESTADO que contenga «extraviado»).'
      );
    }
    const v = await conn.execute(
      `SELECT VEH_ID FROM PAR_VEHICULO WHERE UPPER(TRIM(VEH_PLACA)) = :p AND CLI_ID IS NULL`,
      { p: placa }
    );
    const vehId = v.rows?.[0]?.VEH_ID;
    if (!vehId) throw new Error('No hay vehículo esporádico (sin CLI_ID) con esa placa');
    const t = await conn.execute(
      `SELECT t.TIC_ID, t.TIC_CODIGO FROM PAR_TICKET t
        WHERE t.VEH_ID = :v
          AND NOT EXISTS (SELECT 1 FROM PAR_COBRO c WHERE c.TIC_ID = t.TIC_ID)
        ORDER BY t.TIC_ID DESC`,
      { v: vehId }
    );
    const tic = t.rows?.[0];
    if (!tic) throw new Error('No hay ticket pendiente de cobro para esa placa');
    await conn.execute(
      `UPDATE PAR_TICKET SET ETI_ID = :eti WHERE TIC_ID = :tic`,
      { eti: etiEx, tic: tic.TIC_ID }
    );
    await conn.commit();
    return quoteByCodigo(String(tic.TIC_CODIGO));
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}
