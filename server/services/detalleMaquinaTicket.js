import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_DET_MAQ_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_DET_MAQ_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_DET_MAQ_TICKET_CREATE(:DMT_ID, :DMT_TRANSACCION, :TIC_ID, :MAQ_ID, :DMT_HORA_TRANSACCION); END;`,
    {
      DMT_ID: data.DMT_ID ?? null,
      DMT_TRANSACCION: data.DMT_TRANSACCION ?? null,
      TIC_ID: data.TIC_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
      DMT_HORA_TRANSACCION: data.DMT_HORA_TRANSACCION ? new Date(data.DMT_HORA_TRANSACCION) : new Date(),
    }
  );
  return getById(data.DMT_ID);
}

export async function getByMachineId(maqId) {
  return executeSql(
    `SELECT d.DMT_ID, d.DMT_TRANSACCION, d.DMT_HORA_TRANSACCION,
            d.TIC_ID, t.TIC_CODIGO,
            d.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_MAQUINA_TICKET d
       JOIN PAR_TICKET t ON d.TIC_ID = t.TIC_ID
       JOIN PAR_MAQUINA m ON d.MAQ_ID = m.MAQ_ID
      WHERE d.MAQ_ID = :maqId
      ORDER BY d.DMT_HORA_TRANSACCION DESC`,
    { maqId }
  );
}
