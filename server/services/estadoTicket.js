import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESTADO_TICKET' AND COLUMN_NAME='ETI_ID'`
  );
  const isAlways = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
  if (isAlways || !data.ETI_ID) {
    await executeSql(
      `INSERT INTO PAR_ESTADO_TICKET (ETI_ESTADO) VALUES (:ETI_ESTADO)`,
      { ETI_ESTADO: data.ETI_ESTADO ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT ETI_ID FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = :estado ORDER BY ETI_ID DESC`,
      { estado: data.ETI_ESTADO ?? null }
    );
    return rows[0] ? getById(rows[0].ETI_ID) : null;
  }
  await executeProcedure(`BEGIN SP_ESTADO_TICKET_CREATE(:ETI_ID, :ETI_ESTADO); END;`, {
    ETI_ID: data.ETI_ID ?? null,
    ETI_ESTADO: data.ETI_ESTADO ?? null,
  });
  return getById(data.ETI_ID);
}
