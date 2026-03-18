import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_MEMBRESIA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_MEMBRESIA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_ESTADO_MEMBRESIA_CREATE(:EME_ID, :EME_ESTADO); END;`, {
    EME_ID: data.EME_ID ?? null,
    EME_ESTADO: data.EME_ESTADO ?? null,
  });
  return getById(data.EME_ID);
}

