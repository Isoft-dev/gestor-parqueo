import oracledb from 'oracledb';
import { executeSql, getConnection } from '../db/oracle.js';

/** Primera celda de un SELECT (objeto o fila array), por si el driver devuelve distinto formato. */
function firstScalar(result) {
  const row = result?.rows?.[0];
  if (row == null) return undefined;
  if (Array.isArray(row)) return row[0];
  const vals = Object.values(row);
  return vals[0];
}

export async function getAll() {
  const hasResueltoBy = await hasAlertaColumn('ALE_USU_ID_RESOLVIO');
  const hasSolucion = await hasAlertaColumn('ALE_DESCRIPCION_SOLUCION');
  return executeSql(
    `SELECT ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION,
            ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION,
            ${hasResueltoBy ? 'ALE_USU_ID_RESOLVIO' : 'NULL AS ALE_USU_ID_RESOLVIO'},
            ${hasSolucion ? 'ALE_DESCRIPCION_SOLUCION' : 'NULL AS ALE_DESCRIPCION_SOLUCION'}
       FROM PAR_ALERTA
      ORDER BY ALE_FECHA_HORA_GENERACION DESC`
  );
}

export async function getById(id) {
  const hasResueltoBy = await hasAlertaColumn('ALE_USU_ID_RESOLVIO');
  const hasSolucion = await hasAlertaColumn('ALE_DESCRIPCION_SOLUCION');
  const rows = await executeSql(
    `SELECT ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION,
            ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION,
            ${hasResueltoBy ? 'ALE_USU_ID_RESOLVIO' : 'NULL AS ALE_USU_ID_RESOLVIO'},
            ${hasSolucion ? 'ALE_DESCRIPCION_SOLUCION' : 'NULL AS ALE_DESCRIPCION_SOLUCION'}
       FROM PAR_ALERTA
      WHERE ALE_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

async function hasAlertaColumn(columnName) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'PAR_ALERTA' AND COLUMN_NAME = :c`,
    { c: String(columnName || '').toUpperCase() }
  );
  return Number(rows[0]?.TOTAL || 0) > 0;
}

async function findEstadoAtendidaId() {
  const rows = await executeSql(
    `SELECT EAL_ID
       FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) LIKE '%atendid%'
         OR LOWER(EAL_ESTADO) LIKE '%resuelt%'
         OR LOWER(EAL_ESTADO) LIKE '%cerrad%'
      ORDER BY EAL_ID`
  );
  if (rows?.[0]?.EAL_ID != null) return rows[0].EAL_ID;

  // Fallback: al menos usa un estado distinto al pendiente si existe.
  const fb = await executeSql(
    `SELECT EAL_ID
       FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) NOT LIKE '%pend%'
      ORDER BY EAL_ID`
  );
  return fb?.[0]?.EAL_ID ?? null;
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
  const usuResolvioRaw = data.ALE_USU_ID_RESOLVIO;
  const usuResolvio =
    usuResolvioRaw != null && String(usuResolvioRaw).trim() !== '' ? Number(usuResolvioRaw) : null;
  const descSolucionRaw = data.ALE_DESCRIPCION_SOLUCION;
  const descSolucion =
    descSolucionRaw != null && String(descSolucionRaw).trim() !== ''
      ? String(descSolucionRaw).slice(0, 1000)
      : null;
  const hasResueltoBy = await hasAlertaColumn('ALE_USU_ID_RESOLVIO');
  const hasSolucion = await hasAlertaColumn('ALE_DESCRIPCION_SOLUCION');

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
            ${hasResueltoBy ? ', ALE_USU_ID_RESOLVIO' : ''}
            ${hasSolucion ? ', ALE_DESCRIPCION_SOLUCION' : ''}
          ) VALUES (
            :maq, :motivo, :descr, :fgen, :eal, :tal, :fat
            ${hasResueltoBy ? ', :usuResolvio' : ''}
            ${hasSolucion ? ', :descSolucion' : ''}
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
          usuResolvio,
          descSolucion,
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
  await executeSql(
    `INSERT INTO PAR_ALERTA (
        ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION,
        ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION
        ${hasResueltoBy ? ', ALE_USU_ID_RESOLVIO' : ''}
        ${hasSolucion ? ', ALE_DESCRIPCION_SOLUCION' : ''}
      ) VALUES (
        :aleId, :maqId, :motivo, :desc,
        :fechaGen, :ealId, :talId, :fechaAt
        ${hasResueltoBy ? ', :usuResolvio' : ''}
        ${hasSolucion ? ', :descSolucion' : ''}
      )`,
    {
      aleId,
      maqId,
      motivo: motivo.slice(0, 200),
      desc,
      fechaGen,
      ealId: data.EAL_ID,
      talId: data.TAL_ID,
      fechaAt,
      usuResolvio,
      descSolucion,
    },
    { autoCommit: true }
  );
  return getById(aleId);
}

export async function update(id, data) {
  const hasResueltoBy = await hasAlertaColumn('ALE_USU_ID_RESOLVIO');
  const hasSolucion = await hasAlertaColumn('ALE_DESCRIPCION_SOLUCION');
  const fechaAtencion = data.ALE_FECHA_ATENCION ? new Date(data.ALE_FECHA_ATENCION) : null;
  const usuarioResolvio =
    data.ALE_USU_ID_RESOLVIO != null && String(data.ALE_USU_ID_RESOLVIO).trim() !== ''
      ? Number(data.ALE_USU_ID_RESOLVIO)
      : null;
  const descSolucion =
    data.ALE_DESCRIPCION_SOLUCION != null && String(data.ALE_DESCRIPCION_SOLUCION).trim() !== ''
      ? String(data.ALE_DESCRIPCION_SOLUCION).slice(0, 1000)
      : null;
  const mustAutoAttend = !!fechaAtencion || usuarioResolvio != null || !!descSolucion;
  let estadoId = data.EAL_ID ?? null;
  if (mustAutoAttend) {
    const atendidaId = await findEstadoAtendidaId();
    if (atendidaId != null) estadoId = atendidaId;
  }
  const sets = ['EAL_ID = :eal', 'ALE_FECHA_ATENCION = :fechaAt'];
  const binds = {
    id,
    eal: estadoId,
    fechaAt: fechaAtencion,
  };
  if (hasResueltoBy) {
    sets.push('ALE_USU_ID_RESOLVIO = :usuResolvio');
    binds.usuResolvio = usuarioResolvio;
  }
  if (hasSolucion) {
    sets.push('ALE_DESCRIPCION_SOLUCION = :descSolucion');
    binds.descSolucion = descSolucion;
  }
  await executeSql(
    `UPDATE PAR_ALERTA
        SET ${sets.join(', ')}
      WHERE ALE_ID = :id`,
    binds,
    { autoCommit: true }
  );
  return getById(id);
}

/** Botón de asistencia en cabinas: crea PAR_ALERTA en estado pendiente. */
export async function createSolicitudAsistencia({ MAQ_ID }) {
  if (!MAQ_ID) throw new Error('MAQ_ID es requerido');
  let conn;
  try {
    conn = await getConnection();
    const eal = await conn.execute(
      `SELECT MIN(EAL_ID) AS ID FROM PAR_ESTADO_ALERTA
        WHERE LOWER(EAL_ESTADO) LIKE '%pend%'`
    );
    const talAsist = await conn.execute(
      `SELECT TAL_ID, TAL_TIPO, TAL_DESCRIPCION
         FROM PAR_TIPO_ALERTA
        WHERE LOWER(TAL_TIPO) LIKE '%asist%'
           OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%asist%'
        ORDER BY TAL_ID`
    );
    const talAsistRow = talAsist?.rows?.[0] || null;
    let talId = talAsistRow?.TAL_ID ?? null;
    let talDescripcion = talAsistRow?.TAL_DESCRIPCION ?? null;
    if (talId == null) {
      const talFb = await conn.execute(
        `SELECT TAL_ID, TAL_TIPO, TAL_DESCRIPCION
           FROM PAR_TIPO_ALERTA
          ORDER BY TAL_ID`
      );
      const talFbRow = talFb?.rows?.[0] || null;
      talId = talFbRow?.TAL_ID ?? null;
      talDescripcion = talFbRow?.TAL_DESCRIPCION ?? null;
    }
    const maqInfo = await conn.execute(
      `SELECT m.MAQ_ID, m.MAQ_CODIGO, tm.TMA_TIPO
         FROM PAR_MAQUINA m
         JOIN PAR_TIPO_MAQUINA tm ON m.TMA_ID = tm.TMA_ID
        WHERE m.MAQ_ID = :maqId`,
      { maqId: MAQ_ID }
    );
    const maq = maqInfo?.rows?.[0] || {};
    const maqTipo = String(maq.TMA_TIPO || 'máquina').trim();
    const maqRef = maq.MAQ_CODIGO != null && String(maq.MAQ_CODIGO).trim() !== ''
      ? String(maq.MAQ_CODIGO).trim()
      : String(maq.MAQ_ID ?? MAQ_ID).trim();
    const ealId = firstScalar(eal);
    if (!ealId || !talId) {
      throw new Error('Faltan catálogos PAR_ESTADO_ALERTA o PAR_TIPO_ALERTA');
    }
    const motivo = `Solicitud de asistencia desde la maquina de: ${maqTipo} ${maqRef}`.slice(0, 200);
    const descripcion = talDescripcion != null && String(talDescripcion).trim() !== ''
      ? String(talDescripcion).trim().slice(0, 1000)
      : motivo;
    const ins = await conn.execute(
      `INSERT INTO PAR_ALERTA
        (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
       VALUES
        (:maqId, :motivo, :descripcion, SYSDATE, :ealId, :talId, NULL)
       RETURNING ALE_ID INTO :rid`,
      {
        maqId: MAQ_ID,
        motivo,
        descripcion,
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
