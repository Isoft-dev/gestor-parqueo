import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TICKET_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TICKET_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TICKET' AND COLUMN_NAME='TIC_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.TIC_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TICKET
        (TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID, COB_ID)
       VALUES
        (:TIC_CODIGO, :VEH_ID, :TIC_FECHA_HORA_ENTRADA, :TIC_FECHA_HORA_SALIDA, :ETI_ID, :COB_ID)`,
      {
        TIC_CODIGO: data.TIC_CODIGO ?? null,
        VEH_ID: data.VEH_ID ?? null,
        TIC_FECHA_HORA_ENTRADA: data.TIC_FECHA_HORA_ENTRADA ? new Date(data.TIC_FECHA_HORA_ENTRADA) : null,
        TIC_FECHA_HORA_SALIDA: data.TIC_FECHA_HORA_SALIDA ? new Date(data.TIC_FECHA_HORA_SALIDA) : null,
        ETI_ID: data.ETI_ID ?? null,
        COB_ID: data.COB_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TIC_ID FROM PAR_TICKET
        WHERE TIC_CODIGO = :codigo
        ORDER BY TIC_ID DESC`,
      { codigo: data.TIC_CODIGO ?? null }
    );
    return rows[0] ? getById(rows[0].TIC_ID) : null;
  }
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
