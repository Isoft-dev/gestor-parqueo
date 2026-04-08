import { executeCursor, executeProcedure, executeSql, getConnection } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_RECARGO_MAQUINA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_RECARGO_MAQUINA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_RECARGO_MAQUINA' AND COLUMN_NAME='RMA_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function getNextIdTx(conn, tableName, columnName) {
  const r = await conn.execute(`SELECT NVL(MAX(${columnName}), 0) + 1 AS NEXT_ID FROM ${tableName}`);
  return Number(r.rows?.[0]?.NEXT_ID || 1);
}

export async function create(data) {
  const detalles = Array.isArray(data.RECARGA_DETALLE_SALDO) ? data.RECARGA_DETALLE_SALDO : [];
  if (!detalles.length) {
    if ((await isIdentityAlways()) || !data.RMA_ID) {
      await executeSql(
        `INSERT INTO PAR_RECARGO_MAQUINA (MAQ_ID, RMA_MANTENIMIENTO_FECHA, RMA_DESCRIPCION)
         VALUES (:MAQ_ID, :RMA_MANTENIMIENTO_FECHA, :RMA_DESCRIPCION)`,
        {
          MAQ_ID: data.MAQ_ID ?? null,
          RMA_MANTENIMIENTO_FECHA: data.RMA_MANTENIMIENTO_FECHA
            ? new Date(data.RMA_MANTENIMIENTO_FECHA)
            : new Date(),
          RMA_DESCRIPCION: data.RMA_DESCRIPCION ?? null,
        },
        { autoCommit: true }
      );
      await executeSql(
        `UPDATE PAR_MAQUINA SET MAQ_FECHA_ULTIMA_RECARGA = SYSDATE WHERE MAQ_ID = :maqId`,
        { maqId: data.MAQ_ID ?? null },
        { autoCommit: true }
      );
      const rows = await executeSql(
        `SELECT RMA_ID FROM PAR_RECARGO_MAQUINA WHERE MAQ_ID = :maqId ORDER BY RMA_ID DESC`,
        { maqId: data.MAQ_ID ?? null }
      );
      return rows[0] ? getById(rows[0].RMA_ID) : null;
    }
  }

  let conn;
  try {
    conn = await getConnection();
    const useIdentity = (await isIdentityAlways()) || !data.RMA_ID;
    const rmaId = useIdentity
      ? await getNextIdTx(conn, 'PAR_RECARGO_MAQUINA', 'RMA_ID')
      : Number(data.RMA_ID);

    await conn.execute(
      `INSERT INTO PAR_RECARGO_MAQUINA (RMA_ID, MAQ_ID, RMA_MANTENIMIENTO_FECHA, RMA_DESCRIPCION)
       VALUES (:RMA_ID, :MAQ_ID, :RMA_MANTENIMIENTO_FECHA, :RMA_DESCRIPCION)`,
      {
        RMA_ID: rmaId,
        MAQ_ID: data.MAQ_ID ?? null,
        RMA_MANTENIMIENTO_FECHA: data.RMA_MANTENIMIENTO_FECHA
          ? new Date(data.RMA_MANTENIMIENTO_FECHA)
          : new Date(),
        RMA_DESCRIPCION: data.RMA_DESCRIPCION ?? null,
      }
    );

    for (const d of detalles) {
      const sdiId = Number(d.SDI_ID);
      const qty = Number(d.DSA_CANTIDAD ?? 0);
      if (!sdiId || !Number.isFinite(qty)) continue;

      const valRes = await conn.execute(
        `SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = :sdiId`,
        { sdiId }
      );
      const sdiValor = Number(valRes.rows?.[0]?.SDI_VALOR ?? 0);
      if (!(sdiValor >= 0)) continue;

      const detRes = await conn.execute(
        `SELECT DSA_ID, DSA_CANTIDAD
           FROM PAR_DETALLE_SALDO
          WHERE MAQ_ID = :maqId AND SDI_ID = :sdiId`,
        { maqId: data.MAQ_ID ?? null, sdiId }
      );
      const det = detRes.rows?.[0];
      if (det?.DSA_ID != null) {
        const newQty = Number(det.DSA_CANTIDAD ?? 0) + qty;
        await conn.execute(
          `UPDATE PAR_DETALLE_SALDO
              SET DSA_CANTIDAD = :cantidad,
                  DSA_SUBTOTAL = :subtotal
            WHERE DSA_ID = :dsaId`,
          {
            dsaId: det.DSA_ID,
            cantidad: newQty,
            subtotal: newQty * sdiValor,
          }
        );
      } else {
        const dsaId = await getNextIdTx(conn, 'PAR_DETALLE_SALDO', 'DSA_ID');
        await conn.execute(
          `INSERT INTO PAR_DETALLE_SALDO (DSA_ID, DSA_CANTIDAD, DSA_SUBTOTAL, SDI_ID, MAQ_ID)
           VALUES (:DSA_ID, :DSA_CANTIDAD, :DSA_SUBTOTAL, :SDI_ID, :MAQ_ID)`,
          {
            DSA_ID: dsaId,
            DSA_CANTIDAD: qty,
            DSA_SUBTOTAL: qty * sdiValor,
            SDI_ID: sdiId,
            MAQ_ID: data.MAQ_ID ?? null,
          }
        );
      }
    }

    await conn.execute(
      `UPDATE PAR_MAQUINA
          SET MAQ_FECHA_ULTIMA_RECARGA = SYSDATE
        WHERE MAQ_ID = :maqId`,
      { maqId: data.MAQ_ID ?? null }
    );
    await conn.commit();
    return getById(rmaId);
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}

export async function getByMachineId(maqId) {
  return executeSql(
    `SELECT r.RMA_ID, r.MAQ_ID, m.MAQ_CODIGO,
            r.RMA_MANTENIMIENTO_FECHA, r.RMA_DESCRIPCION
       FROM PAR_RECARGO_MAQUINA r
       JOIN PAR_MAQUINA m ON r.MAQ_ID = m.MAQ_ID
      WHERE r.MAQ_ID = :maqId
      ORDER BY r.RMA_MANTENIMIENTO_FECHA DESC, r.RMA_ID DESC`,
    { maqId }
  );
}

export async function createLegacy(data) {
  await executeProcedure(
    `BEGIN SP_RECARGO_MAQUINA_CREATE(:RMA_ID, :MAQ_ID, :RMA_MANTENIMIENTO_FECHA, :RMA_DESCRIPCION); END;`,
    {
      RMA_ID: data.RMA_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
      RMA_MANTENIMIENTO_FECHA: data.RMA_MANTENIMIENTO_FECHA ? new Date(data.RMA_MANTENIMIENTO_FECHA) : null,
      RMA_DESCRIPCION: data.RMA_DESCRIPCION ?? null,
    }
  );
  return getById(data.RMA_ID);
}
