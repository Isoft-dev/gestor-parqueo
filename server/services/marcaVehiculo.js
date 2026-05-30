import { executeSql } from '../db/oracle.js';

const BASE_SELECT = `
  SELECT MAR_ID, MAR_NOMBRE, MAR_DESCRIPCION
    FROM PAR_MARCA_VEHICULO
`;

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_MARCA_VEHICULO' AND COLUMN_NAME='MAR_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function getAll() {
  return executeSql(`${BASE_SELECT} ORDER BY MAR_NOMBRE, MAR_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${BASE_SELECT} WHERE MAR_ID = :id`, { id });
  return rows[0] || null;
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.MAR_ID) {
    await executeSql(
      `INSERT INTO PAR_MARCA_VEHICULO (MAR_NOMBRE, MAR_DESCRIPCION)
       VALUES (:MAR_NOMBRE, :MAR_DESCRIPCION)`,
      {
        MAR_NOMBRE: data.MAR_NOMBRE ?? null,
        MAR_DESCRIPCION: data.MAR_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT MAR_ID
         FROM PAR_MARCA_VEHICULO
        WHERE UPPER(TRIM(MAR_NOMBRE)) = UPPER(TRIM(:nombre))
        ORDER BY MAR_ID DESC`,
      { nombre: data.MAR_NOMBRE ?? null }
    );
    return rows[0] ? getById(rows[0].MAR_ID) : null;
  }

  await executeSql(
    `INSERT INTO PAR_MARCA_VEHICULO (MAR_ID, MAR_NOMBRE, MAR_DESCRIPCION)
     VALUES (:MAR_ID, :MAR_NOMBRE, :MAR_DESCRIPCION)`,
    {
      MAR_ID: data.MAR_ID ?? null,
      MAR_NOMBRE: data.MAR_NOMBRE ?? null,
      MAR_DESCRIPCION: data.MAR_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(data.MAR_ID);
}

export async function update(id, data) {
  await executeSql(
    `UPDATE PAR_MARCA_VEHICULO
        SET MAR_NOMBRE = :MAR_NOMBRE,
            MAR_DESCRIPCION = :MAR_DESCRIPCION
      WHERE MAR_ID = :id`,
    {
      id,
      MAR_NOMBRE: data.MAR_NOMBRE ?? null,
      MAR_DESCRIPCION: data.MAR_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(id);
}

export async function deleteItem(id) {
  const result = await executeSql(
    `DELETE FROM PAR_MARCA_VEHICULO WHERE MAR_ID = :id`,
    { id },
    { autoCommit: true }
  );
  return Number(result?.rowsAffected || 0) > 0;
}
