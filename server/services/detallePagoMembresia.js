import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_DET_PAGO_MEM_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_DET_PAGO_MEM_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_DET_PAGO_MEM_CREATE(:DPM_ID, :MEM_ID, :PAG_ID, :DPM_MES_CANCELADO); END;`,
    {
      DPM_ID: data.DPM_ID ?? null,
      MEM_ID: data.MEM_ID ?? null,
      PAG_ID: data.PAG_ID ?? null,
      DPM_MES_CANCELADO: data.DPM_MES_CANCELADO ?? null,
    }
  );
  return getById(data.DPM_ID);
}
