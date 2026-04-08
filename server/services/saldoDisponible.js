import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_SALDO_DISP_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_SALDO_DISP_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_SALDO_DISP_CREATE(:SDI_ID, :SDI_TIPO, :SDI_VALOR); END;`, {
    SDI_ID: data.SDI_ID ?? null,
    SDI_TIPO: data.SDI_TIPO ?? null,
    SDI_VALOR: data.SDI_VALOR ?? null,
  });
  return getById(data.SDI_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_SALDO_DISP_UPDATE(:id, :SDI_TIPO, :SDI_VALOR); END;`, {
    id,
    SDI_TIPO: data.SDI_TIPO ?? null,
    SDI_VALOR: data.SDI_VALOR ?? null,
  });
  return getById(id);
}
