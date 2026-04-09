import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_VEHICULO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_VEHICULO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_VEHICULO' AND COLUMN_NAME='TVE_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.TVE_ID) {
    await executeSql(
      `INSERT INTO PAR_TIPO_VEHICULO (TVE_TIPO, TVE_MARCA, TVE_DESCRIPCION)
       VALUES (:TVE_TIPO, :TVE_MARCA, :TVE_DESCRIPCION)`,
      {
        TVE_TIPO: data.TVE_TIPO ?? null,
        TVE_MARCA: data.TVE_MARCA ?? null,
        TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TVE_ID
         FROM PAR_TIPO_VEHICULO
        WHERE TVE_TIPO = :tipo
        ORDER BY TVE_ID DESC`,
      { tipo: data.TVE_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TVE_ID) : null;
  }

  await executeProcedure(`BEGIN SP_TIPO_VEHICULO_CREATE(:TVE_ID, :TVE_TIPO, :TVE_MARCA, :TVE_DESCRIPCION); END;`, {
    TVE_ID: data.TVE_ID ?? null,
    TVE_TIPO: data.TVE_TIPO ?? null,
    TVE_MARCA: data.TVE_MARCA ?? null,
    TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
  });
  return getById(data.TVE_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_TIPO_VEHICULO_UPDATE(:id, :TVE_TIPO, :TVE_MARCA, :TVE_DESCRIPCION); END;`, {
    id,
    TVE_TIPO: data.TVE_TIPO ?? null,
    TVE_MARCA: data.TVE_MARCA ?? null,
    TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  return executeDelete(`BEGIN SP_TIPO_VEHICULO_DELETE(:id, :deleted); END;`, { id });
}

