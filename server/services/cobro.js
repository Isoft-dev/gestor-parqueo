import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_COBRO_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_COBRO_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_COBRO_CREATE(:COB_ID, :COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL,
      :COB_MONTO_RECIBIDO, :COB_VUELTO, :COB_FECHA_HORA,
      :COB_PROCESADO_MAQUINA, :TAR_ID); END;`,
    {
      COB_ID:               data.COB_ID ?? null,
      COB_HORAS_TOTALES:    data.COB_HORAS_TOTALES ?? null,
      TCO_ID:               data.TCO_ID ?? null,
      COB_MONTO_TOTAL:      data.COB_MONTO_TOTAL ?? null,
      COB_MONTO_RECIBIDO:   data.COB_MONTO_RECIBIDO ?? null,
      COB_VUELTO:           data.COB_VUELTO ?? null,
      COB_FECHA_HORA:       data.COB_FECHA_HORA ? new Date(data.COB_FECHA_HORA) : new Date(),
      COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? 0,
      TAR_ID:               data.TAR_ID ?? null,
    }
  );
  return getById(data.COB_ID);
}

export async function update(id, data) {
  const current = await getById(id);
  if (!current) return null;

  // Regla HU: cobros historicos no deben mutar por cambios de tarifa/configuracion.
  const immutableFields = [
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
    `BEGIN SP_COBRO_UPDATE(:id, :COB_HORAS_TOTALES, :TCO_ID, :COB_MONTO_TOTAL,
      :COB_MONTO_RECIBIDO, :COB_VUELTO, :COB_FECHA_HORA,
      :COB_PROCESADO_MAQUINA, :TAR_ID); END;`,
    {
      id,
      COB_HORAS_TOTALES: current.COB_HORAS_TOTALES,
      TCO_ID: current.TCO_ID,
      COB_MONTO_TOTAL: current.COB_MONTO_TOTAL,
      COB_MONTO_RECIBIDO: current.COB_MONTO_RECIBIDO,
      COB_VUELTO: current.COB_VUELTO,
      COB_FECHA_HORA: current.COB_FECHA_HORA ? new Date(current.COB_FECHA_HORA) : null,
      COB_PROCESADO_MAQUINA: data.COB_PROCESADO_MAQUINA ?? current.COB_PROCESADO_MAQUINA ?? 0,
      TAR_ID: current.TAR_ID,
    }
  );
  return getById(id);
}
