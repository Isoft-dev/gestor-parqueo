import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_REGISTRO_MOV_MEM_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_REGISTRO_MOV_MEM_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_REGISTRO_MOV_MEM_CREATE(:RMM_ID, :RMM_FECHA_HORA_ENTRADA,
      :RMM_FECHA_HORA_SALIDA, :MEM_ID); END;`,
    {
      RMM_ID:                  data.RMM_ID ?? null,
      RMM_FECHA_HORA_ENTRADA:  data.RMM_FECHA_HORA_ENTRADA
                                 ? new Date(data.RMM_FECHA_HORA_ENTRADA) : new Date(),
      RMM_FECHA_HORA_SALIDA:   data.RMM_FECHA_HORA_SALIDA
                                 ? new Date(data.RMM_FECHA_HORA_SALIDA) : null,
      MEM_ID:                  data.MEM_ID ?? null,
    }
  );
  return getById(data.RMM_ID);
}
