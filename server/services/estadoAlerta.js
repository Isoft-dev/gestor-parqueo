import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESTADO_ALERTA' AND COLUMN_NAME='EAL_ID'`
  );
  const isAlways = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
  if (isAlways || !data.EAL_ID) {
    await executeSql(
      `INSERT INTO PAR_ESTADO_ALERTA (EAL_ESTADO, EAL_DESCRIPCION)
       VALUES (:EAL_ESTADO, :EAL_DESCRIPCION)`,
      {
        EAL_ESTADO: data.EAL_ESTADO ?? null,
        EAL_DESCRIPCION: data.EAL_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT EAL_ID FROM PAR_ESTADO_ALERTA WHERE EAL_ESTADO = :estado ORDER BY EAL_ID DESC`,
      { estado: data.EAL_ESTADO ?? null }
    );
    return rows[0] ? getById(rows[0].EAL_ID) : null;
  }
  await executeProcedure(`BEGIN SP_ESTADO_ALERTA_CREATE(:EAL_ID, :EAL_ESTADO, :EAL_DESCRIPCION); END;`, {
    EAL_ID: data.EAL_ID ?? null,
    EAL_ESTADO: data.EAL_ESTADO ?? null,
    EAL_DESCRIPCION: data.EAL_DESCRIPCION ?? null,
  });
  return getById(data.EAL_ID);
}

