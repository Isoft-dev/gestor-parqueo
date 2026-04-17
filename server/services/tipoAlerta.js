import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_ALERTA' AND COLUMN_NAME='TAL_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.TAL_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TIPO_ALERTA (TAL_TIPO, TAL_DESCRIPCION)
       VALUES (:TAL_TIPO, :TAL_DESCRIPCION)`,
      {
        TAL_TIPO: data.TAL_TIPO ?? null,
        TAL_DESCRIPCION: data.TAL_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TAL_ID
         FROM PAR_TIPO_ALERTA
        WHERE TAL_TIPO = :tipo
        ORDER BY TAL_ID DESC`,
      { tipo: data.TAL_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TAL_ID) : null;
  }
  await executeProcedure(`BEGIN SP_TIPO_ALERTA_CREATE(:TAL_ID, :TAL_TIPO, :TAL_DESCRIPCION); END;`, {
    TAL_ID: data.TAL_ID ?? null,
    TAL_TIPO: data.TAL_TIPO ?? null,
    TAL_DESCRIPCION: data.TAL_DESCRIPCION ?? null,
  });
  return getById(data.TAL_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_ALERTA_UPDATE(:id, :TAL_TIPO, :TAL_DESCRIPCION); END;`, {
    id,
    TAL_TIPO: data.TAL_TIPO ?? null,
    TAL_DESCRIPCION: data.TAL_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_ALERTA_DELETE(:id, :deleted); END;`, { id });
}

