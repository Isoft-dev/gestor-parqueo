import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_PAGO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_PAGO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_PAGO_CREATE(:PAG_ID, :TPA_ID, :PAG_MONTO_TOTAL, :PAG_MONTO_RECIBIDO, :PAG_VUELTO, :PAG_FECHA_HORA); END;`,
    {
      PAG_ID: data.PAG_ID ?? null,
      TPA_ID: data.TPA_ID ?? null,
      PAG_MONTO_TOTAL: data.PAG_MONTO_TOTAL ?? null,
      PAG_MONTO_RECIBIDO: data.PAG_MONTO_RECIBIDO ?? null,
      PAG_VUELTO: data.PAG_VUELTO ?? null,
      PAG_FECHA_HORA: data.PAG_FECHA_HORA ? new Date(data.PAG_FECHA_HORA) : new Date(),
    }
  );
  return getById(data.PAG_ID);
}
