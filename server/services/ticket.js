import oracledb from 'oracledb';
import PDFDocument from 'pdfkit/js/pdfkit.js';
import QRCode from 'qrcode';
import { getCobroMinimoSub1hEffective, getTarifaActivaRuntimeId } from './cobroPoliticaRuntime.js';
import { executeCursor, executeProcedure, executeSql, getConnection } from '../db/oracle.js';
import { ensureClienteFromTicketNitTx } from './cliente.js';
import { applyCashMovementTx } from './cashMachine.js';
import { occupySporadicSlotTx, releaseSporadicSlotTx } from './espacioCapacity.js';
import {
  isTipoMaquinaCobro,
  isTipoMaquinaEntrada,
  isTipoMaquinaSalida,
} from '../utils/tipoMaquinaRules.js';
import { assertMachineIsOperative, getMachineWithStatusTx } from '../utils/machineStatus.js';
import { assertValidPlate } from '../utils/plate.js';

/** Recargo fijo (GTQ) por ticket en estado extraviado al momento del cobro. */
const RECARGO_TICKET_EXTRAVIADO_Q = 100;

function ticketEstadoIndicaExtraviado(etiEstado) {
  return String(etiEstado ?? '')
    .toLowerCase()
    .includes('extrav');
}

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
            c.COB_ID AS COB_ID, c.COB_MONTO_TOTAL AS COB_MONTO_TOTAL
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
  const selectedTarId = getTarifaActivaRuntimeId();
  if (selectedTarId != null) {
    const selected = rows.find((r) => String(r.TAR_ID) === String(selectedTarId));
    if (selected) return selected;
  }
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
  const list = rows.rows || [];
  const selectedTarId = getTarifaActivaRuntimeId();
  if (selectedTarId != null) {
    const selected = list.find((r) => String(r.TAR_ID) === String(selectedTarId));
    if (selected) return selected;
  }
  return list[0] || null;
}

export async function quoteByCodigo(codigo) {
  const ticket = await getByCodigo(codigo);
  if (!ticket) throw new Error('Ticket no reconocido');
  const estadoTicketNorm = String(ticket.ETI_ESTADO || '').toLowerCase();
  const isVencido = estadoTicketNorm.includes('venc');
  const isVolverCobrar = estadoTicketNorm.includes('volver') && estadoTicketNorm.includes('cobr');
  const hasCobro = ticket.COB_ID != null && String(ticket.COB_ID).trim() !== '';
  if (hasCobro && !isVencido && !isVolverCobrar) {
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
  const extraviado = ticketEstadoIndicaExtraviado(ticket.ETI_ESTADO);
  const recargoTicketExtraviado = extraviado ? RECARGO_TICKET_EXTRAVIADO_Q : 0;
  const recargoPorVencimiento =
    isVencido && hasCobro
      ? Number(ticket.COB_MONTO_TOTAL || 0)
      : 0;
  const recargoPorVolverCobrar =
    isVolverCobrar && hasCobro
      ? Number((monto + recargoTicketExtraviado).toFixed(2))
      : 0;
  const montoTotal = Number(
    (
      (isVencido && hasCobro
        ? recargoPorVencimiento
        : isVolverCobrar && hasCobro
          ? recargoPorVolverCobrar
          : monto + recargoTicketExtraviado)
    ).toFixed(2)
  );

  return {
    ticket: {
      TIC_ID: ticket.TIC_ID,
      TIC_CODIGO: ticket.TIC_CODIGO,
      VEH_PLACA: ticket.VEH_PLACA,
      TIC_FECHA_HORA_ENTRADA: ticket.TIC_FECHA_HORA_ENTRADA,
      ETI_ID: ticket.ETI_ID,
      ETI_ESTADO: ticket.ETI_ESTADO,
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
    montoEstadia: monto,
    recargoTicketExtraviado,
    recargoPorVencimiento,
    recargoPorVolverCobrar,
    extraviado,
    montoTotal,
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

async function bitacoraIncidenteVehiculoIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_BITACORA_INCIDENTE_VEHICULO' AND COLUMN_NAME='BIV_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function findIncidenteTicketExtraviadoIdTx(conn) {
  const r = await conn.execute(
    `SELECT INC_ID
       FROM PAR_INCIDENTE
      WHERE LOWER(INC_TIPO) LIKE '%extrav%'
         OR LOWER(NVL(INC_DESCRIPCION, '')) LIKE '%extrav%'
      ORDER BY INC_ID`
  );
  return r.rows?.[0]?.INC_ID ?? null;
}

/**
 * Bitácora al marcar el ticket como extraviado desde gestión (pendiente hasta cobro/salida).
 * Requiere al menos un PAR_INCIDENTE cuyo tipo o descripción sugiera «extraviado».
 */
/**
 * Marca como resuelta la bitácora de ticket extraviado vinculada al pago (fecha = cobro).
 */
async function resolveBitacoraTicketExtraviadoEnCobroTx(conn, { vehId, ticId, fechaPago }) {
  if (vehId == null || ticId == null) return;
  const incId = await findIncidenteTicketExtraviadoIdTx(conn);
  if (incId == null) return;
  const mark = `(TIC_ID ${ticId})`;
  await conn.execute(
    `UPDATE PAR_BITACORA_INCIDENTE_VEHICULO b
        SET b.BIV_RESUELTO = 1,
            b.BIV_FECHA_RESOLUCION = :fh
      WHERE b.BIV_ID = (
        SELECT MAX(b2.BIV_ID)
          FROM PAR_BITACORA_INCIDENTE_VEHICULO b2
         WHERE b2.VEH_ID = :v
           AND b2.INC_ID = :inc
           AND NVL(b2.BIV_RESUELTO, 0) = 0
           AND b2.BIV_FECHA_RESOLUCION IS NULL
           AND INSTR(b2.BIV_DESCRIPCION, :mark) > 0
      )`,
    { fh: fechaPago, v: vehId, inc: incId, mark }
  );
}

async function insertBitacoraTicketExtraviadoDesdeGestionStandalone({ vehId, ticId, ticCodigo, usuId }) {
  const fecha = new Date();
  const desc = (
    `Ticket extraviado (gestión): estado actualizado en PAR_TICKET. Código ${ticCodigo} (TIC_ID ${ticId}). ` +
    `Pendiente de cobro; al pagar en máquina de cobro se aplica recargo de Q${RECARGO_TICKET_EXTRAVIADO_Q.toFixed(2)} sobre la estadía.`
  ).slice(0, 950);

  const usuBind =
    usuId != null && String(usuId).trim() !== '' && !Number.isNaN(Number(usuId)) ? Number(usuId) : null;

  let conn;
  try {
    conn = await getConnection();
    const incId = await findIncidenteTicketExtraviadoIdTx(conn);
    if (incId == null) {
      throw new Error(
        'No hay incidente configurado para ticket extraviado: agrega en PAR_INCIDENTE un INC_TIPO o INC_DESCRIPCION que contenga «extraviado».'
      );
    }
    const identityAlways = await bitacoraIncidenteVehiculoIdentityAlwaysTx(conn);
    if (identityAlways) {
      await conn.execute(
        `INSERT INTO PAR_BITACORA_INCIDENTE_VEHICULO
          (BIV_DESCRIPCION, BIV_FECHA_HORA, VEH_ID, INC_ID, BIV_RESUELTO, BIV_FECHA_RESOLUCION, USU_ID)
         VALUES
          (:d, :fh, :v, :inc, 0, NULL, :usu)`,
        { d: desc, fh: fecha, v: vehId, inc: incId, usu: usuBind }
      );
    } else {
      const nxt = await conn.execute(
        `SELECT NVL(MAX(BIV_ID), 0) + 1 AS N FROM PAR_BITACORA_INCIDENTE_VEHICULO`
      );
      const bivId = Number(nxt.rows?.[0]?.N ?? nxt.rows?.[0]?.n ?? 1);
      await conn.execute(
        `INSERT INTO PAR_BITACORA_INCIDENTE_VEHICULO
          (BIV_ID, BIV_DESCRIPCION, BIV_FECHA_HORA, VEH_ID, INC_ID, BIV_RESUELTO, BIV_FECHA_RESOLUCION, USU_ID)
         VALUES
          (:id, :d, :fh, :v, :inc, 0, NULL, :usu)`,
        { id: bivId, d: desc, fh: fecha, v: vehId, inc: incId, usu: usuBind }
      );
    }
    await conn.commit();
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

async function findEstadoVencidoIdTx(conn, fallback = null) {
  const r = await conn.execute(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%venc%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? fallback ?? null;
}

async function findEstadoVolverCobrarIdTx(conn) {
  const r = await conn.execute(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%volver%'
        AND LOWER(ETI_ESTADO) LIKE '%cobr%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? null;
}

async function findEstadoValidadoIdTx(conn) {
  const r = await conn.execute(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%valid%'
      ORDER BY ETI_ID`
  );
  return r.rows?.[0]?.ETI_ID ?? null;
}

function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

async function findEstadoAlertaAtendidaId() {
  const rows = await executeSql(
    `SELECT EAL_ID
       FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) LIKE '%atendid%'
         OR LOWER(EAL_ESTADO) LIKE '%resuelt%'
         OR LOWER(EAL_ESTADO) LIKE '%cerrad%'
      ORDER BY EAL_ID`
  );
  if (rows?.[0]?.EAL_ID != null) return rows[0].EAL_ID;
  const fb = await executeSql(
    `SELECT EAL_ID
       FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) NOT LIKE '%pend%'
      ORDER BY EAL_ID`
  );
  return fb?.[0]?.EAL_ID ?? null;
}

async function hasAlertaColumn(columnName) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'PAR_ALERTA' AND COLUMN_NAME = :c`,
    { c: String(columnName || '').toUpperCase() }
  );
  return Number(rows?.[0]?.TOTAL || 0) > 0;
}

async function markGraceAlertAttendedByTicketCode(ticketCode, usuId = null) {
  if (!ticketCode) return;
  const ealAtendidaId = await findEstadoAlertaAtendidaId();
  if (!ealAtendidaId) return;
  const rows = await executeSql(
    `SELECT ALE_ID
       FROM PAR_ALERTA
      WHERE UPPER(NVL(ALE_DESCRIPCION, '')) LIKE UPPER(:descLike)
        AND (
          UPPER(NVL(ALE_MOTIVO, '')) LIKE '%GRACIA%'
          OR UPPER(NVL(ALE_DESCRIPCION, '')) LIKE '%GRACIA%'
        )
      ORDER BY ALE_FECHA_HORA_GENERACION DESC, ALE_ID DESC`,
    { descLike: `%TICKET ${String(ticketCode).trim()}%` }
  );
  const aleId = rows?.[0]?.ALE_ID ?? null;
  if (!aleId) return;
  const hasUsuResolvio = await hasAlertaColumn('ALE_USU_ID_RESOLVIO');
  const hasDescSolucion = await hasAlertaColumn('ALE_DESCRIPCION_SOLUCION');
  const sets = [
    'EAL_ID = :ealId',
    'ALE_FECHA_ATENCION = NVL(ALE_FECHA_ATENCION, SYSDATE)',
  ];
  const binds = { ealId: ealAtendidaId, aleId };
  if (hasUsuResolvio && usuId != null && String(usuId).trim() !== '') {
    sets.push('ALE_USU_ID_RESOLVIO = :usuId');
    binds.usuId = Number(usuId);
  }
  if (hasDescSolucion) {
    sets.push('ALE_DESCRIPCION_SOLUCION = :descSol');
    binds.descSol = 'Se le cambió el estado de vencido a volver a cobrar desde el panel de admin.';
  }
  await executeSql(
    `UPDATE PAR_ALERTA
        SET ${sets.join(', ')}
      WHERE ALE_ID = :aleId`,
    binds,
    { autoCommit: true }
  );
}

/** Comprobante estilo ticket térmico (~105 mm ancho). */
const RECEIPT_PAGE_W = Math.round((105 / 25.4) * 72);
const RECEIPT_PAGE_H = 480;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatReciboFechaLinea(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  let wd = date.toLocaleDateString('es-GT', { weekday: 'short' });
  wd = String(wd || '').replace(/\./g, '').trim().toUpperCase();
  return `${time} ${yyyy}-${mm}-${dd} ${wd}`;
}

function receiptNitDisplay(cobNit) {
  const s = String(cobNit ?? '').trim();
  if (!s || /^cf$/i.test(s)) return 'C / F';
  return s;
}

function horasEstadiaAHorasMinutos(decHoras) {
  const n = Number(decHoras);
  if (!Number.isFinite(n) || n < 0) return '0 Horas 0 Minutos';
  const totalMin = Math.round(n * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} Horas ${m} Minutos`;
}

function receiptRowTwoCol(doc, leftX, innerW, y, label, value) {
  const gap = 8;
  const lw = innerW * 0.38;
  const rw = innerW - lw - gap;
  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  const lab = String(label);
  const val = String(value ?? '—');
  const hLabel = doc.heightOfString(lab, { width: lw });
  const hVal = doc.heightOfString(val, { width: rw });
  const h = Math.max(hLabel, hVal, 11) + 3;
  doc.text(lab, leftX, y, { width: lw, align: 'left' });
  doc.text(val, leftX + lw + gap, y, { width: rw, align: 'right' });
  return y + h;
}

function buildPdfBuffer({ ticket, cobro }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [RECEIPT_PAGE_W, RECEIPT_PAGE_H],
      margin: 28,
    });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 28;
    const leftX = margin;
    const innerW = RECEIPT_PAGE_W - margin * 2;
    let y = margin;

    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('GESTOR PARQUEO', leftX, y, { width: innerW, align: 'center' });
    y += 16;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Grupo 8', leftX, y, { width: innerW, align: 'center' });
    y += 14;
    doc.font('Helvetica').fontSize(8.5);
    const nitTxt = receiptNitDisplay(cobro.COB_NIT);
    const clienteNombre = String(cobro.RECEIPT_CLIENTE_NOMBRE || '').trim() || '—';
    doc.text(`NIT: ${nitTxt}`, leftX, y, { width: innerW, align: 'center' });
    y += 11;
    doc.text(`Cliente: ${clienteNombre}`, leftX, y, { width: innerW, align: 'center' });
    y += 16;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Recibo No: ${cobro.COB_ID}`, leftX, y, { width: innerW, align: 'center' });
    y += 13;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Placa: ${ticket.VEH_PLACA || 'N/D'}`, leftX, y, { width: innerW, align: 'center' });
    y += 18;

    const tarifaDesc = String(cobro.TAR_TIPO || '—').trim() || '—';
    const medioPago = String(cobro.TIPO_COBRO_DESC || '').trim() || `Tipo cobro (${cobro.TCO_ID})`;
    const maqCobro = String(cobro.MAQ_COBRO_CODIGO || '').trim() || 'N/D';
    const entradaAt = ticket.TIC_FECHA_HORA_ENTRADA;
    const salidaAt = cobro.COB_FECHA_HORA;

    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Tarifa:', tarifaDesc);
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Entrada:', formatReciboFechaLinea(entradaAt));
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Salida:', formatReciboFechaLinea(salidaAt));
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Tiempo:', horasEstadiaAHorasMinutos(cobro.COB_HORAS_TOTALES));
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Máquina de cobro:', maqCobro);
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Medio de pago:', medioPago);
    y = receiptRowTwoCol(
      doc,
      leftX,
      innerW,
      y,
      'Monto recibido:',
      `Q${Number(cobro.COB_MONTO_RECIBIDO || 0).toFixed(2)}`,
    );
    y = receiptRowTwoCol(doc, leftX, innerW, y, 'Vuelto:', `Q${Number(cobro.COB_VUELTO || 0).toFixed(2)}`);
    y += 8;

    const barH = 22;
    const totalStr = `Q${Number(cobro.COB_MONTO_TOTAL || 0).toFixed(2)}`;
    doc.fillColor('#000000').rect(leftX, y, innerW, barH).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', leftX + 8, y + 5);
    doc.text(totalStr, leftX, y + 5, { width: innerW - 8, align: 'right' });
    doc.fillColor('#000000');
    y += barH + 14;

    doc.font('Helvetica').fontSize(9);
    doc.text('Gracias por su visita.', leftX, y, { width: innerW, align: 'center' });

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

/** ~80 mm ticket térmico (puntos @72 dpi). */
const ENTRY_TICKET_PAGE_W = Math.round((80 / 25.4) * 72);
/** Alto acotado al contenido; el pie va pegado a la última línea (sin hueco grande abajo). */
const ENTRY_TICKET_PAGE_H = 400;

function formatTicketThermalDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function drawThermalGrupo8Mark(doc, cx, cy, boxW, boxH) {
  doc.save();
  doc.rect(cx - boxW / 2, cy - boxH / 2, boxW, boxH).fill('#000000');
  doc.fillColor('#ffffff').font('Courier-Bold').fontSize(6.2);
  doc.text('Grupo 8', cx - boxW / 2, cy - 3.2, { width: boxW, align: 'center' });
  doc.restore();
}

async function buildEntryTicketPdfBuffer({ ticket, maquinaEntradaLabel }) {
  const qrDataUrl = await QRCode.toDataURL(String(ticket.TIC_CODIGO || ''), {
    margin: 1,
    errorCorrectionLevel: 'M',
    width: 320,
  });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBuffer = Buffer.from(qrBase64, 'base64');

  const machineLabel = String(maquinaEntradaLabel || '').trim() || 'N/D';
  const fechaLine = formatTicketThermalDate(ticket.TIC_FECHA_HORA_ENTRADA);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [ENTRY_TICKET_PAGE_W, ENTRY_TICKET_PAGE_H],
      margin: 14,
      autoFirstPage: true,
    });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 14;
    const leftX = margin;
    const innerW = ENTRY_TICKET_PAGE_W - margin * 2;

    doc.fillColor('#000000');
    doc.font('Courier').fontSize(9);

    const qrSize = Math.min(168, innerW);
    const qrX = leftX + (innerW - qrSize) / 2;
    doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
    doc.y += qrSize + 18;

    const centerBlock = (size, text, gapAfter = 6) => {
      doc.font('Courier').fontSize(size);
      doc.text(text, leftX, doc.y, { width: innerW, align: 'center' });
      doc.y += gapAfter;
    };

    centerBlock(9, 'Tarifa de Parqueo', 5);
    centerBlock(11, 'BIENVENIDOS', 6);
    centerBlock(9, 'Gestor de Parqueo', 7);
    centerBlock(8, 'Ticket No.', 5);
    doc.font('Courier-Bold').fontSize(10);
    doc.text(String(ticket.TIC_CODIGO || ''), leftX, doc.y, { width: innerW, align: 'center' });
    doc.y += 6;
    doc.font('Courier').fontSize(8.5);
    doc.text(fechaLine, leftX, doc.y, { width: innerW, align: 'center' });
    doc.y += 10;

    doc.font('Courier').fontSize(7.5);
    const markBoxW = 52;
    const markBoxH = 14;
    const gapMark = 8;
    const leftColW = Math.max(28, innerW - markBoxW - gapMark);
    const footerY = doc.y;
    const markCx = leftX + leftColW + gapMark + markBoxW / 2;

    doc.text(machineLabel, leftX, footerY, { width: leftColW, align: 'left' });
    drawThermalGrupo8Mark(doc, markCx, footerY + markBoxH / 2, markBoxW, markBoxH);
    doc.fillColor('#000000').font('Courier').fontSize(7.5);

    doc.end();
  });
}

export async function generateEntryTicket({
  VEH_PLACA, VEH_MODELO, VEH_COLOR, TVE_ID, MAQ_ID,
}) {
  const placa = assertValidPlate(VEH_PLACA);
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
      throw new Error('Ya existe un vehículo con la misma placa.');
    }

    const tipoVehiculo = await conn.execute(
      `SELECT TVE_ID FROM PAR_TIPO_VEHICULO WHERE TVE_ID = :id`,
      { id: TVE_ID }
    );
    if (!tipoVehiculo.rows?.length) throw new Error('TVE_ID no válido');

    const maquinaEntrada = await getMachineWithStatusTx(conn, MAQ_ID);
    if (!maquinaEntrada) throw new Error('MAQ_ID no válido');
    assertMachineIsOperative(maquinaEntrada, 'generar tickets de entrada');
    const tmaEntrada = maquinaEntrada.TMA_TIPO;
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
            v.VEH_PLACA, v.VEH_MODELO, v.VEH_COLOR,
            m.MAQ_CODIGO AS MAQ_ENTRADA_CODIGO
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
       LEFT JOIN PAR_DETALLE_MAQUINA_TICKET d
         ON d.TIC_ID = t.TIC_ID
        AND d.DMT_TRANSACCION = 'GENERACION_TICKET'
        AND d.DMT_ID = (
              SELECT MIN(d2.DMT_ID)
                FROM PAR_DETALLE_MAQUINA_TICKET d2
               WHERE d2.TIC_ID = t.TIC_ID
                 AND d2.DMT_TRANSACCION = 'GENERACION_TICKET'
            )
       LEFT JOIN PAR_MAQUINA m ON m.MAQ_ID = d.MAQ_ID
      WHERE t.TIC_ID = :ticketId`,
    { ticketId }
  );
  const row = rows[0];
  if (!row) throw new Error('Ticket no encontrado');
  const maquinaEntradaLabel = row.MAQ_ENTRADA_CODIGO != null && String(row.MAQ_ENTRADA_CODIGO).trim()
    ? String(row.MAQ_ENTRADA_CODIGO).trim()
    : 'N/D';
  const pdfBuffer = await buildEntryTicketPdfBuffer({
    ticket: row,
    maquinaEntradaLabel,
  });
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
              et.ETI_ESTADO,
              c.COB_ID AS COB_ID, c.COB_MONTO_TOTAL AS COB_MONTO_TOTAL
         FROM PAR_TICKET t
         JOIN PAR_ESTADO_TICKET et ON et.ETI_ID = t.ETI_ID
         LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
        WHERE UPPER(TRIM(t.TIC_CODIGO)) = UPPER(TRIM(:codigo))
        FOR UPDATE OF t.TIC_ID`,
      { codigo }
    );
    const ticket = tRes.rows?.[0];
    if (!ticket) throw new Error('Ticket no reconocido');
    const estadoTicketNorm = String(ticket.ETI_ESTADO || '').toLowerCase();
    const isVencido = estadoTicketNorm.includes('venc');
    const isVolverCobrar = estadoTicketNorm.includes('volver') && estadoTicketNorm.includes('cobr');
    const hasCobro = ticket.COB_ID != null && String(ticket.COB_ID).trim() !== '';
    if (hasCobro && !isVencido && !isVolverCobrar) throw new Error('Ticket ya saldado');

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
    const extraviado = ticketEstadoIndicaExtraviado(ticket.ETI_ESTADO);
    const recargoTicketExtraviado = extraviado ? RECARGO_TICKET_EXTRAVIADO_Q : 0;
    const recargoPorVencimiento =
      isVencido && hasCobro
        ? Number(ticket.COB_MONTO_TOTAL || 0)
        : 0;
    const recargoPorVolverCobrar =
      isVolverCobrar && hasCobro
        ? Number((monto + recargoTicketExtraviado).toFixed(2))
        : 0;
    const montoTotalCobro = Number(
      (
        (isVencido && hasCobro
          ? recargoPorVencimiento
          : isVolverCobrar && hasCobro
            ? recargoPorVolverCobrar
            : monto + recargoTicketExtraviado)
      ).toFixed(2)
    );

    const maquinaCobro = await getMachineWithStatusTx(conn, MAQ_ID);
    if (!maquinaCobro) throw new Error('MAQ_ID no válido');
    assertMachineIsOperative(maquinaCobro, 'registrar cobros');
    const tmaCobro = maquinaCobro.TMA_TIPO;
    if (!tmaCobro || !isTipoMaquinaCobro(tmaCobro)) {
      throw new Error('El cobro debe registrarse en una máquina de tipo cobro');
    }

    const montoRecibido = Number(COB_MONTO_RECIBIDO);
    if (!Number.isFinite(montoRecibido) || montoRecibido < montoTotalCobro) {
      throw new Error('El monto recibido debe ser mayor o igual al monto total');
    }
    const vuelto = Number((montoRecibido - montoTotalCobro).toFixed(2));

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
    if ((isVencido || isVolverCobrar) && hasCobro) {
      cobId = Number(ticket.COB_ID);
      await conn.execute(
        `UPDATE PAR_COBRO
            SET COB_MONTO_TOTAL = NVL(COB_MONTO_TOTAL, 0) + :extra,
                COB_MONTO_RECIBIDO = NVL(COB_MONTO_RECIBIDO, 0) + :recibido,
                COB_VUELTO = NVL(COB_VUELTO, 0) + :vuelto,
                COB_FECHA_HORA = :fecha,
                COB_PROCESADO_MAQUINA = :procesado
          WHERE COB_ID = :cobId`,
        {
          extra: montoTotalCobro,
          recibido: montoRecibido,
          vuelto,
          fecha: ahora,
          procesado: Number(COB_PROCESADO_MAQUINA) ? 1 : 0,
          cobId,
        }
      );
    } else if (await cobroIdentityAlwaysTx(conn)) {
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
          COB_MONTO_TOTAL: montoTotalCobro,
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
          COB_MONTO_TOTAL: montoTotalCobro,
          COB_MONTO_RECIBIDO: montoRecibido,
          COB_VUELTO: vuelto,
          COB_FECHA_HORA: ahora,
          COB_PROCESADO_MAQUINA: Number(COB_PROCESADO_MAQUINA) ? 1 : 0,
          TAR_ID: tarifa.TAR_ID,
          COB_NIT: cobNit,
        }
      );
    }

    if (extraviado) {
      await resolveBitacoraTicketExtraviadoEnCobroTx(conn, {
        vehId: ticket.VEH_ID,
        ticId: ticket.TIC_ID,
        fechaPago: ahora,
      });
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
      montoEstadia: monto,
      recargoTicketExtraviado,
      recargoPorVencimiento,
      recargoPorVolverCobrar,
      extraviado,
      montoTotal: montoTotalCobro,
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

    const maquinaSalida = await getMachineWithStatusTx(conn, MAQ_ID);
    if (!maquinaSalida) throw new Error('MAQ_ID no válido');
    assertMachineIsOperative(maquinaSalida, 'registrar salidas');
    const tmaSalida = maquinaSalida.TMA_TIPO;
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
      const etiVencidoId = await findEstadoVencidoIdTx(conn, ticket.ETI_ID);
      await conn.execute(
        `UPDATE PAR_TICKET
            SET ETI_ID = :etiId
          WHERE TIC_ID = :ticId`,
        { etiId: etiVencidoId, ticId: ticket.TIC_ID }
      );

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
      throw new Error('Salida bloqueada: tiempo de gracia superado, ticket vencido; dirigete a la maquina de cobro');
    }

    const etiValidadoId = await findEstadoValidadoIdTx(conn);
    if (!etiValidadoId) {
      throw new Error('No existe estado de ticket «Validado» en PAR_ESTADO_TICKET');
    }
    await conn.execute(
      `UPDATE PAR_TICKET
          SET TIC_FECHA_HORA_SALIDA = :fhSalida,
              ETI_ID = :etiId
        WHERE TIC_ID = :ticId`,
      { fhSalida: now, etiId: etiValidadoId, ticId: ticket.TIC_ID }
    );

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
            c.COB_FECHA_HORA, c.COB_NIT, c.TCO_ID, c.TAR_ID,
            tar.TAR_TIPO,
            tp.TCO_TIPO AS TIPO_COBRO_DESC,
            m.MAQ_CODIGO AS MAQ_COBRO_CODIGO,
            CASE
              WHEN UPPER(TRIM(NVL(c.COB_NIT, ''))) = 'CF' OR TRIM(NVL(c.COB_NIT, '')) IS NULL THEN 'Consumidor final'
              ELSE NVL(
                NULLIF(
                  TRIM(
                    REGEXP_REPLACE(
                      NVL(cl.CLI_PRIMER_NOMBRE, '') || ' ' || NVL(cl.CLI_SEGUNDO_NOMBRE, '') || ' ' ||
                      NVL(cl.CLI_PRIMER_APELLIDO, '') || ' ' || NVL(cl.CLI_SEGUNDO_APELLIDO, ''),
                      '[[:space:]]+',
                      ' '
                    )
                  ),
                  ''
                ),
                NVL(
                  (SELECT TRIM(
                            REGEXP_REPLACE(
                              NVL(c2.CLI_PRIMER_NOMBRE, '') || ' ' || NVL(c2.CLI_SEGUNDO_NOMBRE, '') || ' ' ||
                              NVL(c2.CLI_PRIMER_APELLIDO, '') || ' ' || NVL(c2.CLI_SEGUNDO_APELLIDO, ''),
                              '[[:space:]]+',
                              ' '
                            )
                          )
                     FROM PAR_CLIENTE c2
                    WHERE c2.CLI_ID = (
                          SELECT MAX(c3.CLI_ID)
                            FROM PAR_CLIENTE c3
                           WHERE c3.CLI_NIT IS NOT NULL
                             AND REGEXP_REPLACE(UPPER(TRIM(c3.CLI_NIT)), '[^0-9A-Z]', '') =
                                 REGEXP_REPLACE(UPPER(TRIM(c.COB_NIT)), '[^0-9A-Z]', '')
                        )),
                  'Sin datos de cliente'
                )
              )
            END AS RECEIPT_CLIENTE_NOMBRE
       FROM PAR_TICKET t
       LEFT JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
       LEFT JOIN PAR_CLIENTE cl ON cl.CLI_ID = v.CLI_ID
       JOIN PAR_COBRO c
         ON c.TIC_ID = t.TIC_ID
        AND c.COB_ID = (SELECT MAX(c2.COB_ID) FROM PAR_COBRO c2 WHERE c2.TIC_ID = t.TIC_ID)
       LEFT JOIN PAR_TARIFA tar ON tar.TAR_ID = c.TAR_ID
       LEFT JOIN PAR_TIPO_COBRO tp ON tp.TCO_ID = c.TCO_ID
       LEFT JOIN PAR_DETALLE_MAQUINA_TICKET d
         ON d.TIC_ID = t.TIC_ID
        AND d.DMT_TRANSACCION = 'PROCESAMIENTO_COBRO'
        AND d.DMT_ID = (
              SELECT MAX(d2.DMT_ID)
                FROM PAR_DETALLE_MAQUINA_TICKET d2
               WHERE d2.TIC_ID = t.TIC_ID
                 AND d2.DMT_TRANSACCION = 'PROCESAMIENTO_COBRO'
            )
       LEFT JOIN PAR_MAQUINA m ON m.MAQ_ID = d.MAQ_ID
      WHERE t.TIC_ID = :ticketId`,
    { ticketId }
  );
  return rows[0] || null;
}

export async function generateReceiptPdfByTicketId(ticketId) {
  const row = await getReceiptDataByTicketId(ticketId);
  if (!row) throw new Error('No se encontró comprobante para el ticket');
  let data = row;
  if (!String(data.TAR_TIPO || '').trim()) {
    const tar = await getTarifaVigente();
    if (tar?.TAR_TIPO) {
      data = { ...data, TAR_TIPO: tar.TAR_TIPO };
    }
  }
  const pdfBuffer = await buildPdfBuffer({
    ticket: data,
    cobro: data,
  });
  return {
    pdfBuffer,
    fileName: `comprobante-ticket-${row.TIC_ID}.pdf`,
  };
}

export async function create(data) {
  const entrada = data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : new Date();
  if (Number.isNaN(entrada.getTime())) throw new Error('TIC_FECHA_HORA_ENTRADA no válida');

  let codigo = String(data.TIC_CODIGO ?? '').trim();
  if (!codigo) {
    const vrows = await executeSql(
      `SELECT UPPER(TRIM(VEH_PLACA)) AS P FROM PAR_VEHICULO WHERE VEH_ID = :id`,
      { id: data.VEH_ID }
    );
    const placa = vrows[0]?.P ?? vrows[0]?.p;
    if (!placa) throw new Error('No se encontró la placa del vehículo para generar TIC_CODIGO');
    codigo = buildTicketCodigo(placa, entrada);
  }

  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TICKET' AND COLUMN_NAME='TIC_ID'`
  );
  const alwaysIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';

  if (alwaysIdentity) {
    await executeSql(
      `INSERT INTO PAR_TICKET
        (TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID)
       VALUES
        (:TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, NULL, :ETI_ID)`,
      {
        TIC_CODIGO: codigo,
        VEH_ID: data.VEH_ID ?? null,
        TIC_FECHA_HORA_ENTRADA: entrada,
        ETI_ID: data.ETI_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TIC_ID FROM PAR_TICKET
        WHERE TIC_CODIGO = :codigo
        ORDER BY TIC_ID DESC`,
      { codigo }
    );
    return rows[0] ? getById(rows[0].TIC_ID) : null;
  }

  let ticId = data.TIC_ID;
  if (ticId == null || String(ticId).trim() === '') {
    const r = await executeSql(`SELECT NVL(MAX(TIC_ID), 0) + 1 AS N FROM PAR_TICKET`);
    ticId = Number(r[0]?.N ?? r[0]?.n ?? 1);
  }

  await executeProcedure(
    `BEGIN SP_TICKET_CREATE(:TIC_ID, :TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID); END;`,
    {
      TIC_ID: ticId,
      TIC_CODIGO: codigo,
      VEH_ID: data.VEH_ID ?? null,
      TIC_FECHA_HORA_ENTRADA: entrada,
      TIC_FECHA_HORA_SALIDA: null,
      ETI_ID: data.ETI_ID ?? null,
    }
  );
  return getById(ticId);
}

export async function update(id, data, opts = {}) {
  const prev = await getById(id);
  if (!prev) throw new Error('Ticket no encontrado');

  await executeProcedure(
    `BEGIN SP_TICKET_UPDATE(:id, :TIC_FECHA_HORA_SALIDA, :ETI_ID); END;`,
    {
      id,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
    }
  );

  const rowsEtiEx = await executeSql(
    `SELECT ETI_ID
       FROM PAR_ESTADO_TICKET
      WHERE LOWER(ETI_ESTADO) LIKE '%extrav%'
      ORDER BY ETI_ID`
  );
  const etiExtraviadoId = rowsEtiEx[0]?.ETI_ID ?? rowsEtiEx[0]?.eti_id ?? null;
  const updated = await getById(id);
  const nuevoEti = updated?.ETI_ID ?? updated?.eti_id ?? null;
  const prevEti = prev?.ETI_ID ?? prev?.eti_id ?? null;
  const prevEstadoNorm = normText(prev?.ETI_ESTADO ?? prev?.eti_estado);
  const nextEstadoNorm = normText(updated?.ETI_ESTADO ?? updated?.eti_estado);

  if (
    etiExtraviadoId != null
    && nuevoEti != null
    && String(nuevoEti) === String(etiExtraviadoId)
    && String(prevEti || '') !== String(etiExtraviadoId)
  ) {
    const vehId = updated?.VEH_ID ?? updated?.veh_id ?? prev?.VEH_ID ?? prev?.veh_id;
    const codigo = updated?.TIC_CODIGO ?? updated?.tic_codigo ?? prev?.TIC_CODIGO ?? prev?.tic_codigo;
    if (vehId != null && codigo) {
      await insertBitacoraTicketExtraviadoDesdeGestionStandalone({
        vehId,
        ticId: id,
        ticCodigo: String(codigo),
        usuId: opts.usuIdBitacoraExtraviado ?? null,
      });
    }
  }

  if (
    prevEstadoNorm.includes('venc')
    && nextEstadoNorm.includes('volver')
    && nextEstadoNorm.includes('cobr')
  ) {
    const codigo = updated?.TIC_CODIGO ?? updated?.tic_codigo ?? prev?.TIC_CODIGO ?? prev?.tic_codigo ?? null;
    await markGraceAlertAttendedByTicketCode(codigo, opts?.usuIdAlertaAtendida ?? null);
  }

  return updated;
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
  const placa = assertValidPlate(vehPlaca);
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
