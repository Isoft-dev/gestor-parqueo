import oracledb from 'oracledb';
import { executeCursor, executeProcedure, getConnection } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_COBRO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_COBRO_GET_BY_ID(:id, :cursor); END;`, {
    id: Number(id),
  });
  return rows[0] || null;
}

export async function create(data) {
  const ticId = data.TIC_ID;
  if (ticId == null || String(ticId).trim() === '') {
    throw new Error('TIC_ID es requerido');
  }
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `BEGIN SP_COBRO_CREATE(
        :TIC_ID, :COB_NIT, :COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL,
        :COB_MONTO_RECIBIDO, :COB_VUELTO, :COB_FECHA_HORA,
        :COB_PROCESADO_MAQUINA, :TAR_ID, :NEW_COB_ID
      ); END;`,
      {
        TIC_ID: Number(ticId),
        COB_NIT:
          data.COB_NIT != null && String(data.COB_NIT).trim() !== ''
            ? String(data.COB_NIT).trim()
            : null,
        COB_HORAS_TOTALES: Number(data.COB_HORAS_TOTALES),
        TCO_ID: Number(data.TCO_ID),
        COB_MONTO_TOTAL: Number(data.COB_MONTO_TOTAL),
        COB_MONTO_RECIBIDO:
          data.COB_MONTO_RECIBIDO != null && data.COB_MONTO_RECIBIDO !== ''
            ? Number(data.COB_MONTO_RECIBIDO)
            : null,
        COB_VUELTO:
          data.COB_VUELTO != null && data.COB_VUELTO !== '' ? Number(data.COB_VUELTO) : null,
        COB_FECHA_HORA: data.COB_FECHA_HORA ? new Date(data.COB_FECHA_HORA) : new Date(),
        COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? 0,
        TAR_ID: Number(data.TAR_ID),
        NEW_COB_ID: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    const raw = result.outBinds?.NEW_COB_ID;
    const newId = Array.isArray(raw) ? raw[0] : raw;
    return getById(newId);
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, data) {
  const current = await getById(id);
  if (!current) return null;

  const immutableFields = [
    'TIC_ID',
    'COB_NIT',
    'COB_HORAS_TOTALES',
    'TCO_ID',
    'COB_MONTO_TOTAL',
    'COB_MONTO_RECIBIDO',
    'COB_VUELTO',
    'COB_FECHA_HORA',
    'TAR_ID',
  ];
  for (const field of immutableFields) {
    if (data[field] != null && String(data[field]) !== String(current[field] ?? '')) {
      throw new Error(
        `No se permite modificar ${field} en un cobro ya emitido. Los cambios de tarifa aplican solo a transacciones nuevas.`
      );
    }
  }

  await executeProcedure(
    `BEGIN SP_COBRO_UPDATE(:id, :COB_PROCESADO_MAQUINA); END;`,
    {
      id: Number(id),
      COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? current.COB_PROCESADO_MAQUINA ?? 0,
    },
  );
  return getById(id);
}
