import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

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
  await executeProcedure(
    `BEGIN SP_ROL_CREATE(:ROL_ID, :ROL_TIPO, :ROL_DESCRIPCION); END;`,
    { ROL_ID, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null }
  );
  return getById(ROL_ID);
}

export async function update(id, { ROL_TIPO, ROL_DESCRIPCION }) {
  await executeProcedure(
    `BEGIN SP_ROL_UPDATE(:id, :ROL_TIPO, :ROL_DESCRIPCION); END;`,
    { id, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null }
  );
  return getById(id);
}

export async function remove(id) {
  return executeDelete(
    `BEGIN SP_ROL_DELETE(:id, :deleted); END;`,
    { id }
  );
}
