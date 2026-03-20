import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_MEMBRESIA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_MEMBRESIA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_MEMBRESIA_CREATE(:MEM_ID, :TME_ID, :MEM_FECHA_INICIO, :EME_ID, :MEM_FECHA_VENCIMIENTO, :MEM_FECHA_ULTIMO_CAMBIO_ESTADO, :VEH_ID, :ESP_ID); END;`,
    {
      MEM_ID: data.MEM_ID ?? null,
      TME_ID: data.TME_ID ?? null,
      MEM_FECHA_INICIO: data.MEM_FECHA_INICIO ? new Date(data.MEM_FECHA_INICIO) : null,
      EME_ID: data.EME_ID ?? null,
      MEM_FECHA_VENCIMIENTO: data.MEM_FECHA_VENCIMIENTO ? new Date(data.MEM_FECHA_VENCIMIENTO) : null,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO: data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO ? new Date(data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO) : null,
      VEH_ID: data.VEH_ID ?? null,
      ESP_ID: data.ESP_ID ?? null,
    }
  );
  return getById(data.MEM_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_MEMBRESIA_UPDATE(:id, :TME_ID, :EME_ID, :MEM_FECHA_VENCIMIENTO, :MEM_FECHA_ULTIMO_CAMBIO_ESTADO, :VEH_ID, :ESP_ID); END;`,
    {
      id,
      TME_ID: data.TME_ID ?? null,
      EME_ID: data.EME_ID ?? null,
      MEM_FECHA_VENCIMIENTO: data.MEM_FECHA_VENCIMIENTO ? new Date(data.MEM_FECHA_VENCIMIENTO) : null,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO: data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO ? new Date(data.MEM_FECHA_ULTIMO_CAMBIO_ESTADO) : null,
      VEH_ID: data.VEH_ID ?? null,
      ESP_ID: data.ESP_ID ?? null,
    }
  );
  return getById(id);
}
