import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_REGISTRO_MOV_MEM_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_REGISTRO_MOV_MEM_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_REGISTRO_MOVIMIENTO_MEMBRESIA'
        AND COLUMN_NAME = 'RMM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.RMM_ID) {
    await executeSql(
      `INSERT INTO PAR_REGISTRO_MOVIMIENTO_MEMBRESIA (
         RMM_FECHA_HORA_ENTRADA, RMM_FECHA_HORA_SALIDA, MEM_ID
       ) VALUES (
         :RMM_FECHA_HORA_ENTRADA, :RMM_FECHA_HORA_SALIDA, :MEM_ID
       )`,
      {
        RMM_FECHA_HORA_ENTRADA: data.RMM_FECHA_HORA_ENTRADA
          ? new Date(data.RMM_FECHA_HORA_ENTRADA)
          : new Date(),
        RMM_FECHA_HORA_SALIDA: data.RMM_FECHA_HORA_SALIDA
          ? new Date(data.RMM_FECHA_HORA_SALIDA)
          : null,
        MEM_ID: data.MEM_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT RMM_ID
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA
        WHERE MEM_ID = :memId
        ORDER BY RMM_ID DESC`,
      { memId: data.MEM_ID }
    );
    return rows[0] ? getById(rows[0].RMM_ID) : null;
  }

  await executeProcedure(
    `BEGIN SP_REGISTRO_MOV_MEM_CREATE(:RMM_ID, :RMM_FECHA_HORA_ENTRADA,
      :RMM_FECHA_HORA_SALIDA, :MEM_ID); END;`,
    {
      RMM_ID:                  data.RMM_ID ?? null,
      RMM_FECHA_HORA_ENTRADA:  data.RMM_FECHA_HORA_ENTRADA
                                 ? new Date(data.RMM_FECHA_HORA_ENTRADA) : new Date(),
      RMM_FECHA_HORA_SALIDA:   data.RMM_FECHA_HORA_SALIDA
                                 ? new Date(data.RMM_FECHA_HORA_SALIDA) : null,
      MEM_ID:                  data.MEM_ID ?? null,
    }
  );
  return getById(data.RMM_ID);
}
