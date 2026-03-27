import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_ESTADO_ALERTA_CREATE(:EAL_ID, :EAL_ESTADO, :EAL_DESCRIPCION); END;`, {
    EAL_ID: data.EAL_ID ?? null,
    EAL_ESTADO: data.EAL_ESTADO ?? null,
    EAL_DESCRIPCION: data.EAL_DESCRIPCION ?? null,
  });
  return getById(data.EAL_ID);
}

