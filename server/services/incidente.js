import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_INCIDENTE_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_INCIDENTE_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_INCIDENTE_CREATE(:INC_ID, :INC_TIPO, :INC_DESCRIPCION); END;`, {
    INC_ID: data.INC_ID ?? null,
    INC_TIPO: data.INC_TIPO ?? null,
    INC_DESCRIPCION: data.INC_DESCRIPCION ?? null,
  });
  return getById(data.INC_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_INCIDENTE_UPDATE(:id, :INC_TIPO, :INC_DESCRIPCION); END;`, {
    id,
    INC_TIPO: data.INC_TIPO ?? null,
    INC_DESCRIPCION: data.INC_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_INCIDENTE_DELETE(:id, :deleted); END;`, { id });
}
