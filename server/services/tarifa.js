import { executeCursor, executeDelete, executeSql } from '../db/oracle.js';

function validateTarifaData(data) {
  const precio = Number(data?.TAR_PRECIO);
  const gracia = Number(data?.TAR_TIEMPO_GRACIA);
  if (!(precio > 0)) throw new Error('TAR_PRECIO no puede ser cero ni negativo');
  if (!Number.isFinite(gracia) || gracia < 0) {
    throw new Error('TAR_TIEMPO_GRACIA no puede ser negativo');
  }
}

async function hasTiempoGraciaColumn() {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME='PAR_TARIFA' AND COLUMN_NAME='TAR_TIEMPO_GRACIA'`
  );
  return Number(rows[0]?.TOTAL || 0) > 0;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TARIFA' AND COLUMN_NAME='TAR_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function getAll() {
  if (await hasTiempoGraciaColumn()) {
    return executeSql(
      `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
         FROM PAR_TARIFA
        ORDER BY TAR_ID`
    );
  }
  return executeCursor(`BEGIN SP_TARIFA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  if (await hasTiempoGraciaColumn()) {
    const rows = await executeSql(
      `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
         FROM PAR_TARIFA
        WHERE TAR_ID = :id`,
      { id }
    );
    return rows[0] || null;
  }
  const rows = await executeCursor(`BEGIN SP_TARIFA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  validateTarifaData(data);
  const hasGracia = await hasTiempoGraciaColumn();
  if (!hasGracia) {
    throw new Error('Falta la columna TAR_TIEMPO_GRACIA en PAR_TARIFA para esta HU');
  }
  if ((await isIdentityAlways()) || !data.TAR_ID) {
    await executeSql(
      `INSERT INTO PAR_TARIFA (TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA)
       VALUES (:TAR_TIPO, :TAR_PRECIO, :TAR_TIEMPO_GRACIA)`,
      {
        TAR_TIPO: data.TAR_TIPO ?? null,
        TAR_PRECIO: Number(data.TAR_PRECIO),
        TAR_TIEMPO_GRACIA: Number(data.TAR_TIEMPO_GRACIA),
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TAR_ID
         FROM PAR_TARIFA
        WHERE TAR_TIPO = :tipo
        ORDER BY TAR_ID DESC`,
      { tipo: data.TAR_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TAR_ID) : null;
  }
  await executeSql(
    `INSERT INTO PAR_TARIFA (TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA)
     VALUES (:TAR_ID, :TAR_TIPO, :TAR_PRECIO, :TAR_TIEMPO_GRACIA)`,
    {
      TAR_ID: data.TAR_ID,
      TAR_TIPO: data.TAR_TIPO ?? null,
      TAR_PRECIO: Number(data.TAR_PRECIO),
      TAR_TIEMPO_GRACIA: Number(data.TAR_TIEMPO_GRACIA),
    },
    { autoCommit: true }
  );
  return getById(data.TAR_ID);
}

export async function update(id, data) {
  const current = await getById(id);
  if (!current) return null;
  const merged = {
    TAR_PRECIO: data.TAR_PRECIO ?? current.TAR_PRECIO,
    TAR_TIEMPO_GRACIA: data.TAR_TIEMPO_GRACIA ?? current.TAR_TIEMPO_GRACIA,
  };
  validateTarifaData(merged);
  const hasGracia = await hasTiempoGraciaColumn();
  if (!hasGracia) {
    throw new Error('Falta la columna TAR_TIEMPO_GRACIA en PAR_TARIFA para esta HU');
  }
  await executeSql(
    `UPDATE PAR_TARIFA
        SET TAR_TIPO = :TAR_TIPO,
            TAR_PRECIO = :TAR_PRECIO,
            TAR_TIEMPO_GRACIA = :TAR_TIEMPO_GRACIA
      WHERE TAR_ID = :id`,
    {
      id,
      TAR_TIPO: data.TAR_TIPO ?? current.TAR_TIPO,
      TAR_PRECIO: Number(merged.TAR_PRECIO),
      TAR_TIEMPO_GRACIA: Number(merged.TAR_TIEMPO_GRACIA),
    },
    { autoCommit: true }
  );
  return getById(id);
}

export async function deleteItem(id) {
  try {
    return await executeDelete(`BEGIN SP_TARIFA_DELETE(:id, :deleted); END;`, { id });
  } catch (err) {
    const msg = String(err?.message || '');
    if (/ORA-20001|ORA-02292|cobros/i.test(msg)) {
      throw new Error('No se puede eliminar la tarifa porque tiene cobros asociados');
    }
    throw err;
  }
}

