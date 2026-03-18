import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_MEMBRESIA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_MEMBRESIA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_MEMBRESIA_CREATE(:TME_ID, :TME_TIPO, :TME_DESCRIPCION, :TME_DURACION, :TME_PRECIO); END;`, {
    TME_ID: data.TME_ID ?? null,
    TME_TIPO: data.TME_TIPO ?? null,
    TME_DESCRIPCION: data.TME_DESCRIPCION ?? null,
    TME_DURACION: data.TME_DURACION ?? null,
    TME_PRECIO: data.TME_PRECIO ?? null,
  });
  return getById(data.TME_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_MEMBRESIA_UPDATE(:id, :TME_TIPO, :TME_DESCRIPCION, :TME_DURACION, :TME_PRECIO); END;`, {
    id,
    TME_TIPO: data.TME_TIPO ?? null,
    TME_DESCRIPCION: data.TME_DESCRIPCION ?? null,
    TME_DURACION: data.TME_DURACION ?? null,
    TME_PRECIO: data.TME_PRECIO ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeProcedure(`BEGIN SP_TIPO_MEMBRESIA_DELETE(:id); END;`, { id });
}

