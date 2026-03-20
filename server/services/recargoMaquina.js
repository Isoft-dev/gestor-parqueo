import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_RECARGO_MAQUINA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_RECARGO_MAQUINA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_RECARGO_MAQUINA_CREATE(:RMA_ID, :MAQ_ID, :RMA_MANTENIMIENTO_FECHA, :RMA_DESCRIPCION); END;`,
    {
      RMA_ID: data.RMA_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
      RMA_MANTENIMIENTO_FECHA: data.RMA_MANTENIMIENTO_FECHA ? new Date(data.RMA_MANTENIMIENTO_FECHA) : null,
      RMA_DESCRIPCION: data.RMA_DESCRIPCION ?? null,
    }
  );
  return getById(data.RMA_ID);
}
