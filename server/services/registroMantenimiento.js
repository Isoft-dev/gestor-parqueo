import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_REG_MANTENIMIENTO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
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
