import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_TARIFA_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_TARIFA_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_TARIFA_CREATE(
      :TAR_ID, :TAR_TIPO, :TAR_PRECIO
    ); END;`,
    {
      TAR_ID: data.TAR_ID,
      TAR_TIPO: data.TAR_TIPO,
      TAR_PRECIO: data.TAR_PRECIO,
    }
  );
  return getById(data.TAR_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_TARIFA_UPDATE(
      :id, :TAR_TIPO, :TAR_PRECIO
    ); END;`,
    {
      id,
      TAR_TIPO: data.TAR_TIPO,
      TAR_PRECIO: data.TAR_PRECIO,
    }
  );
  return getById(id);
}

export async function remove(id) {
  await executeProcedure(
    `BEGIN SP_TARIFA_DELETE(:id); END;`,
    { id }
  );
}
