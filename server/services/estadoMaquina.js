import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

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
