import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

async function isSdiIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_SALDO_DISPONIBLE' AND COLUMN_NAME='SDI_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function getAll() {
  return executeCursor(`BEGIN SP_SALDO_DISP_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_SALDO_DISP_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const useIdentity = (await isSdiIdentityAlways()) || !data.SDI_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_SALDO_DISPONIBLE (SDI_TIPO, SDI_VALOR)
       VALUES (:SDI_TIPO, :SDI_VALOR)`,
      {
        SDI_TIPO: data.SDI_TIPO ?? null,
        SDI_VALOR: data.SDI_VALOR ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT SDI_ID FROM (
         SELECT SDI_ID FROM PAR_SALDO_DISPONIBLE ORDER BY SDI_ID DESC
       ) WHERE ROWNUM = 1`
    );
    const id = rows[0]?.SDI_ID;
    return id != null ? getById(id) : null;
  }
  await executeProcedure(`BEGIN SP_SALDO_DISP_CREATE(:SDI_ID, :SDI_TIPO, :SDI_VALOR); END;`, {
    SDI_ID: data.SDI_ID ?? null,
    SDI_TIPO: data.SDI_TIPO ?? null,
    SDI_VALOR: data.SDI_VALOR ?? null,
  });
  return getById(data.SDI_ID);
}

export async function update(id, data) {
  await executeProcedure(`BEGIN SP_SALDO_DISP_UPDATE(:id, :SDI_TIPO, :SDI_VALOR); END;`, {
    id,
    SDI_TIPO: data.SDI_TIPO ?? null,
    SDI_VALOR: data.SDI_VALOR ?? null,
  });
  return getById(id);
}
