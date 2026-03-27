import { executeSql, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ds.DSA_UMBRAL_MINIMO,
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      ORDER BY ds.MAQ_ID, ds.SDI_ID`
  );
}

export async function getById(id) {
  const rows = await executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ds.DSA_UMBRAL_MINIMO,
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      WHERE ds.DSA_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_SALDO' AND COLUMN_NAME='DSA_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.DSA_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_DETALLE_SALDO (DSA_CANTIDAD, DSA_SUBTOTAL, DSA_UMBRAL_MINIMO, SDI_ID, MAQ_ID)
       VALUES (:DSA_CANTIDAD, :DSA_SUBTOTAL, :DSA_UMBRAL_MINIMO, :SDI_ID, :MAQ_ID)`,
      {
        DSA_CANTIDAD: data.DSA_CANTIDAD ?? null,
        DSA_SUBTOTAL: data.DSA_SUBTOTAL ?? null,
        DSA_UMBRAL_MINIMO: data.DSA_UMBRAL_MINIMO ?? null,
        SDI_ID: data.SDI_ID ?? null,
        MAQ_ID: data.MAQ_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT DSA_ID FROM PAR_DETALLE_SALDO
        WHERE MAQ_ID = :maqId AND SDI_ID = :sdiId
        ORDER BY DSA_ID DESC`,
      { maqId: data.MAQ_ID ?? null, sdiId: data.SDI_ID ?? null }
    );
    return rows[0] ? getById(rows[0].DSA_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_DETALLE_SALDO_CREATE(:DSA_ID, :DSA_CANTIDAD, :DSA_SUBTOTAL, :SDI_ID, :MAQ_ID); END;`,
    {
      DSA_ID: data.DSA_ID ?? null,
      DSA_CANTIDAD: data.DSA_CANTIDAD ?? null,
      DSA_SUBTOTAL: data.DSA_SUBTOTAL ?? null,
      SDI_ID: data.SDI_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
    }
  );
  return getById(data.DSA_ID);
}

export async function getByMachineId(maqId) {
  return executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ds.DSA_UMBRAL_MINIMO,
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      WHERE ds.MAQ_ID = :maqId
      ORDER BY ds.SDI_ID`,
    { maqId }
  );
}

export async function updateUmbral(id, umbral) {
  await executeSql(
    `UPDATE PAR_DETALLE_SALDO
        SET DSA_UMBRAL_MINIMO = :umbral
      WHERE DSA_ID = :id`,
    { id, umbral },
    { autoCommit: true }
  );
  return getById(id);
}
