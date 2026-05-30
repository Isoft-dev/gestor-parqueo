import { executeSql } from '../db/oracle.js';

const BASE_SELECT = `
  SELECT COL_ID, COL_NOMBRE, COL_DESCRIPCION
    FROM PAR_COLOR_VEHICULO
`;

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_COLOR_VEHICULO' AND COLUMN_NAME='COL_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function getAll() {
  return executeSql(`${BASE_SELECT} ORDER BY COL_NOMBRE, COL_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${BASE_SELECT} WHERE COL_ID = :id`, { id });
  return rows[0] || null;
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.COL_ID) {
    await executeSql(
      `INSERT INTO PAR_COLOR_VEHICULO (COL_NOMBRE, COL_DESCRIPCION)
       VALUES (:COL_NOMBRE, :COL_DESCRIPCION)`,
      {
        COL_NOMBRE: data.COL_NOMBRE ?? null,
        COL_DESCRIPCION: data.COL_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT COL_ID
         FROM PAR_COLOR_VEHICULO
        WHERE UPPER(TRIM(COL_NOMBRE)) = UPPER(TRIM(:nombre))
        ORDER BY COL_ID DESC`,
      { nombre: data.COL_NOMBRE ?? null }
    );
    return rows[0] ? getById(rows[0].COL_ID) : null;
  }

  await executeSql(
    `INSERT INTO PAR_COLOR_VEHICULO (COL_ID, COL_NOMBRE, COL_DESCRIPCION)
     VALUES (:COL_ID, :COL_NOMBRE, :COL_DESCRIPCION)`,
    {
      COL_ID: data.COL_ID ?? null,
      COL_NOMBRE: data.COL_NOMBRE ?? null,
      COL_DESCRIPCION: data.COL_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(data.COL_ID);
}

export async function update(id, data) {
  await executeSql(
    `UPDATE PAR_COLOR_VEHICULO
        SET COL_NOMBRE = :COL_NOMBRE,
            COL_DESCRIPCION = :COL_DESCRIPCION
      WHERE COL_ID = :id`,
    {
      id,
      COL_NOMBRE: data.COL_NOMBRE ?? null,
      COL_DESCRIPCION: data.COL_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(id);
}

export async function deleteItem(id) {
  const result = await executeSql(
    `DELETE FROM PAR_COLOR_VEHICULO WHERE COL_ID = :id`,
    { id },
    { autoCommit: true }
  );
  return Number(result?.rowsAffected || 0) > 0;
}
