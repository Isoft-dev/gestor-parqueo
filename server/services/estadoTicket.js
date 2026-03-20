import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ESTADO_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(`BEGIN SP_ESTADO_TICKET_CREATE(:ETI_ID, :ETI_ESTADO); END;`, {
    ETI_ID: data.ETI_ID ?? null,
    ETI_ESTADO: data.ETI_ESTADO ?? null,
  });
  return getById(data.ETI_ID);
}
