import { executeCursor, executeProcedure, executeDelete, executeSql } from '../db/oracle.js';
import { assertFixedPaymentCatalogLocked } from '../utils/fixedPaymentCatalogs.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_TIPO_COBRO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_TIPO_COBRO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  assertFixedPaymentCatalogLocked();
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_TIPO_COBRO' AND COLUMN_NAME='TCO_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.TCO_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_TIPO_COBRO (TCO_TIPO, TCO_DESCRIPCION)
       VALUES (:TCO_TIPO, :TCO_DESCRIPCION)`,
      {
        TCO_TIPO: data.TCO_TIPO ?? null,
        TCO_DESCRIPCION: data.TCO_DESCRIPCION ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT TCO_ID
         FROM PAR_TIPO_COBRO
        WHERE TCO_TIPO = :tipo
        ORDER BY TCO_ID DESC`,
      { tipo: data.TCO_TIPO ?? null }
    );
    return rows[0] ? getById(rows[0].TCO_ID) : null;
  }
  await executeProcedure(`BEGIN SP_TIPO_COBRO_CREATE(:TCO_ID, :TCO_TIPO, :TCO_DESCRIPCION); END;`, {
    TCO_ID: data.TCO_ID ?? null,
    TCO_TIPO: data.TCO_TIPO ?? null,
    TCO_DESCRIPCION: data.TCO_DESCRIPCION ?? null,
  });
  return getById(data.TCO_ID);
}

export async function update(id, data) {
  assertFixedPaymentCatalogLocked();
  await executeProcedure(`BEGIN SP_TIPO_COBRO_UPDATE(:id, :TCO_TIPO, :TCO_DESCRIPCION); END;`, {
    id,
    TCO_TIPO: data.TCO_TIPO ?? null,
    TCO_DESCRIPCION: data.TCO_DESCRIPCION ?? null,
  });
  return getById(id);
}

export async function deleteItem(id) {
  assertFixedPaymentCatalogLocked();
  try {
    return await executeDelete(`BEGIN SP_TIPO_COBRO_DELETE(:id, :deleted); END;`, { id });
  } catch (err) {
    const msg = String(err?.message || '');
    if (/ORA-20001|ORA-02292|cobros/i.test(msg)) {
      throw new Error('No se puede eliminar el tipo de cobro porque tiene cobros asociados');
    }
    throw err;
  }
}

