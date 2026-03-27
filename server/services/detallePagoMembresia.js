import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_DET_PAGO_MEM_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_DET_PAGO_MEM_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_PAGO_MEMBRESIA' AND COLUMN_NAME='DPM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.DPM_ID) {
    await executeSql(
      `INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (MEM_ID, PAG_ID, DPM_MES_CANCELADO)
       VALUES (:MEM_ID, :PAG_ID, :DPM_MES_CANCELADO)`,
      {
        MEM_ID: data.MEM_ID ?? null,
        PAG_ID: data.PAG_ID ?? null,
        DPM_MES_CANCELADO: data.DPM_MES_CANCELADO ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT DPM_ID
         FROM PAR_DETALLE_PAGO_MEMBRESIA
        WHERE MEM_ID = :memId AND PAG_ID = :pagId
        ORDER BY DPM_ID DESC`,
      { memId: data.MEM_ID ?? null, pagId: data.PAG_ID ?? null }
    );
    return rows[0] ? getById(rows[0].DPM_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_DET_PAGO_MEM_CREATE(:DPM_ID, :MEM_ID, :PAG_ID, :DPM_MES_CANCELADO); END;`,
    {
      DPM_ID: data.DPM_ID ?? null,
      MEM_ID: data.MEM_ID ?? null,
      PAG_ID: data.PAG_ID ?? null,
      DPM_MES_CANCELADO: data.DPM_MES_CANCELADO ?? null,
    }
  );
  return getById(data.DPM_ID);
}
