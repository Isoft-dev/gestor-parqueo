import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_VEHICULO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_VEHICULO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function findByPlaca(placa, excludeId = null) {
  if (!placa) return null;
  const rows = await executeSql(
    `SELECT VEH_ID, VEH_PLACA
     FROM PAR_VEHICULO
     WHERE UPPER(VEH_PLACA) = UPPER(:placa)
       AND (:excludeId IS NULL OR VEH_ID <> :excludeId)`,
    { placa, excludeId }
  );
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_VEHICULO' AND COLUMN_NAME='VEH_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  const existingPlaca = await findByPlaca(data.VEH_PLACA);
  if (existingPlaca) throw new Error('Ya existe un vehiculo con la misma VEH_PLACA');

  if ((await isIdentityAlways()) || !data.VEH_ID) {
    await executeSql(
      `INSERT INTO PAR_VEHICULO (VEH_PLACA, VEH_MODELO, VEH_COLOR, TVE_ID, CLI_ID)
       VALUES (:VEH_PLACA, :VEH_MODELO, :VEH_COLOR, :TVE_ID, :CLI_ID)`,
      {
        VEH_PLACA: data.VEH_PLACA ?? null,
        VEH_MODELO: data.VEH_MODELO ?? null,
        VEH_COLOR: data.VEH_COLOR ?? null,
        TVE_ID: data.TVE_ID ?? null,
        CLI_ID: data.CLI_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT VEH_ID
         FROM PAR_VEHICULO
        WHERE UPPER(VEH_PLACA) = UPPER(:placa)
        ORDER BY VEH_ID DESC`,
      { placa: data.VEH_PLACA ?? null }
    );
    return rows[0] ? getById(rows[0].VEH_ID) : null;
  }

  await executeProcedure(`BEGIN SP_VEHICULO_CREATE(:VEH_ID, :VEH_PLACA, :VEH_MODELO, :VEH_COLOR, :TVE_ID, :CLI_ID); END;`, {
    VEH_ID: data.VEH_ID ?? null,
    VEH_PLACA: data.VEH_PLACA ?? null,
    VEH_MODELO: data.VEH_MODELO ?? null,
    VEH_COLOR: data.VEH_COLOR ?? null,
    TVE_ID: data.TVE_ID ?? null,
    CLI_ID: data.CLI_ID ?? null,
  });
  return getById(data.VEH_ID);
}

export async function update(id, data) {
  const existingPlaca = await findByPlaca(data.VEH_PLACA, id);
  if (existingPlaca) throw new Error('Ya existe otro vehiculo con la misma VEH_PLACA');
  await executeProcedure(`BEGIN SP_VEHICULO_UPDATE(:id, :VEH_PLACA, :VEH_MODELO, :VEH_COLOR, :TVE_ID, :CLI_ID); END;`, {
    id,
    VEH_PLACA: data.VEH_PLACA ?? null,
    VEH_MODELO: data.VEH_MODELO ?? null,
    VEH_COLOR: data.VEH_COLOR ?? null,
    TVE_ID: data.TVE_ID ?? null,
    CLI_ID: data.CLI_ID ?? null,
  });
  return getById(id);
}

