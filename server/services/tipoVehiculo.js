import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_VEHICULO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_VEHICULO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_TIPO_VEHICULO_CREATE(:TVE_ID, :TVE_TIPO, :TVE_MARCA, :TVE_DESCRIPCION); END;`, {
    TVE_ID: data.TVE_ID ?? null,
    TVE_TIPO: data.TVE_TIPO ?? null,
    TVE_MARCA: data.TVE_MARCA ?? null,
    TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
  });
  return getById(data.TVE_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_VEHICULO_UPDATE(:id, :TVE_TIPO, :TVE_MARCA, :TVE_DESCRIPCION); END;`, {
    id,
    TVE_TIPO: data.TVE_TIPO ?? null,
    TVE_MARCA: data.TVE_MARCA ?? null,
    TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeProcedure(`BEGIN SP_TIPO_VEHICULO_DELETE(:id); END;`, { id });
}

