import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

const RMM_LIST_SQL = `SELECT r.RMM_ID,
            r.RMM_FECHA_HORA_ENTRADA,
            r.RMM_FECHA_HORA_SALIDA,
            r.MEM_ID,
            v.VEH_PLACA
       FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
       JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID`;

/**
 * Lista movimientos de membresía (con placa del vehículo). Si `placa` viene informada,
 * filtra por coincidencia parcial (sin espacios).
 */
export async function getAll(opts = {}) {
  const raw = String(opts.placa ?? '').trim();
  if (!raw) {
    return executeSql(`${RMM_LIST_SQL} ORDER BY r.RMM_ID DESC`);
  }
  const needle = `%${raw.toUpperCase().replace(/\s+/g, '')}%`;
  return executeSql(
    `${RMM_LIST_SQL}
      WHERE UPPER(REPLACE(TRIM(NVL(v.VEH_PLACA, ' ')), ' ', '')) LIKE :placa
      ORDER BY r.RMM_ID DESC`,
    { placa: needle },
  );
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
