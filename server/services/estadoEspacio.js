import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ESTADO_ESPACIO_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ESTADO_ESPACIO_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ EES_ID, EES_ESTADO }) {
  await executeProcedure(
    `BEGIN SP_ESTADO_ESPACIO_CREATE(:EES_ID, :EES_ESTADO); END;`,
    { EES_ID, EES_ESTADO }
  );
  return getById(EES_ID);
}
