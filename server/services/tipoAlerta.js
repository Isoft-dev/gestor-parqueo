import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_ALERTA_CREATE(:TAL_ID, :TAL_TIPO, :TAL_DESCRIPCION); END;`, {
    TAL_ID: data.TAL_ID ?? null,
    TAL_TIPO: data.TAL_TIPO ?? null,
    TAL_DESCRIPCION: data.TAL_DESCRIPCION ?? null,
  });
  return getById(data.TAL_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_ALERTA_UPDATE(:id, :TAL_TIPO, :TAL_DESCRIPCION); END;`, {
    id,
    TAL_TIPO: data.TAL_TIPO ?? null,
    TAL_DESCRIPCION: data.TAL_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeProcedure(`BEGIN SP_TIPO_ALERTA_DELETE(:id); END;`, { id });
}

