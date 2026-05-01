import oracledb from 'oracledb';
import { executeProcedure, executeSql, getConnection } from '../db/oracle.js';
import { buildMemCodigo, buildTagPdfBuffer } from '../utils/tag.js';
import { sendTagMail } from '../utils/mailer.js';
import {
  assignDynamicMembershipSpaceTx,
  afterMembresiaCreatedSetEspacioReservadoLibre,
  setMembresiaEspacioReservadoLibreTx,
  setMembresiaEspacioReservadoOcupadoTx,
} from './espacioCapacity.js';
import { insertSystemAlerta } from '../utils/systemAlert.js';
import { isTipoMaquinaEntrada } from '../utils/tipoMaquinaRules.js';

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isDisponibleEstado(s) {
  const x = norm(s);
  return x.includes('dispon') || x.includes('libre');
}

const MEM_SELECT_SQL = `
SELECT m.MEM_ID,
       m.TME_ID, tm.TME_TIPO, tm.TME_PRECIO, tm.TME_DURACION,
       m.MEM_FECHA_INICIO, m.MEM_FECHA_VENCIMIENTO,
       m.MEM_FECHA_ULTIMO_CAMBIO_ESTADO,
       m.EME_ID, em.EME_ESTADO,
       m.VEH_ID, v.VEH_PLACA, v.VEH_MODELO, v.CLI_ID,
       c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO,
       m.ESP_ID, e.ESP_CODIGO, e.ESP_UBICACION
FROM PAR_MEMBRESIA m
JOIN PAR_TIPO_MEMBRESIA tm ON m.TME_ID = tm.TME_ID
JOIN PAR_VEHICULO v ON m.VEH_ID = v.VEH_ID
LEFT JOIN PAR_CLIENTE c ON v.CLI_ID = c.CLI_ID
JOIN PAR_ESPACIO e ON m.ESP_ID = e.ESP_ID
LEFT JOIN PAR_ESTADO_MEMBRESIA em ON m.EME_ID = em.EME_ID
`;

export async function getAll() {
  return executeSql(`${MEM_SELECT_SQL} ORDER BY m.MEM_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${MEM_SELECT_SQL} WHERE m.MEM_ID = :id`, { id });
  return rows[0] || null;
}

async function validateEspacioDisponible(espId) {
  const rows = await executeSql(
    `SELECT e.ESP_ID, ee.EES_ESTADO
     FROM PAR_ESPACIO e
     LEFT JOIN PAR_ESTADO_ESPACIO ee ON ee.EES_ID = e.EES_ID
     WHERE e.ESP_ID = :espId`,
    { espId }
  );
  const row = rows[0];
  if (!row) throw new Error('El espacio indicado no existe');
  if (!isDisponibleEstado(row.EES_ESTADO)) {
    throw new Error('El espacio indicado no esta disponible para asignar membresia');
  }
}

function addDaysCalendar(fecha, days) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + Number(days));
  return d;
}

async function loadDuracionTipoMembresia(tmeId) {
  const rows = await executeSql(
    `SELECT TME_DURACION FROM PAR_TIPO_MEMBRESIA WHERE TME_ID = :id`,
    { id: tmeId }
  );
  const n = Number(rows[0]?.TME_DURACION ?? 0);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('El tipo de membresía no tiene una duración válida (TME_DURACION)');
  }
  return n;
}

/**
 * Exige vehículo existente, cliente asignado (CLI_ID) y cliente activo.
 * Si falta cliente: err.code = VEH_SIN_CLIENTE (para UI).
 */
async function validateVehiculoParaMembresia(vehId) {
  if (vehId == null || vehId === '') return;
  const rows = await executeSql(
    `SELECT v.VEH_ID, v.CLI_ID, c.CLI_ACTIVO
       FROM PAR_VEHICULO v
       LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE v.VEH_ID = :vehId`,
    { vehId }
  );
  const row = rows[0];
  if (!row) throw new Error('El vehículo indicado no existe');
  if (row.CLI_ID == null) {
    const err = new Error(
      'Debes asignar un cliente al vehículo antes de registrar la membresía.'
    );
    err.code = 'VEH_SIN_CLIENTE';
    err.VEH_ID = row.VEH_ID;
    throw err;
  }
  if (Number(row.CLI_ACTIVO ?? 1) !== 1) {
    throw new Error(
      'No se puede crear la membresía: el cliente vinculado a este vehículo está inactivo. ' +
        'Reactiva al cliente desde el listado de clientes o elige un vehículo asociado a un cliente activo.'
    );
  }
}

async function isMembresiaIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_MEMBRESIA' AND COLUMN_NAME='MEM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function hasMemCodigoColumn() {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME='PAR_MEMBRESIA' AND COLUMN_NAME='MEM_CODIGO'`
  );
  return Number(rows[0]?.TOTAL || 0) > 0;
}

async function persistMemCodigo(memId, fechaInicio) {
  const memCodigo = buildMemCodigo(memId, fechaInicio ? new Date(fechaInicio) : new Date());
  await executeSql(
    `UPDATE PAR_MEMBRESIA
        SET MEM_CODIGO = :memCodigo
      WHERE MEM_ID = :memId`,
    { memCodigo, memId },
    { autoCommit: true }
  );
  return { memCodigo, persisted: true };
}

export async function create(data) {
  const memCodigoEnabled = await hasMemCodigoColumn();
  if (!memCodigoEnabled) {
    throw new Error('Falta la columna MEM_CODIGO en PAR_MEMBRESIA. Esta HU requiere persistir ese valor en base de datos.');
  }
  await validateVehiculoParaMembresia(data.VEH_ID);
  let espId = data.ESP_ID;
  if (espId == null || String(espId).trim() === '') {
    let conn;
    try {
      conn = await getConnection();
      espId = await assignDynamicMembershipSpaceTx(conn);
    } finally {
      if (conn) await conn.close();
    }
  }
  await validateEspacioDisponible(espId);
  const now = new Date();
  const fechaInicio = data.MEM_FECHA_INICIO ? new Date(data.MEM_FECHA_INICIO) : now;
  const diasTipo = await loadDuracionTipoMembresia(data.TME_ID);
  const fechaVencimiento = addDaysCalendar(fechaInicio, diasTipo);
  const useIdentity = (await isMembresiaIdentityAlways()) || !data.MEM_ID;

  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_MEMBRESIA (
         TME_ID, MEM_FECHA_INICIO, EME_ID, MEM_FECHA_VENCIMIENTO,
         MEM_FECHA_ULTIMO_CAMBIO_ESTADO, VEH_ID, ESP_ID
       ) VALUES (
         :TME_ID, :MEM_FECHA_INICIO, :EME_ID, :MEM_FECHA_VENCIMIENTO,
         :MEM_FECHA_ULTIMO_CAMBIO_ESTADO, :VEH_ID, :ESP_ID
       )`,
      {
        TME_ID: data.TME_ID ?? null,
        MEM_FECHA_INICIO: fechaInicio,
        EME_ID: data.EME_ID ?? null,
        MEM_FECHA_VENCIMIENTO: fechaVencimiento,
        MEM_FECHA_ULTIMO_CAMBIO_ESTADO: data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO
          ? new Date(data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO)
          : now,
        VEH_ID: data.VEH_ID ?? null,
        ESP_ID: espId ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT MEM_ID
         FROM PAR_MEMBRESIA
        WHERE VEH_ID = :vehId AND ESP_ID = :espId
        ORDER BY MEM_ID DESC`,
      { vehId: data.VEH_ID ?? null, espId: espId ?? null }
    );
    const memId = rows[0]?.MEM_ID;
    if (!memId) return null;
    const persisted = await persistMemCodigo(memId, fechaInicio);
    try {
      await afterMembresiaCreatedSetEspacioReservadoLibre(espId);
    } catch (e) {
      await insertSystemAlerta({
        motivo: 'Membresía creada pero no se actualizó estado del espacio',
        descripcion: `ESP_ID ${espId}: ${e?.message || e}`,
      });
    }
    const created = await getById(memId);
    return { ...created, MEM_CODIGO: persisted.memCodigo, MEM_CODIGO_PERSISTED: persisted.persisted };
  }

  await executeProcedure(
    `BEGIN SP_MEMBRESIA_CREATE(:MEM_ID, :TME_ID, :MEM_FECHA_INICIO, :EME_ID, :MEM_FECHA_VENCIMIENTO, :MEM_FECHA_ULTIMO_CAMBIO_ESTADO, :VEH_ID, :ESP_ID); END;`,
    {
      MEM_ID: data.MEM_ID ?? null,
      TME_ID: data.TME_ID ?? null,
      MEM_FECHA_INICIO: fechaInicio,
      EME_ID: data.EME_ID ?? null,
      MEM_FECHA_VENCIMIENTO: fechaVencimiento,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO: data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO
        ? new Date(data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO)
        : now,
      VEH_ID: data.VEH_ID ?? null,
      ESP_ID: espId ?? null,
    }
  );
  const persisted = await persistMemCodigo(data.MEM_ID, fechaInicio);
  try {
    await afterMembresiaCreatedSetEspacioReservadoLibre(espId);
  } catch (e) {
    await insertSystemAlerta({
      motivo: 'Membresía creada pero no se actualizó estado del espacio',
      descripcion: `ESP_ID ${espId}: ${e?.message || e}`,
    });
  }
  const created = await getById(data.MEM_ID);
  return { ...created, MEM_CODIGO: persisted.memCodigo, MEM_CODIGO_PERSISTED: persisted.persisted };
}

export async function update(id, data) {
  const current = await getById(id);
  if (!current) throw new Error('Membresia no encontrada');

  const nextVehId = data.VEH_ID != null ? data.VEH_ID : current.VEH_ID;
  if (String(nextVehId ?? '') !== String(current.VEH_ID ?? '')) {
    await validateVehiculoParaMembresia(nextVehId);
  }

  const willChangeStatus =
    data.EME_ID != null && String(data.EME_ID) !== String(current.EME_ID ?? '');

  const nextTmeId = data.TME_ID != null ? data.TME_ID : current.TME_ID;
  let memFechaVencimiento;
  if (String(nextTmeId ?? '') !== String(current.TME_ID ?? '')) {
    const dias = await loadDuracionTipoMembresia(nextTmeId);
    const inicio = current.MEM_FECHA_INICIO ? new Date(current.MEM_FECHA_INICIO) : new Date();
    memFechaVencimiento = addDaysCalendar(inicio, dias);
  } else if (current.MEM_FECHA_VENCIMIENTO) {
    memFechaVencimiento = new Date(current.MEM_FECHA_VENCIMIENTO);
  } else {
    const dias = await loadDuracionTipoMembresia(nextTmeId);
    const inicio = current.MEM_FECHA_INICIO ? new Date(current.MEM_FECHA_INICIO) : new Date();
    memFechaVencimiento = addDaysCalendar(inicio, dias);
  }

  await executeProcedure(
    `BEGIN SP_MEMBRESIA_UPDATE(:id, :TME_ID, :EME_ID, :MEM_FECHA_VENCIMIENTO, :MEM_FECHA_ULTIMO_CAMBIO_ESTADO, :VEH_ID, :ESP_ID); END;`,
    {
      id,
      TME_ID: nextTmeId ?? null,
      EME_ID: data.EME_ID ?? current.EME_ID ?? null,
      MEM_FECHA_VENCIMIENTO: memFechaVencimiento,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO:
        data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO
          ? new Date(data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO)
          : (willChangeStatus ? new Date() : (current.MEM_FECHA_ULTIMO_CAMBIO_ESTADO ? new Date(current.MEM_FECHA_ULTIMO_CAMBIO_ESTADO) : null)),
      VEH_ID: data.VEH_ID ?? current.VEH_ID ?? null,
      ESP_ID: data.ESP_ID ?? current.ESP_ID ?? null,
    }
  );
  return getById(id);
}

export async function getTagData(memId) {
  const rows = await executeSql(
    `SELECT m.MEM_ID, m.MEM_FECHA_INICIO, m.MEM_FECHA_VENCIMIENTO,
            tm.TME_TIPO,
            v.VEH_PLACA,
            c.CLI_CORREO,
            c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE,
            c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO
     FROM PAR_MEMBRESIA m
     JOIN PAR_TIPO_MEMBRESIA tm ON tm.TME_ID = m.TME_ID
     JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
     LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
     WHERE m.MEM_ID = :memId`,
    { memId }
  );
  return rows[0] || null;
}

export async function generateTagPdf(memId) {
  const row = await getTagData(memId);
  if (!row) throw new Error('Membresia no encontrada para generar tag');

  const clienteNombre = [
    row.CLI_PRIMER_NOMBRE,
    row.CLI_SEGUNDO_NOMBRE,
    row.CLI_PRIMER_APELLIDO,
    row.CLI_SEGUNDO_APELLIDO,
  ]
    .filter(Boolean)
    .join(' ');

  const memCodigo = buildMemCodigo(memId, row.MEM_FECHA_INICIO ? new Date(row.MEM_FECHA_INICIO) : new Date());

  const pdfBuffer = await buildTagPdfBuffer({
    memCodigo,
    clienteNombre,
    vehPlaca: row.VEH_PLACA,
    planNombre: row.TME_TIPO,
    vigencia: row.MEM_FECHA_VENCIMIENTO
      ? new Date(row.MEM_FECHA_VENCIMIENTO).toLocaleDateString('es-GT')
      : 'N/D',
  });

  return {
    memCodigo,
    pdfBuffer,
    fileName: `tag-${memCodigo}.pdf`,
    email: row.CLI_CORREO || null,
  };
}

export async function sendMembershipTag(memId) {
  const tag = await generateTagPdf(memId);
  if (!tag.email) throw new Error('El cliente no tiene correo registrado');

  await sendTagMail({
    to: tag.email,
    subject: `Tag de membresia ${tag.memCodigo}`,
    text: `Adjunto se envia el tag de su membresia (${tag.memCodigo}).`,
    filename: tag.fileName,
    pdfBuffer: tag.pdfBuffer,
  });
  return { sent: true, email: tag.email, memCodigo: tag.memCodigo };
}

export async function searchPaymentCandidates(query) {
  const raw = String(query || '').trim().toUpperCase().replace(/\s+/g, '');
  const q = `%${raw}%`;
  return executeSql(
    `${MEM_SELECT_SQL}
     WHERE UPPER(REPLACE(TRIM(NVL(v.VEH_PLACA, '')), ' ', '')) LIKE :q
     ORDER BY m.MEM_FECHA_VENCIMIENTO`,
    { q }
  );
}

async function findEstadoActivaId(fallbackId) {
  const rows = await executeSql(
    `SELECT EME_ID
     FROM PAR_ESTADO_MEMBRESIA
     WHERE LOWER(EME_ESTADO) LIKE '%activ%'
     ORDER BY EME_ID`
  );
  return rows[0]?.EME_ID ?? fallbackId ?? null;
}

async function pagoIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_PAGO' AND COLUMN_NAME='PAG_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function detallePagoMemIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_PAGO_MEMBRESIA' AND COLUMN_NAME='DPM_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function registerMonthlyPayment(memId, payload) {
  const membership = await getById(memId);
  if (!membership) throw new Error('Membresia no encontrada');

  if (!payload?.TPA_ID) throw new Error('TPA_ID es requerido para registrar pago');

  const montoTotal = Number(membership.TME_PRECIO || 0);
  if (!(montoTotal > 0)) throw new Error('No se pudo determinar el monto vigente de membresia');

  const pagRecibido = Number(payload.PAG_MONTO_RECIBIDO ?? montoTotal);
  const pagVuelto = Number(payload.PAG_VUELTO ?? Math.max(0, pagRecibido - montoTotal));
  const now = new Date();
  let pagId;
  let dpmId;

  const diasTipo = await loadDuracionTipoMembresia(membership.TME_ID);
  /** La renovación cuenta la duración del plan desde la fecha del pago, no desde el vencimiento anterior (evita “arrastrar” periodos ya vencidos). */
  const baseDate = addDaysCalendar(now, diasTipo);

  const estado = norm(membership.EME_ESTADO);
  const suspended = estado.includes('suspend') || estado.includes('inactiv');
  const wantReactivate =
    payload.REACTIVATE_IF_SUSPENDED !== false && payload.REACTIVATE_IF_SUSPENDED !== 0;
  let emeId = membership.EME_ID;
  if (suspended && wantReactivate) {
    emeId = await findEstadoActivaId(emeId);
  }
  let conn;
  try {
    conn = await getConnection();

    if (await pagoIdentityAlwaysTx(conn)) {
      const insPag = await conn.execute(
        `INSERT INTO PAR_PAGO (TPA_ID, PAG_MONTO_TOTAL, PAG_MONTO_RECIBIDO, PAG_VUELTO, PAG_FECHA_HORA)
         VALUES (:TPA_ID, :PAG_MONTO_TOTAL, :PAG_MONTO_RECIBIDO, :PAG_VUELTO, :PAG_FECHA_HORA)
         RETURNING PAG_ID INTO :pagIdOut`,
        {
          TPA_ID: payload.TPA_ID,
          PAG_MONTO_TOTAL: montoTotal,
          PAG_MONTO_RECIBIDO: pagRecibido,
          PAG_VUELTO: pagVuelto,
          PAG_FECHA_HORA: now,
          pagIdOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      pagId = insPag.outBinds?.pagIdOut?.[0];
    } else {
      pagId = payload.PAG_ID ?? Number((await conn.execute(`SELECT NVL(MAX(PAG_ID), 0) + 1 AS N FROM PAR_PAGO`)).rows?.[0]?.N || 1);
      await conn.execute(
        `INSERT INTO PAR_PAGO (PAG_ID, TPA_ID, PAG_MONTO_TOTAL, PAG_MONTO_RECIBIDO, PAG_VUELTO, PAG_FECHA_HORA)
         VALUES (:PAG_ID, :TPA_ID, :PAG_MONTO_TOTAL, :PAG_MONTO_RECIBIDO, :PAG_VUELTO, :PAG_FECHA_HORA)`,
        {
          PAG_ID: pagId,
          TPA_ID: payload.TPA_ID,
          PAG_MONTO_TOTAL: montoTotal,
          PAG_MONTO_RECIBIDO: pagRecibido,
          PAG_VUELTO: pagVuelto,
          PAG_FECHA_HORA: now,
        }
      );
    }

    if (pagId == null) throw new Error('No se pudo obtener PAG_ID tras insertar el pago');

    if (await detallePagoMemIdentityAlwaysTx(conn)) {
      const insDpm = await conn.execute(
        `INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (MEM_ID, PAG_ID, DPM_MES_CANCELADO)
         VALUES (:MEM_ID, :PAG_ID, :DPM_MES_CANCELADO)
         RETURNING DPM_ID INTO :dpmIdOut`,
        {
          MEM_ID: memId,
          PAG_ID: pagId,
          DPM_MES_CANCELADO: Number(payload.DPM_MES_CANCELADO ?? now.getMonth() + 1),
          dpmIdOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        }
      );
      dpmId = insDpm.outBinds?.dpmIdOut?.[0];
    } else {
      dpmId =
        payload.DPM_ID ??
        Number((await conn.execute(`SELECT NVL(MAX(DPM_ID), 0) + 1 AS N FROM PAR_DETALLE_PAGO_MEMBRESIA`)).rows?.[0]?.N || 1);
      await conn.execute(
        `INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (DPM_ID, MEM_ID, PAG_ID, DPM_MES_CANCELADO)
         VALUES (:DPM_ID, :MEM_ID, :PAG_ID, :DPM_MES_CANCELADO)`,
        {
          DPM_ID: dpmId,
          MEM_ID: memId,
          PAG_ID: pagId,
          DPM_MES_CANCELADO: Number(payload.DPM_MES_CANCELADO ?? now.getMonth() + 1),
        }
      );
    }

    if (dpmId == null) throw new Error('No se pudo obtener DPM_ID tras insertar el detalle de pago');

    await conn.execute(
      `UPDATE PAR_MEMBRESIA
          SET EME_ID = :EME_ID,
              MEM_FECHA_VENCIMIENTO = :MEM_FECHA_VENCIMIENTO,
              MEM_FECHA_ULTIMO_CAMBIO_ESTADO = :MEM_FECHA_ULTIMO_CAMBIO_ESTADO
        WHERE MEM_ID = :MEM_ID`,
      {
        EME_ID: emeId,
        MEM_FECHA_VENCIMIENTO: baseDate,
        MEM_FECHA_ULTIMO_CAMBIO_ESTADO: now,
        MEM_ID: memId,
      }
    );

    await conn.commit();
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }

  return {
    MEM_ID: memId,
    PAG_ID: pagId,
    DPM_ID: dpmId,
    MEM_FECHA_VENCIMIENTO: baseDate.toISOString(),
    REACTIVATED: suspended && wantReactivate,
  };
}

export async function getMembershipHistory(memId) {
  const membership = await getById(memId);
  if (!membership) throw new Error('Membresia no encontrada');

  const movimientos = await executeSql(
    `SELECT RMM_ID, RMM_FECHA_HORA_ENTRADA, RMM_FECHA_HORA_SALIDA
       FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
      WHERE MEM_ID = :memId
      ORDER BY RMM_ID DESC`,
    { memId }
  );

  const pagos = await executeSql(
    `SELECT d.DPM_ID, d.DPM_MES_CANCELADO,
            p.PAG_ID, p.TPA_ID, p.PAG_MONTO_TOTAL, p.PAG_MONTO_RECIBIDO, p.PAG_VUELTO, p.PAG_FECHA_HORA
       FROM PAR_DETALLE_PAGO_MEMBRESIA d
       JOIN PAR_PAGO p ON p.PAG_ID = d.PAG_ID
      WHERE d.MEM_ID = :memId
      ORDER BY p.PAG_ID DESC`,
    { memId }
  );

  return {
    membership: {
      MEM_ID: membership.MEM_ID,
      VEH_PLACA: membership.VEH_PLACA,
      EME_ESTADO: membership.EME_ESTADO,
      MEM_FECHA_VENCIMIENTO: membership.MEM_FECHA_VENCIMIENTO,
    },
    movimientos,
    pagos,
  };
}

function membershipStatusText(row) {
  return String(row?.EME_ESTADO || '').trim().toLowerCase();
}

function isMembershipActive(row) {
  const s = membershipStatusText(row);
  return s.includes('activ') && !s.includes('inactiv');
}

function isMembershipSuspended(row) {
  const s = membershipStatusText(row);
  return s.includes('suspend') || s.includes('inactiv');
}

function isMembershipExpired(row) {
  if (!row?.MEM_FECHA_VENCIMIENTO) return false;
  const venc = new Date(row.MEM_FECHA_VENCIMIENTO);
  if (Number.isNaN(venc.getTime())) return false;
  const V = new Date(venc.getFullYear(), venc.getMonth(), venc.getDate());
  const n = new Date();
  const T = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return T.getTime() > V.getTime();
}

/** Alineado al job diario: vence por calendario y sin pago posterior → estado suspendido. */
async function suspendMembershipIfPastVencimientoForEntry(memId) {
  const suspRows = await executeSql(
    `SELECT EME_ID FROM PAR_ESTADO_MEMBRESIA
      WHERE LOWER(EME_ESTADO) LIKE '%suspend%'
      ORDER BY EME_ID FETCH FIRST 1 ROW ONLY`,
  );
  const suspId = suspRows[0]?.EME_ID ?? suspRows[0]?.eme_id;
  if (suspId == null || memId == null) return;
  await executeSql(
    `UPDATE PAR_MEMBRESIA m
        SET EME_ID = :suspId,
            MEM_FECHA_ULTIMO_CAMBIO_ESTADO = SYSDATE
      WHERE m.MEM_ID = :memId
        AND TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
        AND m.EME_ID <> :suspId2
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
            JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
           WHERE dpm.MEM_ID = m.MEM_ID
             AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
        )`,
    { suspId, memId, suspId2: suspId },
    { autoCommit: true },
  );
}

export async function validateTagAndRegisterEntry(memCodigoRaw, opts = {}) {
  const memCodigo = String(memCodigoRaw || '').trim().toUpperCase();
  if (!memCodigo) throw new Error('MEM_CODIGO es requerido');

  let maqIdAutoriza = null;
  const rawMaq = opts?.MAQ_ID;
  if (rawMaq != null && String(rawMaq).trim() !== '') {
    const mid = Number(String(rawMaq).trim());
    if (!Number.isFinite(mid) || mid <= 0) throw new Error('MAQ_ID inválido');
    const mrows = await executeSql(
      `SELECT m.MAQ_ID, t.TMA_TIPO
         FROM PAR_MAQUINA m
         JOIN PAR_TIPO_MAQUINA t ON t.TMA_ID = m.TMA_ID
        WHERE m.MAQ_ID = :id`,
      { id: mid },
    );
    if (!mrows[0]) throw new Error('Máquina no encontrada');
    if (!isTipoMaquinaEntrada(mrows[0].TMA_TIPO)) {
      throw new Error('La máquina indicada no es de entrada');
    }
    maqIdAutoriza = mid;
  }

  const withColumn = await hasMemCodigoColumn();
  const row = withColumn
    ? await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(m.MEM_CODIGO)) = UPPER(TRIM(:memCodigo))`,
      { memCodigo }
    )
    : await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(:memCodigo)) = UPPER(TRIM(
         LPAD(EXTRACT(DAY FROM m.MEM_FECHA_INICIO), 2, '0') ||
         LPAD(EXTRACT(MONTH FROM m.MEM_FECHA_INICIO), 2, '0') ||
         SUBSTR(TO_CHAR(EXTRACT(YEAR FROM m.MEM_FECHA_INICIO)), -2) ||
         TO_CHAR(m.MEM_ID)
       ))`,
      { memCodigo }
    );
  let membership = row[0];
  if (!membership) throw new Error('Tag no reconocido');

  const memId0 = membership.MEM_ID ?? membership.mem_id;
  await suspendMembershipIfPastVencimientoForEntry(memId0);
  const rowFresh = withColumn
    ? await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(m.MEM_CODIGO)) = UPPER(TRIM(:memCodigo))`,
      { memCodigo }
    )
    : await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(:memCodigo)) = UPPER(TRIM(
         LPAD(EXTRACT(DAY FROM m.MEM_FECHA_INICIO), 2, '0') ||
         LPAD(EXTRACT(MONTH FROM m.MEM_FECHA_INICIO), 2, '0') ||
         SUBSTR(TO_CHAR(EXTRACT(YEAR FROM m.MEM_FECHA_INICIO)), -2) ||
         TO_CHAR(m.MEM_ID)
       ))`,
      { memCodigo }
    );
  membership = rowFresh[0] || membership;

  if (isMembershipSuspended(membership)) {
    throw new Error(
      'Acceso denegado: la membresía está suspendida (periodo vencido). Renueva el pago en la máquina de cobro, sección «Pagar membresía».',
    );
  }
  if (isMembershipExpired(membership)) {
    throw new Error(
      'Acceso denegado: la membresía está vencida. Renueva el pago en la máquina de cobro, sección «Pagar membresía».',
    );
  }
  if (!isMembershipActive(membership)) {
    throw new Error('Acceso denegado: la membresía no está activa.');
  }

  const openEntrada = await executeSql(
    `SELECT RMM_ID
       FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
      WHERE MEM_ID = :memId
        AND RMM_FECHA_HORA_ENTRADA IS NOT NULL
        AND RMM_FECHA_HORA_SALIDA IS NULL`,
    { memId: membership.MEM_ID }
  );
  if (openEntrada.length > 0) {
    throw new Error(
      'Ya hay un ingreso activo para esta membresía. Registre la salida antes de volver a entrar.'
    );
  }

  const espId = membership.ESP_ID ?? membership.esp_id;
  const entrada = new Date();
  let conn;
  try {
    conn = await getConnection();
    const rmmIdentity = await conn.execute(
      `SELECT GENERATION_TYPE FROM USER_TAB_IDENTITY_COLS
        WHERE TABLE_NAME='PAR_REGISTRO_MOVIMIENTO_MEMBRESIA' AND COLUMN_NAME='RMM_ID'`,
    );
    const useId = String(rmmIdentity.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
    if (useId) {
      await conn.execute(
        `INSERT INTO PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
          (RMM_FECHA_HORA_ENTRADA, RMM_FECHA_HORA_SALIDA, MEM_ID)
         VALUES
          (:entrada, NULL, :memId)`,
        { entrada, memId: membership.MEM_ID },
      );
    } else {
      const nxt = await conn.execute(
        `SELECT NVL(MAX(RMM_ID), 0) + 1 AS N FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA`,
      );
      const rmmId = Number(nxt.rows?.[0]?.N || 1);
      await conn.execute(
        `INSERT INTO PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
          (RMM_ID, RMM_FECHA_HORA_ENTRADA, RMM_FECHA_HORA_SALIDA, MEM_ID)
         VALUES
          (:rmmId, :entrada, NULL, :memId)`,
        { rmmId, entrada, memId: membership.MEM_ID },
      );
    }
    await setMembresiaEspacioReservadoOcupadoTx(conn, espId);
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

  return {
    access: 'granted',
    message: 'Acceso concedido',
    MEM_ID: membership.MEM_ID,
    MEM_CODIGO: memCodigo,
    VEH_PLACA: membership.VEH_PLACA,
    EME_ESTADO: membership.EME_ESTADO,
    MAQ_ID: maqIdAutoriza,
  };
}

export async function validateTagAndRegisterExit(memCodigoRaw) {
  const memCodigo = String(memCodigoRaw || '').trim().toUpperCase();
  if (!memCodigo) throw new Error('MEM_CODIGO es requerido');

  const withColumn = await hasMemCodigoColumn();
  const row = withColumn
    ? await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(m.MEM_CODIGO)) = UPPER(TRIM(:memCodigo))`,
      { memCodigo }
    )
    : await executeSql(
      `${MEM_SELECT_SQL}
       WHERE UPPER(TRIM(:memCodigo)) = UPPER(TRIM(
         LPAD(EXTRACT(DAY FROM m.MEM_FECHA_INICIO), 2, '0') ||
         LPAD(EXTRACT(MONTH FROM m.MEM_FECHA_INICIO), 2, '0') ||
         SUBSTR(TO_CHAR(EXTRACT(YEAR FROM m.MEM_FECHA_INICIO)), -2) ||
         TO_CHAR(m.MEM_ID)
       ))`,
      { memCodigo }
    );
  const membership = row[0];
  if (!membership) throw new Error('Tag no reconocido');

  const activeRows = await executeSql(
    `SELECT RMM_ID, RMM_FECHA_HORA_ENTRADA, RMM_FECHA_HORA_SALIDA
       FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
      WHERE MEM_ID = :memId
        AND RMM_FECHA_HORA_ENTRADA IS NOT NULL
        AND RMM_FECHA_HORA_SALIDA IS NULL
      ORDER BY RMM_FECHA_HORA_ENTRADA DESC`,
    { memId: membership.MEM_ID }
  );
  const active = activeRows[0];
  if (!active) throw new Error('No se encontró un ingreso activo asociado');

  const espId = membership.ESP_ID ?? membership.esp_id;
  const now = new Date();
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
          SET RMM_FECHA_HORA_SALIDA = :salida
        WHERE RMM_ID = :rmmId`,
      {
        salida: now,
        rmmId: active.RMM_ID ?? active.rmm_id,
      },
    );
    await setMembresiaEspacioReservadoLibreTx(conn, espId);
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

  return {
    access: 'granted',
    message: 'Salida registrada',
    MEM_ID: membership.MEM_ID,
    MEM_CODIGO: memCodigo,
    RMM_ID: active.RMM_ID ?? active.rmm_id,
    RMM_FECHA_HORA_ENTRADA: active.RMM_FECHA_HORA_ENTRADA ?? active.rmm_fecha_hora_entrada,
    RMM_FECHA_HORA_SALIDA: now.toISOString(),
    VEH_PLACA: membership.VEH_PLACA,
  };
}
