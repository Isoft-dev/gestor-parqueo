import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_DETALLE_SALDO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_DETALLE_SALDO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_DETALLE_SALDO_CREATE(:DSA_ID, :DSA_CANTIDAD, :DSA_SUBTOTAL, :SDI_ID, :MAQ_ID); END;`,
    {
      DSA_ID: data.DSA_ID ?? null,
      DSA_CANTIDAD: data.DSA_CANTIDAD ?? null,
      DSA_SUBTOTAL: data.DSA_SUBTOTAL ?? null,
      SDI_ID: data.SDI_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
    }
  );
  return getById(data.DSA_ID);
}
