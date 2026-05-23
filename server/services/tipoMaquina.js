import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_TIPO_MAQUINA_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_TIPO_MAQUINA_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ TMA_ID, TMA_TIPO, TMA_DESCRIPCION }) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_MAQUINA' AND COLUMN_NAME='TMA_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !TMA_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TIPO_MAQUINA (TMA_TIPO, TMA_DESCRIPCION)
       VALUES (:TMA_TIPO, :TMA_DESCRIPCION)`,
      { TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TMA_ID
         FROM PAR_TIPO_MAQUINA
        WHERE TMA_TIPO = :tipo
        ORDER BY TMA_ID DESC`,
      { tipo: TMA_TIPO }
    );
    return rows[0] ? getById(rows[0].TMA_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_TIPO_MAQUINA_CREATE(:TMA_ID, :TMA_TIPO, :TMA_DESCRIPCION); END;`,
    { TMA_ID, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null }
  );
  return getById(TMA_ID);
}

export async function update(id, { TMA_DESCRIPCION }) {
  const current = await getById(id);
  if (!current) throw new Error('Tipo de maquina no encontrado');
  await executeProcedure(
    `BEGIN SP_TIPO_MAQUINA_UPDATE(:id, :TMA_TIPO, :TMA_DESCRIPCION); END;`,
    {
      id,
      TMA_TIPO: current.TMA_TIPO ?? null,
      TMA_DESCRIPCION: TMA_DESCRIPCION ?? current.TMA_DESCRIPCION ?? null,
    }
  );
  return getById(id);
}

export async function remove(id) {
  return executeDelete(
    `BEGIN SP_TIPO_MAQUINA_DELETE(:id, :deleted); END;`,
    { id }
  );
}
