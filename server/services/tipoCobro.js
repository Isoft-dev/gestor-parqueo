import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_COBRO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_COBRO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_COBRO_CREATE(:TCO_ID, :TCO_TIPO, :TCO_DESCRIPCION); END;`, {
    TCO_ID: data.TCO_ID ?? null,
    TCO_TIPO: data.TCO_TIPO ?? null,
    TCO_DESCRIPCION: data.TCO_DESCRIPCION ?? null,
  });
  return getById(data.TCO_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_COBRO_UPDATE(:id, :TCO_TIPO, :TCO_DESCRIPCION); END;`, {
    id,
    TCO_TIPO: data.TCO_TIPO ?? null,
    TCO_DESCRIPCION: data.TCO_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_COBRO_DELETE(:id, :deleted); END;`, { id });
}

