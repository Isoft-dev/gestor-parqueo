import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_BITACORA_INC_VEH_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_BITACORA_INC_VEH_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_BITACORA_INC_VEH_CREATE(:BIV_ID, :BIV_DESCRIPCION, :BIV_FECHA_HORA, :VEH_ID, :INC_ID, :BIV_RESUELTO, :BIV_FECHA_RESOLUCION, :USU_ID); END;`,
    {
      BIV_ID: data.BIV_ID ?? null,
      BIV_DESCRIPCION: data.BIV_DESCRIPCION ?? null,
      BIV_FECHA_HORA: data.BIV_FECHA_HORA ? new Date(data.BIV_FECHA_HORA) : new Date(),
      VEH_ID: data.VEH_ID ?? null,
      INC_ID: data.INC_ID ?? null,
      BIV_RESUELTO: data.BIV_RESUELTO ?? 0,
      BIV_FECHA_RESOLUCION: data.BIV_FECHA_RESOLUCION ? new Date(data.BIV_FECHA_RESOLUCION) : null,
      USU_ID: data.USU_ID ?? null,
    }
  );
  return getById(data.BIV_ID);
}

export async function resolve(id, data) {
  await executeProcedure(
    `BEGIN SP_BITACORA_INC_VEH_RESOLVE(:id, :BIV_RESUELTO, :BIV_FECHA_RESOLUCION, :USU_ID); END;`,
    {
      id,
      BIV_RESUELTO: data.BIV_RESUELTO ?? 1,
      BIV_FECHA_RESOLUCION: data.BIV_FECHA_RESOLUCION ? new Date(data.BIV_FECHA_RESOLUCION) : new Date(),
      USU_ID: data.USU_ID ?? null,
    }
  );
  return getById(id);
}
