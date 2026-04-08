import { executeCursor, executeProcedure } from '../db/oracle.js';

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
