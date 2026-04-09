import { executeSql } from '../db/oracle.js';
import { sendPlainMail } from '../utils/mailer.js';
import { create as createNotificacion } from './notificacion.js';

/**
 * Suspender membresías con más de 3 días de mora sin pago posterior al vencimiento.
 */
export async function suspendMembershipsOverdue() {
  const suspRows = await executeSql(
    `SELECT EME_ID FROM PAR_ESTADO_MEMBRESIA
      WHERE LOWER(EME_ESTADO) LIKE '%suspend%'
      ORDER BY EME_ID FETCH FIRST 1 ROW ONLY`
  );
  const suspId = suspRows[0]?.EME_ID ?? suspRows[0]?.eme_id;
  if (suspId == null) {
    return { ok: false, reason: 'Sin estado «suspendido» en PAR_ESTADO_MEMBRESIA' };
  }

  const dispRows = await executeSql(
    `SELECT EES_ID FROM PAR_ESTADO_ESPACIO
      WHERE LOWER(EES_ESTADO) LIKE '%dispon%'
      ORDER BY EES_ID FETCH FIRST 1 ROW ONLY`
  );
  const disponibleEesId = dispRows[0]?.EES_ID ?? dispRows[0]?.ees_id;

  await executeSql(
    `UPDATE PAR_MEMBRESIA m
        SET EME_ID = :suspId,
            MEM_FECHA_ULTIMO_CAMBIO_ESTADO = SYSDATE
      WHERE TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO) + 3
        AND m.EME_ID <> :suspId
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
            JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
           WHERE dpm.MEM_ID = m.MEM_ID
             AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
        )`,
    { suspId },
    { autoCommit: true }
  );

  if (disponibleEesId != null) {
    await executeSql(
      `UPDATE PAR_ESPACIO e
          SET EES_ID = :ees
        WHERE EXISTS (
          SELECT 1 FROM PAR_MEMBRESIA m
           WHERE m.ESP_ID = e.ESP_ID
             AND m.EME_ID = :suspId
             AND TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO) + 3
        )`,
      { ees: disponibleEesId, suspId },
      { autoCommit: true }
    );
  }

  return { ok: true };
}

/**
 * Recordatorios por vencimiento (3 días antes, 2, mismo día, día después).
 * Inserta PAR_NOTIFICACION; intenta correo si SMTP está configurado.
 */
export async function sendMembershipDueReminders() {
  const tipoNotif = await executeSql(
    `SELECT MIN(TNO_ID) AS ID FROM PAR_TIPO_NOTIFICACION`
  );
  const tnoId = tipoNotif[0]?.ID ?? tipoNotif[0]?.id;
  if (tnoId == null) return { ok: false, reason: 'Sin PAR_TIPO_NOTIFICACION' };

  const rows = await executeSql(
    `SELECT m.MEM_ID, m.MEM_FECHA_VENCIMIENTO, c.CLI_CORREO, c.CLI_PRIMER_NOMBRE
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE LOWER(em.EME_ESTADO) LIKE '%activ%'
        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) IN (3, 2, 0, -1)`
  );

  let sent = 0;
  for (const row of rows) {
    const memId = row.MEM_ID ?? row.mem_id;
    const to = row.CLI_CORREO ?? row.cli_correo;
    const nombre = row.CLI_PRIMER_NOMBRE ?? row.cli_primer_nombre ?? '';
    const prox = new Date();
    prox.setDate(prox.getDate() + 1);
    let exito = 0;
    try {
      if (to) {
        await sendPlainMail({
          to,
          subject: 'Recordatorio membresía parqueo',
          text: `Hola ${nombre}, tu membresía (MEM_ID ${memId}) está próxima a vencer. Revisa el pago de tu mensualidad.`,
        });
        exito = 1;
      }
    } catch {
      exito = 0;
    }
    await createNotificacion({
      TNO_ID: tnoId,
      MEM_ID: memId,
      NOT_ULTIMA_FECHA_ENVIO: new Date(),
      NOT_PROXIMA_FECHA_ENVIO: prox,
      NOT_EXITO: exito,
    });
    sent += 1;
  }

  return { ok: true, sent };
}

export async function runDailyMembershipJobs() {
  const a = await suspendMembershipsOverdue();
  const b = await sendMembershipDueReminders();
  return { suspension: a, reminders: b };
}
