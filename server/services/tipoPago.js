import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_PAGO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_PAGO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_PAGO' AND COLUMN_NAME='TPA_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.TPA_ID) {
    await executeSql(
      `INSERT INTO PAR_TIPO_PAGO (TPA_TIPO, TPA_DESCRIPCION)
       VALUES (:TPA_TIPO, :TPA_DESCRIPCION)`,
      {
        TPA_TIPO: data.TPA_TIPO ?? null,
        TPA_DESCRIPCION: data.TPA_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TPA_ID
         FROM PAR_TIPO_PAGO
        WHERE TPA_TIPO = :tipo
        ORDER BY TPA_ID DESC`,
      { tipo: data.TPA_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TPA_ID) : null;
  }
  await executeProcedure(`BEGIN SP_TIPO_PAGO_CREATE(:TPA_ID, :TPA_TIPO, :TPA_DESCRIPCION); END;`, {
    TPA_ID: data.TPA_ID ?? null,
    TPA_TIPO: data.TPA_TIPO ?? null,
    TPA_DESCRIPCION: data.TPA_DESCRIPCION ?? null,
  });
  return getById(data.TPA_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_PAGO_UPDATE(:id, :TPA_TIPO, :TPA_DESCRIPCION); END;`, {
    id,
    TPA_TIPO: data.TPA_TIPO ?? null,
    TPA_DESCRIPCION: data.TPA_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_PAGO_DELETE(:id, :deleted); END;`, { id });
}
