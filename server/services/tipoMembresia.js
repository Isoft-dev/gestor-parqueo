import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_MEMBRESIA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_MEMBRESIA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_MEMBRESIA' AND COLUMN_NAME='TME_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.TME_ID) {
    await executeSql(
      `INSERT INTO PAR_TIPO_MEMBRESIA (TME_TIPO, TME_DESCRIPCION, TME_DURACION, TME_PRECIO)
       VALUES (:TME_TIPO, :TME_DESCRIPCION, :TME_DURACION, :TME_PRECIO)`,
      {
        TME_TIPO: data.TME_TIPO ?? null,
        TME_DESCRIPCION: data.TME_DESCRIPCION ?? null,
        TME_DURACION: data.TME_DURACION ?? null,
        TME_PRECIO: data.TME_PRECIO ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TME_ID
         FROM PAR_TIPO_MEMBRESIA
        WHERE TME_TIPO = :tipo
        ORDER BY TME_ID DESC`,
      { tipo: data.TME_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TME_ID) : null;
  }

  await executeProcedure(`BEGIN SP_TIPO_MEMBRESIA_CREATE(:TME_ID, :TME_TIPO, :TME_DESCRIPCION, :TME_DURACION, :TME_PRECIO); END;`, {
    TME_ID: data.TME_ID ?? null,
    TME_TIPO: data.TME_TIPO ?? null,
    TME_DESCRIPCION: data.TME_DESCRIPCION ?? null,
    TME_DURACION: data.TME_DURACION ?? null,
    TME_PRECIO: data.TME_PRECIO ?? null,
  });
  return getById(data.TME_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_MEMBRESIA_UPDATE(:id, :TME_TIPO, :TME_DESCRIPCION, :TME_DURACION, :TME_PRECIO); END;`, {
    id,
    TME_TIPO: data.TME_TIPO ?? null,
    TME_DESCRIPCION: data.TME_DESCRIPCION ?? null,
    TME_DURACION: data.TME_DURACION ?? null,
    TME_PRECIO: data.TME_PRECIO ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_MEMBRESIA_DELETE(:id, :deleted); END;`, { id });
}

