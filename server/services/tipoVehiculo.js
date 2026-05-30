import { executeSql } from '../db/oracle.js';

const BASE_SELECT = `
  SELECT TVE_ID, TVE_TIPO, TVE_DESCRIPCION
    FROM PAR_TIPO_VEHICULO
`;

export async function getAll() {
  return executeSql(`${BASE_SELECT} ORDER BY TVE_TIPO, TVE_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${BASE_SELECT} WHERE TVE_ID = :id`, { id });
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
      `INSERT INTO PAR_TIPO_VEHICULO (TVE_TIPO, TVE_DESCRIPCION)
       VALUES (:TVE_TIPO, :TVE_DESCRIPCION)`,
      {
        TVE_TIPO: data.TVE_TIPO ?? null,
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

  await executeSql(
    `INSERT INTO PAR_TIPO_VEHICULO (TVE_ID, TVE_TIPO, TVE_DESCRIPCION)
     VALUES (:TVE_ID, :TVE_TIPO, :TVE_DESCRIPCION)`,
    {
      TVE_ID: data.TVE_ID ?? null,
      TVE_TIPO: data.TVE_TIPO ?? null,
      TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(data.TVE_ID);
}

export async function update(id, data) {
  await executeSql(
    `UPDATE PAR_TIPO_VEHICULO
        SET TVE_TIPO = :TVE_TIPO,
            TVE_DESCRIPCION = :TVE_DESCRIPCION
      WHERE TVE_ID = :id`,
    {
      id,
      TVE_TIPO: data.TVE_TIPO ?? null,
      TVE_DESCRIPCION: data.TVE_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(id);
}

export async function deleteItem(id) {
  const result = await executeSql(
    `DELETE FROM PAR_TIPO_VEHICULO WHERE TVE_ID = :id`,
    { id },
    { autoCommit: true }
  );
  return Number(result?.rowsAffected || 0) > 0;
}

