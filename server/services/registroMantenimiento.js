import { executeCursor, executeSql, getConnection } from '../db/oracle.js';
import {
  assertMachineIsInMaintenance,
  assertMaintenanceClosingStatus,
  getMachineWithStatusTx,
  getMachineStatusByIdTx,
  moveMachineToMaintenanceTx,
  setMachineStatusTx,
} from '../utils/machineStatus.js';

function normalizeMaintenanceMovement(value) {
  const x = String(value ?? '').trim().toUpperCase();
  if (!x) return 'INICIO';
  if (x === 'INICIO' || x === 'FINALIZACION') return x;
  throw new Error('REM_TIPO_MOVIMIENTO debe ser INICIO o FINALIZACION');
}

export async function getAll() {
  return executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_REGISTRO_MANTENIMIENTO' AND COLUMN_NAME='REM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  const conn = await getConnection();
  try {
    const maintenanceDate = data.REM_MANTENIMIENTO_FECHA
      ? new Date(data.REM_MANTENIMIENTO_FECHA)
      : new Date();
    const movementType = normalizeMaintenanceMovement(data.REM_TIPO_MOVIMIENTO);
    const resultingEstadoIdRaw = data.REM_ESTADO_RESULTANTE_EMA_ID;
    const resultingEstadoId =
      resultingEstadoIdRaw != null && String(resultingEstadoIdRaw).trim() !== ''
        ? Number(resultingEstadoIdRaw)
        : null;
    const machine = await getMachineWithStatusTx(conn, data.MAQ_ID ?? null);

    if (movementType === 'INICIO') {
      await moveMachineToMaintenanceTx(conn, data.MAQ_ID ?? null);
    } else {
      assertMachineIsInMaintenance(machine, 'finalizar mantenimiento');
      if (!Number.isFinite(resultingEstadoId) || resultingEstadoId == null) {
        throw new Error('REM_ESTADO_RESULTANTE_EMA_ID es requerido al finalizar mantenimiento');
      }
      const resultingStatus = await getMachineStatusByIdTx(conn, resultingEstadoId);
      assertMaintenanceClosingStatus(resultingStatus);
      await setMachineStatusTx(conn, data.MAQ_ID ?? null, resultingEstadoId);
    }

    let remId = data.REM_ID ?? null;
    if ((await isIdentityAlways()) || !remId) {
      await conn.execute(
        `INSERT INTO PAR_REGISTRO_MANTENIMIENTO (
           MAQ_ID, REM_MANTENIMIENTO_FECHA, REM_DESCRIPCION, REM_TIPO_MOVIMIENTO, REM_ESTADO_RESULTANTE_EMA_ID
         )
         VALUES (
           :MAQ_ID, :REM_MANTENIMIENTO_FECHA, :REM_DESCRIPCION, :REM_TIPO_MOVIMIENTO, :REM_ESTADO_RESULTANTE_EMA_ID
         )`,
        {
          MAQ_ID: data.MAQ_ID ?? null,
          REM_MANTENIMIENTO_FECHA: maintenanceDate,
          REM_DESCRIPCION: data.REM_DESCRIPCION ?? null,
          REM_TIPO_MOVIMIENTO: movementType,
          REM_ESTADO_RESULTANTE_EMA_ID: movementType === 'FINALIZACION' ? resultingEstadoId : null,
        }
      );
      const rows = await conn.execute(
        `SELECT REM_ID
           FROM PAR_REGISTRO_MANTENIMIENTO
          WHERE MAQ_ID = :maqId
          ORDER BY REM_ID DESC`,
        { maqId: data.MAQ_ID ?? null }
      );
      remId = rows.rows?.[0]?.REM_ID ?? null;
    } else {
      await conn.execute(
        `INSERT INTO PAR_REGISTRO_MANTENIMIENTO (
           REM_ID, MAQ_ID, REM_MANTENIMIENTO_FECHA, REM_DESCRIPCION, REM_TIPO_MOVIMIENTO, REM_ESTADO_RESULTANTE_EMA_ID
         )
         VALUES (
           :REM_ID, :MAQ_ID, :REM_MANTENIMIENTO_FECHA, :REM_DESCRIPCION, :REM_TIPO_MOVIMIENTO, :REM_ESTADO_RESULTANTE_EMA_ID
         )`,
        {
          REM_ID: remId,
          MAQ_ID: data.MAQ_ID ?? null,
          REM_MANTENIMIENTO_FECHA: maintenanceDate,
          REM_DESCRIPCION: data.REM_DESCRIPCION ?? null,
          REM_TIPO_MOVIMIENTO: movementType,
          REM_ESTADO_RESULTANTE_EMA_ID: movementType === 'FINALIZACION' ? resultingEstadoId : null,
        }
      );
    }

    await conn.commit();
    return remId != null ? getById(remId) : null;
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    try { await conn.close(); } catch { /* ignore */ }
  }
}

export async function getByMachineId(maqId) {
  return executeSql(
    `SELECT r.REM_ID, r.MAQ_ID, m.MAQ_CODIGO,
            r.REM_MANTENIMIENTO_FECHA, r.REM_DESCRIPCION,
            r.REM_TIPO_MOVIMIENTO, r.REM_ESTADO_RESULTANTE_EMA_ID,
            em.EMA_ESTADO AS REM_ESTADO_RESULTANTE
       FROM PAR_REGISTRO_MANTENIMIENTO r
       JOIN PAR_MAQUINA m ON r.MAQ_ID = m.MAQ_ID
       LEFT JOIN PAR_ESTADO_MAQUINA em ON em.EMA_ID = r.REM_ESTADO_RESULTANTE_EMA_ID
      WHERE r.MAQ_ID = :maqId
      ORDER BY r.REM_MANTENIMIENTO_FECHA DESC, r.REM_ID DESC`,
    { maqId }
  );
}

export async function updateDescription(id, data) {
  const remDescripcion =
    data?.REM_DESCRIPCION != null && String(data.REM_DESCRIPCION).trim() !== ''
      ? String(data.REM_DESCRIPCION)
      : null;
  const result = await executeSql(
    `UPDATE PAR_REGISTRO_MANTENIMIENTO
        SET REM_DESCRIPCION = :remDescripcion
      WHERE REM_ID = :id`,
    { id, remDescripcion: remDescripcion },
    { autoCommit: true }
  );
  if (!result?.rowsAffected) return null;
  return getById(id);
}
