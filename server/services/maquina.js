import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_MAQUINA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_MAQUINA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_MAQUINA_CREATE(:MAQ_ID, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
    {
      MAQ_ID: data.MAQ_ID ?? null,
      MAQ_CODIGO: data.MAQ_CODIGO ?? null,
      TMA_ID: data.TMA_ID ?? null,
      EMA_ID: data.EMA_ID ?? null,
      MAQ_FECHA_ULTIMA_RECARGA: data.MAQ_FECHA_ULTIMA_RECARGA ? new Date(data.MAQ_FECHA_ULTIMA_RECARGA) : null,
    }
  );
  return getById(data.MAQ_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_MAQUINA_UPDATE(:id, :MAQ_CODIGO, :TMA_ID, :EMA_ID, :MAQ_FECHA_ULTIMA_RECARGA); END;`,
    {
      id,
      MAQ_CODIGO: data.MAQ_CODIGO ?? null,
      TMA_ID: data.TMA_ID ?? null,
      EMA_ID: data.EMA_ID ?? null,
      MAQ_FECHA_ULTIMA_RECARGA: data.MAQ_FECHA_ULTIMA_RECARGA ? new Date(data.MAQ_FECHA_ULTIMA_RECARGA) : null,
    }
  );
  return getById(id);
}
