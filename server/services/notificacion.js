import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(`BEGIN SP_NOTIFICACION_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_NOTIFICACION_GET_BY_ID(:id, :cursor); END;`, { id });
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_NOTIFICACION' AND COLUMN_NAME='NOT_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.NOT_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_NOTIFICACION
        (TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO, NOT_PROXIMA_FECHA_ENVIO, NOT_EXITO, NOT_ASUNTO, NOT_CUERPO)
       VALUES
        (:TNO_ID, :MEM_ID, :NOT_ULTIMA_FECHA_ENVIO, :NOT_PROXIMA_FECHA_ENVIO, :NOT_EXITO, :NOT_ASUNTO, :NOT_CUERPO)`,
      {
        TNO_ID: data.TNO_ID ?? null,
        MEM_ID: data.MEM_ID ?? null,
        NOT_ULTIMA_FECHA_ENVIO: data.NOT_ULTIMA_FECHA_ENVIO ? new Date(data.NOT_ULTIMA_FECHA_ENVIO) : null,
        NOT_PROXIMA_FECHA_ENVIO: data.NOT_PROXIMA_FECHA_ENVIO ? new Date(data.NOT_PROXIMA_FECHA_ENVIO) : null,
        NOT_EXITO: data.NOT_EXITO ?? 0,
        NOT_ASUNTO: data.NOT_ASUNTO ?? null,
        NOT_CUERPO: data.NOT_CUERPO ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT NOT_ID FROM PAR_NOTIFICACION
        WHERE MEM_ID = :memId
        ORDER BY NOT_ID DESC`,
      { memId: data.MEM_ID ?? null }
    );
    return rows[0] ? getById(rows[0].NOT_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_NOTIFICACION_CREATE(:NOT_ID, :TNO_ID, :MEM_ID, :NOT_ULTIMA_FECHA_ENVIO, :NOT_PROXIMA_FECHA_ENVIO, :NOT_EXITO, :NOT_ASUNTO, :NOT_CUERPO); END;`,
    {
      NOT_ID: data.NOT_ID ?? null,
      TNO_ID: data.TNO_ID ?? null,
      MEM_ID: data.MEM_ID ?? null,
      NOT_ULTIMA_FECHA_ENVIO: data.NOT_ULTIMA_FECHA_ENVIO ? new Date(data.NOT_ULTIMA_FECHA_ENVIO) : null,
      NOT_PROXIMA_FECHA_ENVIO: data.NOT_PROXIMA_FECHA_ENVIO ? new Date(data.NOT_PROXIMA_FECHA_ENVIO) : null,
      NOT_EXITO: data.NOT_EXITO ?? 0,
      NOT_ASUNTO: data.NOT_ASUNTO ?? null,
      NOT_CUERPO: data.NOT_CUERPO ?? null,
    }
  );
  return getById(data.NOT_ID);
}

/**
 * Bandeja de "Correos Simulados": lista plana lista para el panel admin.
 * Calcula la etapa buscando substrings dentro de TNO_TIPO (independiente del TNO_ID),
 * de modo que agregar nuevos recordatorios no rompa el etiquetado.
 */
const ETAPA_POR_TIPO_MATCH = [
  { match: '-3d', label: '3 días antes' },
  { match: '-2d', label: '2 días antes' },
  { match: '-1d', label: '1 día antes' },
  { match: 'venc', label: 'día del vencimiento' },
  { match: '+1d', label: 'día siguiente al vencimiento' },
];

function etapaFromTnoTipo(tnoTipo) {
  const t = String(tnoTipo ?? '').toLowerCase();
  if (t.includes('susp')) return 'aviso de suspensión';
  for (const stage of ETAPA_POR_TIPO_MATCH) {
    if (t.includes(stage.match.toLowerCase())) return stage.label;
  }
  return 'recordatorio';
}

export async function getInbox() {
  const rows = await getAll();
  return rows.map((r) => {
    const tnoTipo = String(r.TNO_TIPO ?? '').toLowerCase();
    const mensaje = `${r.NOT_ASUNTO ?? ''} ${r.NOT_CUERPO ?? ''}`.toLowerCase();
    const esSuspension = tnoTipo.includes('susp') && !mensaje.includes('quedó vencida');
    const etapa = mensaje.includes('quedó vencida')
      ? 'aviso de vencimiento'
      : etapaFromTnoTipo(r.TNO_TIPO);
    return {
      notId: r.NOT_ID,
      tnoId: r.TNO_ID,
      tnoTipo: r.TNO_TIPO,
      tnoDescripcion: r.TNO_DESCRIPCION,
      memId: r.MEM_ID,
      cliId: r.CLI_ID,
      destinatarioNombre: [r.CLI_PRIMER_NOMBRE, r.CLI_PRIMER_APELLIDO].filter(Boolean).join(' '),
      destinatarioCorreo: r.CLI_CORREO,
      placa: r.VEH_PLACA,
      ultimaFechaEnvio: r.NOT_ULTIMA_FECHA_ENVIO,
      proximaFechaEnvio: r.NOT_PROXIMA_FECHA_ENVIO,
      exito: Number(r.NOT_EXITO ?? 0) === 1,
      asunto: r.NOT_ASUNTO,
      cuerpo: r.NOT_CUERPO,
      etapa,
      esSuspension,
    };
  });
}
