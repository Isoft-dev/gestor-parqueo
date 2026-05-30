import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

const DPM_LIST_SQL = `SELECT d.DPM_ID,
            d.MEM_ID,
            d.PAG_ID,
            p.PAG_FECHA_HORA,
            v.VEH_PLACA,
            c.CLI_PRIMER_NOMBRE,
            c.CLI_SEGUNDO_NOMBRE,
            c.CLI_PRIMER_APELLIDO,
            c.CLI_SEGUNDO_APELLIDO
       FROM PAR_DETALLE_PAGO_MEMBRESIA d
       JOIN PAR_PAGO p ON p.PAG_ID = d.PAG_ID
       JOIN PAR_MEMBRESIA m ON m.MEM_ID = d.MEM_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID`;

/**
 * Lista detalles pago–membresía (con placa). Si `placa` viene informada, filtra por coincidencia parcial (sin espacios).
 */
export async function getAll(opts = {}) {
  const raw = String(opts.placa ?? '').trim();
  if (!raw) {
    return executeSql(`${DPM_LIST_SQL} ORDER BY d.DPM_ID DESC`);
  }
  const needle = `%${raw.toUpperCase().replace(/\s+/g, '')}%`;
  return executeSql(
    `${DPM_LIST_SQL}
      WHERE UPPER(REPLACE(TRIM(NVL(v.VEH_PLACA, ' ')), ' ', '')) LIKE :placa
      ORDER BY d.DPM_ID DESC`,
    { placa: needle },
  );
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_DET_PAGO_MEM_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_PAGO_MEMBRESIA' AND COLUMN_NAME='DPM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.DPM_ID) {
    await executeSql(
      `INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (MEM_ID, PAG_ID, DPM_MES_CANCELADO)
       VALUES (:MEM_ID, :PAG_ID, :DPM_MES_CANCELADO)`,
      {
        MEM_ID: data.MEM_ID ?? null,
        PAG_ID: data.PAG_ID ?? null,
        DPM_MES_CANCELADO: data.DPM_MES_CANCELADO ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT DPM_ID
         FROM PAR_DETALLE_PAGO_MEMBRESIA
        WHERE MEM_ID = :memId AND PAG_ID = :pagId
        ORDER BY DPM_ID DESC`,
      { memId: data.MEM_ID ?? null, pagId: data.PAG_ID ?? null }
    );
    return rows[0] ? getById(rows[0].DPM_ID) : null;
  }
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
