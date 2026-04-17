import oracledb from 'oracledb';
import { executeCursor, executeProcedure, executeSql, getConnection } from '../db/oracle.js';

/** Primera celda de un SELECT (objeto o fila array), por si el driver devuelve distinto formato. */
function firstScalar(result) {
  const row = result?.rows?.[0];
  if (row == null) return undefined;
  if (Array.isArray(row)) return row[0];
  const vals = Object.values(row);
  return vals[0];
}

export async function getAll() {
  return executeCursor(`BEGIN SP_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

/**
 * Alta manual desde panel: ALE_ID siempre autogenerado (identity o MAX+1), igual que alertas de sistema.
 * Fecha de generación por defecto: ahora.
 */
export async function create(data) {
  const motivo = String(data.ALE_MOTIVO ?? '').trim();
  if (!motivo) throw new Error('ALE_MOTIVO es requerido');
  if (data.EAL_ID == null || String(data.EAL_ID).trim() === '' || data.TAL_ID == null || String(data.TAL_ID).trim() === '') {
    throw new Error('EAL_ID y TAL_ID son requeridos');
  }

  const maqRaw = data.MAQ_ID;
  const maqId = maqRaw != null && String(maqRaw).trim() !== '' ? maqRaw : null;
  const desc = data.ALE_DESCRIPCION != null && String(data.ALE_DESCRIPCION).trim() !== ''
    ? String(data.ALE_DESCRIPCION)
    : null;
  const fechaGen = data.ALE_FECHA_HORA_GENERACION
    ? new Date(data.ALE_FECHA_HORA_GENERACION)
    : new Date();
  const fechaAt = data.ALE_FECHA_ATENCION ? new Date(data.ALE_FECHA_ATENCION) : null;

  const identityRows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_ALERTA' AND COLUMN_NAME = 'ALE_ID'`
  );
  const identityAlways = String(identityRows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';

  if (identityAlways) {
    let conn;
    try {
      conn = await getConnection();
      const result = await conn.execute(
        `INSERT INTO PAR_ALERTA (
            MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION,
            EAL_ID, TAL_ID, ALE_FECHA_ATENCION
          ) VALUES (
            :maq, :motivo, :descr, :fgen, :eal, :tal, :fat
          )
          RETURNING ALE_ID INTO :rid`,
        {
          maq: maqId,
          motivo: motivo.slice(0, 200),
          descr: desc,
          fgen: fechaGen,
          eal: data.EAL_ID,
          tal: data.TAL_ID,
          fat: fechaAt,
          rid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true }
      );
      const newId = result.outBinds?.rid;
      let idVal = Array.isArray(newId) ? newId[0] : newId;
      if (idVal != null && typeof idVal === 'bigint') idVal = Number(idVal);
      return getById(idVal);
    } finally {
      if (conn) await conn.close();
    }
  }

  const nxt = await executeSql(`SELECT NVL(MAX(ALE_ID), 0) + 1 AS N FROM PAR_ALERTA`);
  const aleId = nxt[0]?.N ?? nxt[0]?.n ?? 1;

  await executeProcedure(
    `BEGIN SP_ALERTA_CREATE(:ALE_ID, :MAQ_ID, :ALE_MOTIVO, :ALE_DESCRIPCION,
      :ALE_FECHA_HORA_GENERACION, :EAL_ID, :TAL_ID, :ALE_FECHA_ATENCION); END;`,
    {
      ALE_ID:                    aleId,
      MAQ_ID:                    maqId,
      ALE_MOTIVO:                motivo.slice(0, 200),
      ALE_DESCRIPCION:           desc,
      ALE_FECHA_HORA_GENERACION: fechaGen,
      EAL_ID:                    data.EAL_ID,
      TAL_ID:                    data.TAL_ID,
      ALE_FECHA_ATENCION:        fechaAt,
    }
  );
  return getById(aleId);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_ALERTA_UPDATE(:id, :EAL_ID, :ALE_FECHA_ATENCION); END;`,
    {
      id,
      EAL_ID:             data.EAL_ID ?? null,
      ALE_FECHA_ATENCION: data.ALE_FECHA_ATENCION
                            ? new Date(data.ALE_FECHA_ATENCION) : null,
    }
  );
  return getById(id);
}

/** Botón de asistencia en cabinas: crea PAR_ALERTA en estado pendiente. */
export async function createSolicitudAsistencia({ MAQ_ID, ALE_MOTIVO }) {
  if (!MAQ_ID) throw new Error('MAQ_ID es requerido');
  let conn;
  try {
    conn = await getConnection();
    const eal = await conn.execute(
      `SELECT MIN(EAL_ID) AS ID FROM PAR_ESTADO_ALERTA
        WHERE LOWER(EAL_ESTADO) LIKE '%pend%'`
    );
    const talAsist = await conn.execute(
      `SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA
        WHERE LOWER(TAL_TIPO) LIKE '%asist%'
           OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%asist%'`
    );
    let talId = firstScalar(talAsist);
    if (talId == null) {
      const talFb = await conn.execute(`SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA`);
      talId = firstScalar(talFb);
    }
    const ealId = firstScalar(eal);
    if (!ealId || !talId) {
      throw new Error('Faltan catálogos PAR_ESTADO_ALERTA o PAR_TIPO_ALERTA');
    }
    const motivo = String(ALE_MOTIVO || 'Solicitud de asistencia').slice(0, 200);
    const ins = await conn.execute(
      `INSERT INTO PAR_ALERTA
        (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
       VALUES
        (:maqId, :motivo, :motivo, SYSDATE, :ealId, :talId, NULL)
       RETURNING ALE_ID INTO :rid`,
      {
        maqId: MAQ_ID,
        motivo,
        ealId,
        talId,
        rid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );
    await conn.commit();
    const rawAle = ins.outBinds?.rid;
    const aleIdNuevo = Array.isArray(rawAle) ? rawAle[0] : rawAle;
    return { ok: true, ALE_ID: aleIdNuevo ?? undefined };
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}
