import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ALERTA_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ALERTA_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_ALERTA_CREATE(
      :ALE_ID, :MAQ_ID, :ALE_MOTIVO, :ALE_DESCRIPCION, 
      :ALE_FECHA_HORA_GENERACION, :EAL_ID, :TAL_ID, :ALE_FECHA_ATENCION
    ); END;`,
    {
      ALE_ID: data.ALE_ID,
      MAQ_ID: data.MAQ_ID ?? null,
      ALE_MOTIVO: data.ALE_MOTIVO,
      ALE_DESCRIPCION: data.ALE_DESCRIPCION ?? null,
      ALE_FECHA_HORA_GENERACION: data.ALE_FECHA_HORA_GENERACION,
      EAL_ID: data.EAL_ID,
      TAL_ID: data.TAL_ID,
      ALE_FECHA_ATENCION: data.ALE_FECHA_ATENCION ?? null,
    }
  );
  return getById(data.ALE_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_ALERTA_UPDATE(
      :id, :EAL_ID, :ALE_FECHA_ATENCION
    ); END;`,
    {
      id,
      EAL_ID: data.EAL_ID,
      ALE_FECHA_ATENCION: data.ALE_FECHA_ATENCION ?? null,
    }
  );
  return getById(id);
}
