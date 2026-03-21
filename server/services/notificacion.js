import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_NOTIFICACION_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_NOTIFICACION_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_NOTIFICACION_CREATE(:NOT_ID, :TNO_ID, :MEM_ID, :NOT_ULTIMA_FECHA_ENVIO, :NOT_PROXIMA_FECHA_ENVIO, :NOT_EXITO); END;`,
    {
      NOT_ID: data.NOT_ID ?? null,
      TNO_ID: data.TNO_ID ?? null,
      MEM_ID: data.MEM_ID ?? null,
      NOT_ULTIMA_FECHA_ENVIO: data.NOT_ULTIMA_FECHA_ENVIO ? new Date(data.NOT_ULTIMA_FECHA_ENVIO) : null,
      NOT_PROXIMA_FECHA_ENVIO: data.NOT_PROXIMA_FECHA_ENVIO ? new Date(data.NOT_PROXIMA_FECHA_ENVIO) : null,
      NOT_EXITO: data.NOT_EXITO ?? 0,
    }
  );
  return getById(data.NOT_ID);
}
