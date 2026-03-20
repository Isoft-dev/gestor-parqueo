import { executeCursor, executeProcedure, executeDelete } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_PAGO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_PAGO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_PAGO_CREATE(:TPA_ID, :TPA_TIPO, :TPA_DESCRIPCION); END;`, {
    TPA_ID: data.TPA_ID ?? null,
    TPA_TIPO: data.TPA_TIPO ?? null,
    TPA_DESCRIPCION: data.TPA_DESCRIPCION ?? null,
  });
  return getById(data.TPA_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_PAGO_UPDATE(:id, :TPA_TIPO, :TPA_DESCRIPCION); END;`, {
    id,
    TPA_TIPO: data.TPA_TIPO ?? null,
    TPA_DESCRIPCION: data.TPA_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_PAGO_DELETE(:id, :deleted); END;`, { id });
}
