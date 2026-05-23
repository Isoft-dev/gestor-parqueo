import oracledb from 'oracledb';
import { executeCursor, executeProcedure, getConnection } from '../db/oracle.js';
import {
  getCobroMinimoSub1hEffective,
  getTarifaActivaRuntimeId,
} from './cobroPoliticaRuntime.js';
import { ensureClienteFromTicketNitTx } from './cliente.js';

const RECARGO_TICKET_EXTRAVIADO_Q = 100;

function ticketEstadoIndicaExtraviado(etiEstado) {
  return String(etiEstado ?? '')
    .toLowerCase()
    .includes('extrav');
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function aplicarMinimoSub1h(montoBruto, minsFacturables) {
  const cfg = getCobroMinimoSub1hEffective();
  if (!cfg.habilitado || !(minsFacturables < 60)) {
    return { monto: montoBruto, politica: { ...cfg, aplicada: false } };
  }
  const monto = Math.max(cfg.quetzales, montoBruto);
  return { monto, politica: { ...cfg, aplicada: monto > montoBruto } };
}

async function resolveTarifaTx(conn, preferredTarId) {
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
  if (!list.length) return null;

  const explicitTarId = Number(preferredTarId);
  if (Number.isFinite(explicitTarId) && explicitTarId > 0) {
    const explicit = list.find((r) => Number(r.TAR_ID) === explicitTarId);
    if (!explicit) throw new Error('La tarifa seleccionada no existe.');
    return explicit;
  }

  const runtimeTarId = getTarifaActivaRuntimeId();
  if (runtimeTarId != null) {
    const active = list.find((r) => Number(r.TAR_ID) === Number(runtimeTarId));
    if (active) return active;
  }
  return list[0] || null;
}

async function buildCobroCalculadoTx(conn, data) {
  const ticId = Number(data.TIC_ID);
  if (!Number.isFinite(ticId) || ticId <= 0) {
    throw new Error('TIC_ID es inválido');
  }

  const tRes = await conn.execute(
    `SELECT t.TIC_ID, t.TIC_CODIGO, t.TIC_FECHA_HORA_ENTRADA, t.ETI_ID, t.VEH_ID,
            et.ETI_ESTADO,
            c.COB_ID AS COB_ID,
            c.COB_MONTO_TOTAL AS COB_MONTO_TOTAL
       FROM PAR_TICKET t
       JOIN PAR_ESTADO_TICKET et ON et.ETI_ID = t.ETI_ID
       LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
      WHERE t.TIC_ID = :ticId`,
    { ticId }
  );
  const ticket = tRes.rows?.[0];
  if (!ticket) throw new Error('Ticket no encontrado');

  const estadoTicketNorm = String(ticket.ETI_ESTADO || '').toLowerCase();
  const isVencido = estadoTicketNorm.includes('venc');
  const isVolverCobrar = estadoTicketNorm.includes('volver') && estadoTicketNorm.includes('cobr');
  const hasCobro = ticket.COB_ID != null && String(ticket.COB_ID).trim() !== '';
  if (hasCobro && !isVencido && !isVolverCobrar) {
    throw new Error('Ticket ya saldado');
  }

  const tarifa = await resolveTarifaTx(conn, data.TAR_ID);
  if (!tarifa) throw new Error('No hay tarifa vigente configurada');

  const entrada = new Date(ticket.TIC_FECHA_HORA_ENTRADA);
  if (Number.isNaN(entrada.getTime())) {
    throw new Error('Ticket con fecha de entrada inválida');
  }

  const fechaCobro = data.COB_FECHA_HORA ? new Date(data.COB_FECHA_HORA) : new Date();
  if (Number.isNaN(fechaCobro.getTime())) {
    throw new Error('La fecha/hora del cobro es inválida');
  }

  const mins = Math.max(0, (fechaCobro.getTime() - entrada.getTime()) / (1000 * 60));
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

  let montoRecibido = null;
  let vuelto = null;
  if (data.COB_MONTO_RECIBIDO != null && data.COB_MONTO_RECIBIDO !== '') {
    montoRecibido = Number(data.COB_MONTO_RECIBIDO);
    if (!Number.isFinite(montoRecibido) || montoRecibido < 0) {
      throw new Error('El monto recibido es inválido');
    }
    if (montoRecibido < montoTotalCobro) {
      throw new Error('El monto recibido debe ser mayor o igual al monto total');
    }
    vuelto = round2(montoRecibido - montoTotalCobro);
  }

  return {
    VEH_ID: Number(ticket.VEH_ID),
    COB_HORAS_TOTALES: Number(horas.toFixed(2)),
    COB_MONTO_TOTAL: montoTotalCobro,
    COB_MONTO_RECIBIDO: montoRecibido,
    COB_VUELTO: vuelto,
    COB_FECHA_HORA: fechaCobro,
    TAR_ID: Number(tarifa.TAR_ID),
  };
}

export async function getAll() {
  return executeCursor(`BEGIN SP_COBRO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_COBRO_GET_BY_ID(:id, :cursor); END;`, {
    id: Number(id),
  });
  return rows[0] || null;
}

export async function create(data) {
  const ticId = data.TIC_ID;
  if (ticId == null || String(ticId).trim() === '') {
    throw new Error('TIC_ID es requerido');
  }
  let conn;
  try {
    conn = await getConnection();
    const calculado = await buildCobroCalculadoTx(conn, data);
    const cobNit =
      data.COB_NIT != null && String(data.COB_NIT).trim() !== ''
        ? String(data.COB_NIT).trim()
        : null;
    const result = await conn.execute(
      `BEGIN SP_COBRO_CREATE(
        :TIC_ID, :COB_NIT, :COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL,
        :COB_MONTO_RECIBIDO, :COB_VUELTO, :COB_FECHA_HORA,
        :COB_PROCESADO_MAQUINA, :TAR_ID, :NEW_COB_ID
      ); END;`,
      {
        TIC_ID: Number(ticId),
        COB_NIT: cobNit,
        COB_HORAS_TOTALES: calculado.COB_HORAS_TOTALES,
        TCO_ID: Number(data.TCO_ID),
        COB_MONTO_TOTAL: calculado.COB_MONTO_TOTAL,
        COB_MONTO_RECIBIDO: calculado.COB_MONTO_RECIBIDO,
        COB_VUELTO: calculado.COB_VUELTO,
        COB_FECHA_HORA: calculado.COB_FECHA_HORA,
        COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? 0,
        TAR_ID: calculado.TAR_ID,
        NEW_COB_ID: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: false },
    );
    await ensureClienteFromTicketNitTx(conn, {
      useCf: String(cobNit || '').trim().toUpperCase() === 'CF',
      cobNit,
      vehId: calculado.VEH_ID,
      ticId: Number(ticId),
    });
    await conn.commit();
    const raw = result.outBinds?.NEW_COB_ID;
    const newId = Array.isArray(raw) ? raw[0] : raw;
    return getById(newId);
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, data) {
  const current = await getById(id);
  if (!current) return null;

  const immutableFields = [
    'TIC_ID',
    'COB_NIT',
    'COB_HORAS_TOTALES',
    'TCO_ID',
    'COB_MONTO_TOTAL',
    'COB_MONTO_RECIBIDO',
    'COB_VUELTO',
    'COB_FECHA_HORA',
    'TAR_ID',
  ];
  for (const field of immutableFields) {
    if (data[field] != null && String(data[field]) !== String(current[field] ?? '')) {
      throw new Error(
        `No se permite modificar ${field} en un cobro ya emitido. Los cambios de tarifa aplican solo a transacciones nuevas.`
      );
    }
  }

  await executeProcedure(
    `BEGIN SP_COBRO_UPDATE(:id, :COB_PROCESADO_MAQUINA); END;`,
    {
      id: Number(id),
      COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? current.COB_PROCESADO_MAQUINA ?? 0,
    },
  );
  return getById(id);
}
