import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_REGISTRO_MANTENIMIENTO' AND COLUMN_NAME='REM_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.REM_ID) {
    await executeSql(
      `INSERT INTO PAR_REGISTRO_MANTENIMIENTO (MAQ_ID, REM_MANTENIMIENTO_FECHA, REM_DESCRIPCION)
       VALUES (:MAQ_ID, :REM_MANTENIMIENTO_FECHA, :REM_DESCRIPCION)`,
      {
        MAQ_ID: data.MAQ_ID ?? null,
        REM_MANTENIMIENTO_FECHA: data.REM_MANTENIMIENTO_FECHA
          ? new Date(data.REM_MANTENIMIENTO_FECHA)
          : new Date(),
        REM_DESCRIPCION: data.REM_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT REM_ID
         FROM PAR_REGISTRO_MANTENIMIENTO
        WHERE MAQ_ID = :maqId
        ORDER BY REM_ID DESC`,
      { maqId: data.MAQ_ID ?? null }
    );
    return rows[0] ? getById(rows[0].REM_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_REG_MANTENIMIENTO_CREATE(:REM_ID, :MAQ_ID, :REM_MANTENIMIENTO_FECHA, :REM_DESCRIPCION); END;`,
    {
      REM_ID: data.REM_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
      REM_MANTENIMIENTO_FECHA: data.REM_MANTENIMIENTO_FECHA ? new Date(data.REM_MANTENIMIENTO_FECHA) : null,
      REM_DESCRIPCION: data.REM_DESCRIPCION ?? null,
    }
  );
  return getById(data.REM_ID);
}

export async function getByMachineId(maqId) {
  return executeSql(
    `SELECT r.REM_ID, r.MAQ_ID, m.MAQ_CODIGO,
            r.REM_MANTENIMIENTO_FECHA, r.REM_DESCRIPCION
       FROM PAR_REGISTRO_MANTENIMIENTO r
       JOIN PAR_MAQUINA m ON r.MAQ_ID = m.MAQ_ID
      WHERE r.MAQ_ID = :maqId
      ORDER BY r.REM_MANTENIMIENTO_FECHA DESC, r.REM_ID DESC`,
    { maqId }
  );
}
