import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ESTADO_ESPACIO_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ESTADO_ESPACIO_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ EES_ID, EES_ESTADO }) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESTADO_ESPACIO' AND COLUMN_NAME='EES_ID'`
  );
  const isAlways = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
  if (isAlways || !EES_ID) {
    await executeSql(
      `INSERT INTO PAR_ESTADO_ESPACIO (EES_ESTADO) VALUES (:EES_ESTADO)`,
      { EES_ESTADO },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT EES_ID FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = :estado ORDER BY EES_ID DESC`,
      { estado: EES_ESTADO }
    );
    return rows[0] ? getById(rows[0].EES_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_ESTADO_ESPACIO_CREATE(:EES_ID, :EES_ESTADO); END;`,
    { EES_ID, EES_ESTADO }
  );
  return getById(EES_ID);
}
