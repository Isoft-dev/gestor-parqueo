import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_ESPACIO_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ESPACIO_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create({ ESP_ID, ESP_CODIGO, EES_ID, ESP_UBICACION }) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESPACIO' AND COLUMN_NAME='ESP_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !ESP_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_ESPACIO (ESP_CODIGO, EES_ID, ESP_UBICACION)
       VALUES (:ESP_CODIGO, :EES_ID, :ESP_UBICACION)`,
      { ESP_CODIGO, EES_ID: EES_ID ?? null, ESP_UBICACION: ESP_UBICACION ?? null },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT ESP_ID FROM PAR_ESPACIO WHERE ESP_CODIGO = :codigo ORDER BY ESP_ID DESC`,
      { codigo: ESP_CODIGO }
    );
    return rows[0] ? getById(rows[0].ESP_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_ESPACIO_CREATE(:ESP_ID, :ESP_CODIGO, :EES_ID, :ESP_UBICACION); END;`,
    { ESP_ID, ESP_CODIGO, EES_ID: EES_ID ?? null, ESP_UBICACION: ESP_UBICACION ?? null }
  );
  return getById(ESP_ID);
}

export async function update(id, { ESP_CODIGO, EES_ID, ESP_UBICACION }) {
  await executeProcedure(
    `BEGIN SP_ESPACIO_UPDATE(:id, :ESP_CODIGO, :EES_ID, :ESP_UBICACION); END;`,
    { id, ESP_CODIGO, EES_ID: EES_ID ?? null, ESP_UBICACION: ESP_UBICACION ?? null }
  );
  return getById(id);
}
