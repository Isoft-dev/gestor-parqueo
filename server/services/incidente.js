import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_INCIDENTE_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_INCIDENTE_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_INCIDENTE' AND COLUMN_NAME='INC_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.INC_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_INCIDENTE (INC_TIPO, INC_DESCRIPCION)
       VALUES (:INC_TIPO, :INC_DESCRIPCION)`,
      {
        INC_TIPO: data.INC_TIPO ?? null,
        INC_DESCRIPCION: data.INC_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT INC_ID FROM PAR_INCIDENTE WHERE INC_TIPO = :tipo ORDER BY INC_ID DESC`,
      { tipo: data.INC_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].INC_ID) : null;
  }
  await executeProcedure(`BEGIN SP_INCIDENTE_CREATE(:INC_ID, :INC_TIPO, :INC_DESCRIPCION); END;`, {
    INC_ID: data.INC_ID ?? null,
    INC_TIPO: data.INC_TIPO ?? null,
    INC_DESCRIPCION: data.INC_DESCRIPCION ?? null,
  });
  return getById(data.INC_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_INCIDENTE_UPDATE(:id, :INC_TIPO, :INC_DESCRIPCION); END;`, {
    id,
    INC_TIPO: data.INC_TIPO ?? null,
    INC_DESCRIPCION: data.INC_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_INCIDENTE_DELETE(:id, :deleted); END;`, { id });
}
