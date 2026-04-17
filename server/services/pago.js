import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_PAGO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_PAGO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_PAGO' AND COLUMN_NAME='PAG_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.PAG_ID) {
    await executeSql(
      `INSERT INTO PAR_PAGO (
         TPA_ID, PAG_MONTO_TOTAL, PAG_MONTO_RECIBIDO, PAG_VUELTO, PAG_FECHA_HORA
       ) VALUES (
         :TPA_ID, :PAG_MONTO_TOTAL, :PAG_MONTO_RECIBIDO, :PAG_VUELTO, :PAG_FECHA_HORA
       )`,
      {
        TPA_ID: data.TPA_ID ?? null,
        PAG_MONTO_TOTAL: data.PAG_MONTO_TOTAL ?? null,
        PAG_MONTO_RECIBIDO: data.PAG_MONTO_RECIBIDO ?? null,
        PAG_VUELTO: data.PAG_VUELTO ?? null,
        PAG_FECHA_HORA: data.PAG_FECHA_HORA ? new Date(data.PAG_FECHA_HORA) : new Date(),
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT PAG_ID
         FROM PAR_PAGO
        WHERE TPA_ID = :tpaId
        ORDER BY PAG_ID DESC`,
      { tpaId: data.TPA_ID ?? null }
    );
    return rows[0] ? getById(rows[0].PAG_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_PAGO_CREATE(:PAG_ID, :TPA_ID, :PAG_MONTO_TOTAL, :PAG_MONTO_RECIBIDO, :PAG_VUELTO, :PAG_FECHA_HORA); END;`,
    {
      PAG_ID: data.PAG_ID ?? null,
      TPA_ID: data.TPA_ID ?? null,
      PAG_MONTO_TOTAL: data.PAG_MONTO_TOTAL ?? null,
      PAG_MONTO_RECIBIDO: data.PAG_MONTO_RECIBIDO ?? null,
      PAG_VUELTO: data.PAG_VUELTO ?? null,
      PAG_FECHA_HORA: data.PAG_FECHA_HORA ? new Date(data.PAG_FECHA_HORA) : new Date(),
    }
  );
  return getById(data.PAG_ID);
}
