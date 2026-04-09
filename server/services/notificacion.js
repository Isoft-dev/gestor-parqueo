import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_NOTIFICACION_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_NOTIFICACION_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_NOTIFICACION' AND COLUMN_NAME='NOT_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.NOT_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_NOTIFICACION
        (TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO, NOT_PROXIMA_FECHA_ENVIO, NOT_EXITO)
       VALUES
        (:TNO_ID, :MEM_ID, :NOT_ULTIMA_FECHA_ENVIO, :NOT_PROXIMA_FECHA_ENVIO, :NOT_EXITO)`,
      {
        TNO_ID: data.TNO_ID ?? null,
        MEM_ID: data.MEM_ID ?? null,
        NOT_ULTIMA_FECHA_ENVIO: data.NOT_ULTIMA_FECHA_ENVIO ? new Date(data.NOT_ULTIMA_FECHA_ENVIO) : null,
        NOT_PROXIMA_FECHA_ENVIO: data.NOT_PROXIMA_FECHA_ENVIO ? new Date(data.NOT_PROXIMA_FECHA_ENVIO) : null,
        NOT_EXITO: data.NOT_EXITO ?? 0,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT NOT_ID FROM PAR_NOTIFICACION
        WHERE MEM_ID = :memId
        ORDER BY NOT_ID DESC`,
      { memId: data.MEM_ID ?? null }
    );
    return rows[0] ? getById(rows[0].NOT_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_NOTIFICACION_CREATE(:NOT_ID, :TNO_ID, :MEM_ID, :NOT_ULTIMA_FECHA_ENVIO, :NOT_PROXIMA_FECHA_ENVIO, :NOT_EXITO); END;`,
    {
      NOT_ID: data.NOT_ID ?? null,
      TNO_ID: data.TNO_ID ?? null,
      MEM_ID: data.MEM_ID ?? null,
      NOT_ULTIMA_FECHA_ENVIO: data.NOT_ULTIMA_FECHA_ENVIO ? new Date(data.NOT_ULTIMA_FECHA_ENVIO) : null,
      NOT_PROXIMA_FECHA_ENVIO: data.NOT_PROXIMA_FECHA_ENVIO ? new Date(data.NOT_PROXIMA_FECHA_ENVIO) : null,
      NOT_EXITO: data.NOT_EXITO ?? 0,
    }
  );
  return getById(data.NOT_ID);
}
