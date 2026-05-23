import { executeCursor, executeSql, getConnection } from '../db/oracle.js';
import { isTipoMaquinaCobro } from '../utils/tipoMaquinaRules.js';
import {
  ensureInoperativeMachineStatusIdTx,
  getMachineStatusByIdTx,
  isMachineStatusMaintenanceName,
} from '../utils/machineStatus.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_MAQUINA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_MAQUINA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_MAQUINA' AND COLUMN_NAME='MAQ_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function isDsaIdentityAlwaysTx(conn) {
  const rows = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_SALDO' AND COLUMN_NAME='DSA_ID'`
  );
  return String(rows.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function hasDsaUmbralColumnTx(conn) {
  const rows = await conn.execute(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'PAR_DETALLE_SALDO'
        AND COLUMN_NAME = 'DSA_UMBRAL_MINIMO'`
  );
  return Number(rows.rows?.[0]?.TOTAL || 0) > 0;
}

async function getNextIdTx(conn, tableName, colName) {
  const r = await conn.execute(
    `SELECT NVL(MAX(${colName}), 0) + 1 AS NEXT_ID FROM ${tableName}`
  );
  return Number(r.rows?.[0]?.NEXT_ID || 1);
}

async function isMaquinaCobroTx(conn, tmaId) {
  if (tmaId == null || String(tmaId).trim() === '') return false;
  const rows = await conn.execute(
    `SELECT TMA_TIPO
       FROM PAR_TIPO_MAQUINA
      WHERE TMA_ID = :id`,
    { id: tmaId }
  );
  return isTipoMaquinaCobro(rows.rows?.[0]?.TMA_TIPO);
}

async function assertManualMachineStatusTransitionAllowedTx(conn, maqId, emaId) {
  if (emaId == null || String(emaId).trim() === '') return;
  const status = await getMachineStatusByIdTx(conn, emaId);
  if (!status) throw new Error('Estado de maquina no encontrado');

  const currentRows = await conn.execute(
    `SELECT m.EMA_ID, em.EMA_ESTADO
       FROM PAR_MAQUINA m
       JOIN PAR_ESTADO_MAQUINA em ON em.EMA_ID = m.EMA_ID
      WHERE m.MAQ_ID = :maqId`,
    { maqId }
  );
  const current = currentRows.rows?.[0] || null;
  const currentIsMaintenance = isMachineStatusMaintenanceName(current?.EMA_ESTADO);
  const nextIsMaintenance = isMachineStatusMaintenanceName(status.EMA_ESTADO);

  if (currentIsMaintenance && nextIsMaintenance) return;
  if (currentIsMaintenance || nextIsMaintenance) {
    throw new Error('El estado Mantenimiento solo debe cambiarse desde Reg. Mantenimiento');
  }
}

function assertMachineImmutableFields(existing, data) {
  if (data.MAQ_CODIGO != null && String(data.MAQ_CODIGO) !== String(existing?.MAQ_CODIGO ?? '')) {
    throw new Error('El codigo de la maquina no puede modificarse');
  }
  if (data.TMA_ID != null && String(data.TMA_ID) !== String(existing?.TMA_ID ?? '')) {
    throw new Error('El tipo de maquina no puede modificarse');
  }
  if (data.MAQ_FECHA_ULTIMA_RECARGA != null && String(data.MAQ_FECHA_ULTIMA_RECARGA).trim() !== '') {
    throw new Error('La ultima recarga solo debe actualizarse desde Recargo Maquina');
  }
}

/** Umbral mínimo inicial por denominación (Q) al crear máquina de cobro. */
function umbralMinimoInicialPorValorSdi(sdiValor) {
  const v = Number(sdiValor);
  if (v === 5) return 20;
  if (v === 10) return 15;
  if (v === 20) return 10;
  if (v === 50) return 10;
  if (v === 100) return 5;
  return 0;
}

async function initializeDetalleSaldoForCobroTx(conn, maqId, tmaId) {
  if (!(await isMaquinaCobroTx(conn, tmaId))) return;

  const includeUmbral = await hasDsaUmbralColumnTx(conn);
  const dsaIdentityAlways = await isDsaIdentityAlwaysTx(conn);
  const missingRows = await conn.execute(
    `SELECT sd.SDI_ID
       FROM PAR_SALDO_DISPONIBLE sd
      WHERE NOT EXISTS (
            SELECT 1
              FROM PAR_DETALLE_SALDO ds
             WHERE ds.MAQ_ID = :maqId
               AND ds.SDI_ID = sd.SDI_ID
      )
      ORDER BY sd.SDI_ID`,
    { maqId }
  );
  const missing = missingRows.rows || [];
  if (!missing.length) return;

  if (dsaIdentityAlways) {
    if (includeUmbral) {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_SALDO (DSA_CANTIDAD, DSA_SUBTOTAL, DSA_UMBRAL_MINIMO, SDI_ID, MAQ_ID)
         SELECT 0, 0,
                CASE NVL(sd.SDI_VALOR, 0)
                  WHEN 5 THEN 20
                  WHEN 10 THEN 15
                  WHEN 20 THEN 10
                  WHEN 50 THEN 10
                  WHEN 100 THEN 5
                  ELSE 0
                END,
                sd.SDI_ID, :maqId
           FROM PAR_SALDO_DISPONIBLE sd
          WHERE NOT EXISTS (
                SELECT 1
                  FROM PAR_DETALLE_SALDO ds
                 WHERE ds.MAQ_ID = :maqId
                   AND ds.SDI_ID = sd.SDI_ID
          )`,
        { maqId }
      );
      return;
    }
    await conn.execute(
      `INSERT INTO PAR_DETALLE_SALDO (DSA_CANTIDAD, DSA_SUBTOTAL, SDI_ID, MAQ_ID)
       SELECT 0, 0, sd.SDI_ID, :maqId
         FROM PAR_SALDO_DISPONIBLE sd
        WHERE NOT EXISTS (
              SELECT 1
                FROM PAR_DETALLE_SALDO ds
               WHERE ds.MAQ_ID = :maqId
                 AND ds.SDI_ID = sd.SDI_ID
        )`,
      { maqId }
    );
    return;
  }

  let nextId = await getNextIdTx(conn, 'PAR_DETALLE_SALDO', 'DSA_ID');
  for (const row of missing) {
    const sdiId = row.SDI_ID;
    const valRes = await conn.execute(
      `SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = :sdiId`,
      { sdiId }
    );
    const sdiValor = Number(valRes.rows?.[0]?.SDI_VALOR ?? 0);
    const umbralIni = includeUmbral ? umbralMinimoInicialPorValorSdi(sdiValor) : 0;
    if (includeUmbral) {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_SALDO (DSA_ID, DSA_CANTIDAD, DSA_SUBTOTAL, DSA_UMBRAL_MINIMO, SDI_ID, MAQ_ID)
         VALUES (:id, 0, 0, :umbral, :sdiId, :maqId)`,
        { id: nextId, sdiId, maqId, umbral: umbralIni }
      );
    } else {
      await conn.execute(
        `INSERT INTO PAR_DETALLE_SALDO (DSA_ID, DSA_CANTIDAD, DSA_SUBTOTAL, SDI_ID, MAQ_ID)
         VALUES (:id, 0, 0, :sdiId, :maqId)`,
        { id: nextId, sdiId, maqId }
      );
    }
    nextId += 1;
  }
}

export async function create(data) {
  const conn = await getConnection();
  try {
    let maqId = data.MAQ_ID ?? null;
    const initialEstadoId = await ensureInoperativeMachineStatusIdTx(conn);
    if (initialEstadoId == null) {
      throw new Error('No se pudo resolver el estado inicial inoperativa para la máquina');
    }
    if ((await isIdentityAlways()) || !maqId) {
      await conn.execute(
        `INSERT INTO PAR_MAQUINA (MAQ_CODIGO, TMA_ID, EMA_ID, MAQ_FECHA_ULTIMA_RECARGA)
         VALUES (:MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA)`,
        {
          MAQ_CODIGO: data.MAQ_CODIGO ?? null,
          TMA_ID: data.TMA_ID ?? null,
          EMA_ID: initialEstadoId,
          MAQ_FECHA_ULTIMA_RECARGA: null,
        }
      );
      const rows = await conn.execute(
        `SELECT MAQ_ID FROM PAR_MAQUINA WHERE MAQ_CODIGO = :codigo ORDER BY MAQ_ID DESC`,
        { codigo: data.MAQ_CODIGO ?? null }
      );
      maqId = rows.rows?.[0]?.MAQ_ID ?? null;
    } else {
      await conn.execute(
        `BEGIN SP_MAQUINA_CREATE(:MAQ_ID, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
        {
          MAQ_ID: maqId,
          MAQ_CODIGO: data.MAQ_CODIGO ?? null,
          TMA_ID: data.TMA_ID ?? null,
          EMA_ID: initialEstadoId,
          MAQ_FECHA_ULTIMA_RECARGA: null,
        }
      );
    }

    if (maqId != null) {
      await initializeDetalleSaldoForCobroTx(conn, maqId, data.TMA_ID ?? null);
    }

    await conn.commit();
    return maqId != null ? getById(maqId) : null;
  } catch (e) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw e;
  } finally {
    try { await conn.close(); } catch { /* ignore */ }
  }
}

export async function getTransactionsByMaqId(maqId) {
  return executeSql(
    `SELECT d.DMT_ID, d.DMT_TRANSACCION, d.DMT_HORA_TRANSACCION,
            d.TIC_ID, t.TIC_CODIGO,
            d.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_MAQUINA_TICKET d
       JOIN PAR_TICKET t ON d.TIC_ID = t.TIC_ID
       JOIN PAR_MAQUINA m ON d.MAQ_ID = m.MAQ_ID
      WHERE d.MAQ_ID = :maqId
      ORDER BY d.DMT_HORA_TRANSACCION DESC`,
    { maqId }
  );
}

export async function update(id, data) {
  const conn = await getConnection();
  try {
    const existing = await getById(id);
    if (!existing) throw new Error('Maquina no encontrada');
    assertMachineImmutableFields(existing, data);
    await assertManualMachineStatusTransitionAllowedTx(conn, id, data.EMA_ID ?? null);
    await conn.execute(
      `BEGIN SP_MAQUINA_UPDATE(:id, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
      {
        id,
        MAQ_CODIGO: existing.MAQ_CODIGO ?? null,
        TMA_ID: existing.TMA_ID ?? null,
        EMA_ID: data.EMA_ID ?? existing.EMA_ID ?? null,
        MAQ_FECHA_ULTIMA_RECARGA: existing.MAQ_FECHA_ULTIMA_RECARGA
          ? new Date(existing.MAQ_FECHA_ULTIMA_RECARGA)
          : null,
      }
    );
    return getById(id);
  } finally {
    try { await conn.close(); } catch { /* ignore */ }
  }
}
