import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

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
  await executeProcedure(
    `BEGIN SP_TIPO_MAQUINA_CREATE(:TMA_ID, :TMA_TIPO, :TMA_DESCRIPCION); END;`,
    { TMA_ID, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null }
  );
  return getById(TMA_ID);
}

export async function update(id, { TMA_TIPO, TMA_DESCRIPCION }) {
  await executeProcedure(
    `BEGIN SP_TIPO_MAQUINA_UPDATE(:id, :TMA_TIPO, :TMA_DESCRIPCION); END;`,
    { id, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null }
  );
  return getById(id);
}

export async function remove(id) {
  return executeDelete(
    `BEGIN SP_TIPO_MAQUINA_DELETE(:id, :deleted); END;`,
    { id }
  );
}
