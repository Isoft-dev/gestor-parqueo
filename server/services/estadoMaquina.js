import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ESTADO_MAQUINA_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ESTADO_MAQUINA_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ EMA_ID, EMA_ESTADO, EMA_DESCRIPCION }) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESTADO_MAQUINA' AND COLUMN_NAME='EMA_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !EMA_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_ESTADO_MAQUINA (EMA_ESTADO, EMA_DESCRIPCION)
       VALUES (:EMA_ESTADO, :EMA_DESCRIPCION)`,
      { EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT EMA_ID
         FROM PAR_ESTADO_MAQUINA
        WHERE EMA_ESTADO = :estado
        ORDER BY EMA_ID DESC`,
      { estado: EMA_ESTADO }
    );
    return rows[0] ? getById(rows[0].EMA_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_ESTADO_MAQUINA_CREATE(:EMA_ID, :EMA_ESTADO, :EMA_DESCRIPCION); END;`,
    { EMA_ID, EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null }
  );
  return getById(EMA_ID);
}

export async function update(id, { EMA_ESTADO, EMA_DESCRIPCION }) {
  await executeProcedure(
    `BEGIN SP_ESTADO_MAQUINA_UPDATE(:id, :EMA_ESTADO, :EMA_DESCRIPCION); END;`,
    { id, EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null }
  );
  return getById(id);
}

export async function remove(id) {
  return executeDelete(
    `BEGIN SP_ESTADO_MAQUINA_DELETE(:id, :deleted); END;`,
    { id }
  );
}
