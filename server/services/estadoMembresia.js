import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_MEMBRESIA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_MEMBRESIA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_ESTADO_MEMBRESIA'
        AND COLUMN_NAME = 'EME_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.EME_ID) {
    await executeSql(
      `INSERT INTO PAR_ESTADO_MEMBRESIA (EME_ESTADO)
       VALUES (:EME_ESTADO)`,
      { EME_ESTADO: data.EME_ESTADO ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT EME_ID
         FROM PAR_ESTADO_MEMBRESIA
        WHERE EME_ESTADO = :estado
        ORDER BY EME_ID DESC`,
      { estado: data.EME_ESTADO ?? null }
    );
    return rows[0] ? getById(rows[0].EME_ID) : null;
  }

  await executeProcedure(`BEGIN SP_ESTADO_MEMBRESIA_CREATE(:EME_ID, :EME_ESTADO); END;`, {
    EME_ID: data.EME_ID ?? null,
    EME_ESTADO: data.EME_ESTADO ?? null,
  });
  return getById(data.EME_ID);
}

