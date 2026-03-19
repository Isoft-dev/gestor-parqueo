import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_VEHICULO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_VEHICULO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_VEHICULO_CREATE(:VEH_ID, :VEH_PLACA, :VEH_MODELO, :VEH_COLOR, :TVE_ID, :CLI_ID); END;`, {
    VEH_ID: data.VEH_ID ?? null,
    VEH_PLACA: data.VEH_PLACA ?? null,
    VEH_MODELO: data.VEH_MODELO ?? null,
    VEH_COLOR: data.VEH_COLOR ?? null,
    TVE_ID: data.TVE_ID ?? null,
    CLI_ID: data.CLI_ID ?? null,
  });
  return getById(data.VEH_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_VEHICULO_UPDATE(:id, :VEH_PLACA, :VEH_MODELO, :VEH_COLOR, :TVE_ID, :CLI_ID); END;`, {
    id,
    VEH_PLACA: data.VEH_PLACA ?? null,
    VEH_MODELO: data.VEH_MODELO ?? null,
    VEH_COLOR: data.VEH_COLOR ?? null,
    TVE_ID: data.TVE_ID ?? null,
    CLI_ID: data.CLI_ID ?? null,
  });
  return getById(id);
}

