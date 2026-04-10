import { getConnection } from '../db/oracle.js';

/**
 * Alerta operativa sin máquina (MAQ_ID NULL): fallos de jobs, correo, etc.
 */
export async function insertSystemAlerta({ motivo, descripcion }) {
  let conn;
  try {
    conn = await getConnection();
    const eal = await conn.execute(
      `SELECT MIN(EAL_ID) AS ID FROM PAR_ESTADO_ALERTA
        WHERE LOWER(EAL_ESTADO) LIKE '%pend%'`,
    );
    let tal = await conn.execute(
      `SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA
        WHERE LOWER(TAL_TIPO) LIKE '%sistem%'
           OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%sistem%'`,
    );
    let talId = tal.rows?.[0]?.ID ?? tal.rows?.[0]?.id;
    if (talId == null) {
      tal = await conn.execute(`SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA`);
      talId = tal.rows?.[0]?.ID ?? tal.rows?.[0]?.id;
    }
    const ealId = eal.rows?.[0]?.ID ?? eal.rows?.[0]?.id;
    if (!ealId || !talId) return;

    const idRow = await conn.execute(
      `SELECT GENERATION_TYPE FROM USER_TAB_IDENTITY_COLS
        WHERE TABLE_NAME = 'PAR_ALERTA' AND COLUMN_NAME = 'ALE_ID'`,
    );
    const identityAlways =
      String(idRow.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';

    if (identityAlways) {
      await conn.execute(
        `INSERT INTO PAR_ALERTA
          (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
         VALUES
          (NULL, :m, :d, SYSDATE, :eal, :tal, NULL)`,
        {
          m: String(motivo || 'Sistema').slice(0, 200),
          d: descripcion != null ? String(descripcion).slice(0, 4000) : null,
          eal: ealId,
          tal: talId,
        },
      );
    } else {
      const nxt = await conn.execute(`SELECT NVL(MAX(ALE_ID), 0) + 1 AS N FROM PAR_ALERTA`);
      const id = Number(nxt.rows?.[0]?.N || 1);
      await conn.execute(
        `INSERT INTO PAR_ALERTA
          (ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
         VALUES
          (:id, NULL, :m, :d, SYSDATE, :eal, :tal, NULL)`,
        {
          id,
          m: String(motivo || 'Sistema').slice(0, 200),
          d: descripcion != null ? String(descripcion).slice(0, 4000) : null,
          eal: ealId,
          tal: talId,
        },
      );
    }
    await conn.commit();
  } catch {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
  } finally {
    if (conn) await conn.close();
  }
}

/**
 * Alerta operativa asociada a una máquina (MAQ_ID).
 * Útil para HUs de cabinas/máquina de cobro donde se requiere MAQ_ID origen.
 */
export async function insertMachineAlerta({ maqId, motivo, descripcion, preferSaldoBajo = false }) {
  let conn;
  try {
    conn = await getConnection();
    const eal = await conn.execute(
      `SELECT MIN(EAL_ID) AS ID FROM PAR_ESTADO_ALERTA
        WHERE LOWER(EAL_ESTADO) LIKE '%pend%'`,
    );
    let tal = preferSaldoBajo
      ? await conn.execute(
        `SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA
          WHERE LOWER(TAL_TIPO) LIKE '%saldo%baj%'
             OR LOWER(TAL_TIPO) LIKE '%bajo%saldo%'
             OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%saldo%baj%'`,
      )
      : await conn.execute(
        `SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA`,
      );
    let talId = tal.rows?.[0]?.ID ?? tal.rows?.[0]?.id;
    if (talId == null) {
      tal = await conn.execute(`SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA`);
      talId = tal.rows?.[0]?.ID ?? tal.rows?.[0]?.id;
    }
    const ealId = eal.rows?.[0]?.ID ?? eal.rows?.[0]?.id;
    if (!ealId || !talId) return;

    const idRow = await conn.execute(
      `SELECT GENERATION_TYPE FROM USER_TAB_IDENTITY_COLS
        WHERE TABLE_NAME = 'PAR_ALERTA' AND COLUMN_NAME = 'ALE_ID'`,
    );
    const identityAlways =
      String(idRow.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';

    const m = String(motivo || 'Sistema').slice(0, 200);
    const d = descripcion != null ? String(descripcion).slice(0, 4000) : null;
    const mid = maqId != null ? Number(maqId) : null;

    if (identityAlways) {
      await conn.execute(
        `INSERT INTO PAR_ALERTA
          (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
         VALUES
          (:maq, :m, :d, SYSDATE, :eal, :tal, NULL)`,
        { maq: mid, m, d, eal: ealId, tal: talId },
      );
    } else {
      const nxt = await conn.execute(`SELECT NVL(MAX(ALE_ID), 0) + 1 AS N FROM PAR_ALERTA`);
      const id = Number(nxt.rows?.[0]?.N || 1);
      await conn.execute(
        `INSERT INTO PAR_ALERTA
          (ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
         VALUES
          (:id, :maq, :m, :d, SYSDATE, :eal, :tal, NULL)`,
        { id, maq: mid, m, d, eal: ealId, tal: talId },
      );
    }
    await conn.commit();
  } catch {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
  } finally {
    if (conn) await conn.close();
  }
}
