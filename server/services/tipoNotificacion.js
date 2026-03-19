import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_NOTIF_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_NOTIF_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_NOTIF_CREATE(:TNO_ID, :TNO_TIPO, :TNO_DESCRIPCION); END;`, {
    TNO_ID: data.TNO_ID ?? null,
    TNO_TIPO: data.TNO_TIPO ?? null,
    TNO_DESCRIPCION: data.TNO_DESCRIPCION ?? null,
  });
  return getById(data.TNO_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_NOTIF_UPDATE(:id, :TNO_TIPO, :TNO_DESCRIPCION); END;`, {
    id,
    TNO_TIPO: data.TNO_TIPO ?? null,
    TNO_DESCRIPCION: data.TNO_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_NOTIF_DELETE(:id, :deleted); END;`, { id });
}
