import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_TICKET_CREATE(:TIC_ID, :TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID); END;`,
    {
      TIC_ID: data.TIC_ID ?? null,
      TIC_CODIGO: data.TIC_CODIGO ?? null,
      VEH_ID: data.VEH_ID ?? null,
      TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
      COB_ID: data.COB_ID ?? null,
    }
  );
  return getById(data.TIC_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_TICKET_UPDATE(:id, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID); END;`,
    {
      id,
      TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
      ETI_ID: data.ETI_ID ?? null,
      COB_ID: data.COB_ID ?? null,
    }
  );
  return getById(id);
}
