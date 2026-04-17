import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_MAQUINA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_MAQUINA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_MAQUINA' AND COLUMN_NAME='MAQ_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.MAQ_ID) {
    await executeSql(
      `INSERT INTO PAR_MAQUINA (MAQ_CODIGO, TMA_ID, EMA_ID, MAQ_FECHA_ULTIMA_RECARGA)
       VALUES (:MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA)`,
      {
        MAQ_CODIGO: data.MAQ_CODIGO ?? null,
        TMA_ID: data.TMA_ID ?? null,
        EMA_ID: data.EMA_ID ?? null,
        MAQ_FECHA_ULTIMA_RECARGA: data.MAQ_FECHA_ULTIMA_RECARGA
          ? new Date(data.MAQ_FECHA_ULTIMA_RECARGA)
          : null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT MAQ_ID FROM PAR_MAQUINA WHERE MAQ_CODIGO = :codigo ORDER BY MAQ_ID DESC`,
      { codigo: data.MAQ_CODIGO ?? null }
    );
    return rows[0] ? getById(rows[0].MAQ_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_MAQUINA_CREATE(:MAQ_ID, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
    {
      MAQ_ID: data.MAQ_ID ?? null,
      MAQ_CODIGO: data.MAQ_CODIGO ?? null,
      TMA_ID: data.TMA_ID ?? null,
      EMA_ID: data.EMA_ID ?? null,
      MAQ_FECHA_ULTIMA_RECARGA: data.MAQ_FECHA_ULTIMA_RECARGA ? new Date(data.MAQ_FECHA_ULTIMA_RECARGA) : null,
    }
  );
  return getById(data.MAQ_ID);
}

export async function getTransactionsByMaqId(maqId) {
  return executeSql(
    `SELECT d.DMT_ID, d.DMT_TRANSACCION, d.DMT_HORA_TRANSACCION,
            d.TIC_ID, t.TIC_CODIGO,
            d.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_MAQUINA_TICKET d
       JOIN PAR_TICKET t ON d.TIC_ID = t.TIC_ID
       JOIN PAR_MAQUINA m ON d.MAQ_ID = m.MAQ_ID
      WHERE d.MAQ_ID = :maqId
      ORDER BY d.DMT_HORA_TRANSACCION DESC`,
    { maqId }
  );
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_MAQUINA_UPDATE(:id, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
    {
      id,
      MAQ_CODIGO: data.MAQ_CODIGO ?? null,
      TMA_ID: data.TMA_ID ?? null,
      EMA_ID: data.EMA_ID ?? null,
      MAQ_FECHA_ULTIMA_RECARGA: data.MAQ_FECHA_ULTIMA_RECARGA ? new Date(data.MAQ_FECHA_ULTIMA_RECARGA) : null,
    }
  );
  return getById(id);
}
