import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ROL_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ROL_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ ROL_ID, ROL_TIPO, ROL_DESCRIPCION }) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ROL' AND COLUMN_NAME='ROL_ID'`
  );
  const isAlways = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
  if (isAlways || !ROL_ID) {
    await executeSql(
      `INSERT INTO PAR_ROL (ROL_TIPO, ROL_DESCRIPCION)
       VALUES (:ROL_TIPO, :ROL_DESCRIPCION)`,
      { ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT ROL_ID FROM PAR_ROL WHERE ROL_TIPO = :tipo ORDER BY ROL_ID DESC`,
      { tipo: ROL_TIPO }
    );
    return rows[0] ? getById(rows[0].ROL_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_ROL_CREATE(:ROL_ID, :ROL_TIPO, :ROL_DESCRIPCION); END;`,
    { ROL_ID, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null }
  );
  return getById(ROL_ID);
}

export async function update(id, { ROL_TIPO, ROL_DESCRIPCION }) {
  const current = await getById(id);
  if (!current) return null;
  await executeProcedure(
    `BEGIN SP_ROL_UPDATE(:id, :ROL_TIPO, :ROL_DESCRIPCION); END;`,
    {
      id,
      ROL_TIPO: ROL_TIPO ?? current.ROL_TIPO,
      ROL_DESCRIPCION: ROL_DESCRIPCION ?? current.ROL_DESCRIPCION ?? null,
    }
  );
  return getById(id);
}

export async function remove(id) {
  return executeDelete(
    `BEGIN SP_ROL_DELETE(:id, :deleted); END;`,
    { id }
  );
}
