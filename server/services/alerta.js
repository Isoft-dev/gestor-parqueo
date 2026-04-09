import { executeCursor, executeProcedure, getConnection } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_ALERTA_CREATE(:ALE_ID, :MAQ_ID, :ALE_MOTIVO, :ALE_DESCRIPCION,
      :ALE_FECHA_HORA_GENERACION, :EAL_ID, :TAL_ID, :ALE_FECHA_ATENCION); END;`,
    {
      ALE_ID:                    data.ALE_ID ?? null,
      MAQ_ID:                    data.MAQ_ID ?? null,
      ALE_MOTIVO:                data.ALE_MOTIVO ?? null,
      ALE_DESCRIPCION:           data.ALE_DESCRIPCION ?? null,
      ALE_FECHA_HORA_GENERACION: data.ALE_FECHA_HORA_GENERACION
                                   ? new Date(data.ALE_FECHA_HORA_GENERACION) : null,
      EAL_ID:                    data.EAL_ID ?? null,
      TAL_ID:                    data.TAL_ID ?? null,
      ALE_FECHA_ATENCION:        data.ALE_FECHA_ATENCION
                                   ? new Date(data.ALE_FECHA_ATENCION) : null,
    }
  );
  return getById(data.ALE_ID);
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
    const tal = await conn.execute(
      `SELECT MIN(TAL_ID) AS ID FROM PAR_TIPO_ALERTA`
    );
    const ealId = eal.rows?.[0]?.ID;
    const talId = tal.rows?.[0]?.ID;
    if (!ealId || !talId) {
      throw new Error('Faltan catálogos PAR_ESTADO_ALERTA o PAR_TIPO_ALERTA');
    }
    const motivo = String(ALE_MOTIVO || 'Solicitud de asistencia').slice(0, 200);
    await conn.execute(
      `INSERT INTO PAR_ALERTA
        (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
       VALUES
        (:maqId, :motivo, :motivo, SYSDATE, :ealId, :talId, NULL)`,
      { maqId: MAQ_ID, motivo, ealId, talId }
    );
    await conn.commit();
    return { ok: true };
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
