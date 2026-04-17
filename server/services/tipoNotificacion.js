import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_NOTIF_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_NOTIF_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_NOTIFICACION' AND COLUMN_NAME='TNO_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.TNO_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
       VALUES (:TNO_TIPO, :TNO_DESCRIPCION)`,
      { TNO_TIPO: data.TNO_TIPO ?? null, TNO_DESCRIPCION: data.TNO_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TNO_ID FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = :tipo ORDER BY TNO_ID DESC`,
      { tipo: data.TNO_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TNO_ID) : null;
  }
  await executeProcedure(`BEGIN SP_TIPO_NOTIF_CREATE(:TNO_ID, :TNO_TIPO, :TNO_DESCRIPCION); END;`, {
    TNO_ID: data.TNO_ID ?? null,
    TNO_TIPO: data.TNO_TIPO ?? null,
    TNO_DESCRIPCION: data.TNO_DESCRIPCION ?? null,
  });
  return getById(data.TNO_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_NOTIF_UPDATE(:id, :TNO_TIPO, :TNO_DESCRIPCION); END;`, {
    id,
    TNO_TIPO: data.TNO_TIPO ?? null,
    TNO_DESCRIPCION: data.TNO_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_NOTIF_DELETE(:id, :deleted); END;`, { id });
}
