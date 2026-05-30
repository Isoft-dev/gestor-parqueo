import { executeSql } from '../db/oracle.js';

const BASE_SELECT = `
  SELECT mod.MOD_ID,
         mod.MOD_NOMBRE,
         mod.MOD_DESCRIPCION,
         mod.MAR_ID,
         mar.MAR_NOMBRE,
         mod.TVE_ID,
         tv.TVE_TIPO,
         TRIM(mar.MAR_NOMBRE || ' ' || mod.MOD_NOMBRE || ' - ' || tv.TVE_TIPO) AS MOD_LABEL
    FROM PAR_MODELO_VEHICULO mod
    JOIN PAR_MARCA_VEHICULO mar ON mod.MAR_ID = mar.MAR_ID
    JOIN PAR_TIPO_VEHICULO tv ON mod.TVE_ID = tv.TVE_ID
`;

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_MODELO_VEHICULO' AND COLUMN_NAME='MOD_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function getAll() {
  return executeSql(`${BASE_SELECT} ORDER BY mar.MAR_NOMBRE, mod.MOD_NOMBRE, mod.MOD_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${BASE_SELECT} WHERE mod.MOD_ID = :id`, { id });
  return rows[0] || null;
}

export async function create(data) {
  if ((await isIdentityAlways()) || !data.MOD_ID) {
    await executeSql(
      `INSERT INTO PAR_MODELO_VEHICULO (MOD_NOMBRE, MAR_ID, TVE_ID, MOD_DESCRIPCION)
       VALUES (:MOD_NOMBRE, :MAR_ID, :TVE_ID, :MOD_DESCRIPCION)`,
      {
        MOD_NOMBRE: data.MOD_NOMBRE ?? null,
        MAR_ID: data.MAR_ID ?? null,
        TVE_ID: data.TVE_ID ?? null,
        MOD_DESCRIPCION: data.MOD_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT MOD_ID
         FROM PAR_MODELO_VEHICULO
        WHERE MAR_ID = :marId
          AND TVE_ID = :tveId
          AND UPPER(TRIM(MOD_NOMBRE)) = UPPER(TRIM(:nombre))
        ORDER BY MOD_ID DESC`,
      {
        marId: data.MAR_ID ?? null,
        tveId: data.TVE_ID ?? null,
        nombre: data.MOD_NOMBRE ?? null,
      }
    );
    return rows[0] ? getById(rows[0].MOD_ID) : null;
  }

  await executeSql(
    `INSERT INTO PAR_MODELO_VEHICULO (MOD_ID, MOD_NOMBRE, MAR_ID, TVE_ID, MOD_DESCRIPCION)
     VALUES (:MOD_ID, :MOD_NOMBRE, :MAR_ID, :TVE_ID, :MOD_DESCRIPCION)`,
    {
      MOD_ID: data.MOD_ID ?? null,
      MOD_NOMBRE: data.MOD_NOMBRE ?? null,
      MAR_ID: data.MAR_ID ?? null,
      TVE_ID: data.TVE_ID ?? null,
      MOD_DESCRIPCION: data.MOD_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(data.MOD_ID);
}

export async function update(id, data) {
  await executeSql(
    `UPDATE PAR_MODELO_VEHICULO
        SET MOD_NOMBRE = :MOD_NOMBRE,
            MAR_ID = :MAR_ID,
            TVE_ID = :TVE_ID,
            MOD_DESCRIPCION = :MOD_DESCRIPCION
      WHERE MOD_ID = :id`,
    {
      id,
      MOD_NOMBRE: data.MOD_NOMBRE ?? null,
      MAR_ID: data.MAR_ID ?? null,
      TVE_ID: data.TVE_ID ?? null,
      MOD_DESCRIPCION: data.MOD_DESCRIPCION ?? null,
    },
    { autoCommit: true }
  );
  return getById(id);
}

export async function deleteItem(id) {
  const result = await executeSql(
    `DELETE FROM PAR_MODELO_VEHICULO WHERE MOD_ID = :id`,
    { id },
    { autoCommit: true }
  );
  return Number(result?.rowsAffected || 0) > 0;
}
