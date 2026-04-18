import { executeSql } from '../db/oracle.js';
import { sendPlainMail } from '../utils/mailer.js';
import { create as createNotificacion } from './notificacion.js';
import { insertSystemAlerta } from '../utils/systemAlert.js';

function truncDate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return truncDate(x);
}

/** Días hasta vencimiento (mismo criterio que TRUNC(venc) - TRUNC(hoy)). */
function daysUntilVencimiento(vencDate) {
  const V = truncDate(vencDate);
  const T = truncDate(new Date());
  return Math.round((V.getTime() - T.getTime()) / 86400000);
}

/**
 * Índice de etapa: 0 = -3 días, 1 = -2, 2 = mismo día, 3 = día después.
 */
function stageIndex(daysUntil) {
  if (daysUntil === 3) return 0;
  if (daysUntil === 2) return 1;
  if (daysUntil === 0) return 2;
  if (daysUntil === -1) return 3;
  return -1;
}

function proximaFechaParaEtapa(vencimiento, stageIdx) {
  const V = truncDate(vencimiento);
  if (stageIdx === 0) return addDays(V, -2);
  if (stageIdx === 1) return V;
  if (stageIdx === 2) return addDays(V, 1);
  return addDays(V, 2);
}

async function listTiposNotificacion() {
  return executeSql(
    `SELECT TNO_ID, TNO_TIPO FROM PAR_TIPO_NOTIFICACION ORDER BY TNO_ID`,
  );
}

/** Recordatorios de vencimiento: excluye tipos de suspensión u otros; orden estable por TNO_ID. */
function reminderTiposOrdered(tipos) {
  return tipos
    .filter((r) => {
      const t = String(r.TNO_TIPO ?? r.tno_tipo ?? '').toLowerCase();
      return !t.includes('susp');
    })
    .sort((a, b) => Number(a.TNO_ID ?? a.tno_id) - Number(b.TNO_ID ?? b.tno_id));
}

function tnoIdForStage(tipos, stageIdx) {
  if (!tipos.length) return null;
  const rec = reminderTiposOrdered(tipos);
  if (rec.length >= 4) {
    const row = rec[stageIdx];
    return row ? row.TNO_ID ?? row.tno_id : null;
  }
  if (rec.length > 0) {
    const row = rec[Math.min(stageIdx, rec.length - 1)];
    return row.TNO_ID ?? row.tno_id;
  }
  const row = tipos[stageIdx] ?? tipos[tipos.length - 1];
  return row.TNO_ID ?? row.tno_id;
}

async function tipoNotificacionSuspensionId() {
  const rows = await executeSql(
    `SELECT MIN(TNO_ID) AS ID FROM PAR_TIPO_NOTIFICACION
      WHERE LOWER(TNO_TIPO) LIKE '%susp%'
         OR LOWER(NVL(TNO_DESCRIPCION, '')) LIKE '%susp%'`,
  );
  let id = rows[0]?.ID ?? rows[0]?.id;
  if (id == null) {
    const fb = await executeSql(`SELECT MAX(TNO_ID) AS ID FROM PAR_TIPO_NOTIFICACION`);
    id = fb[0]?.ID ?? fb[0]?.id;
  }
  return id;
}

/**
 * Suspender membresías con más de 3 días de mora sin pago posterior al vencimiento.
 */
export async function suspendMembershipsOverdue() {
  const suspRows = await executeSql(
    `SELECT EME_ID FROM PAR_ESTADO_MEMBRESIA
      WHERE LOWER(EME_ESTADO) LIKE '%suspend%'
      ORDER BY EME_ID FETCH FIRST 1 ROW ONLY`,
  );
  const suspId = suspRows[0]?.EME_ID ?? suspRows[0]?.eme_id;
  if (suspId == null) {
    return { ok: false, reason: 'Sin estado «suspendido» en PAR_ESTADO_MEMBRESIA' };
  }

  const dispRows = await executeSql(
    `SELECT EES_ID FROM PAR_ESTADO_ESPACIO
      WHERE LOWER(EES_ESTADO) LIKE '%dispon%'
      ORDER BY EES_ID FETCH FIRST 1 ROW ONLY`,
  );
  const disponibleEesId = dispRows[0]?.EES_ID ?? dispRows[0]?.ees_id;

  const candidatos = await executeSql(
    `SELECT m.MEM_ID
       FROM PAR_MEMBRESIA m
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
  );

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
    { autoCommit: true },
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
      { autoCommit: true },
    );
  }

  const tnoSusp = await tipoNotificacionSuspensionId();
  for (const c of candidatos) {
    const memId = c.MEM_ID ?? c.mem_id;
    if (memId == null || tnoSusp == null) continue;
    try {
      const rowsCliente = await executeSql(
        `SELECT c.CLI_CORREO, c.CLI_PRIMER_NOMBRE
           FROM PAR_MEMBRESIA m
           JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
           JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
          WHERE m.MEM_ID = :memId`,
        { memId },
      );
      const to = rowsCliente[0]?.CLI_CORREO ?? rowsCliente[0]?.cli_correo;
      const nombre = rowsCliente[0]?.CLI_PRIMER_NOMBRE ?? rowsCliente[0]?.cli_primer_nombre ?? '';
      let exito = 0;
      try {
        if (to) {
          await sendPlainMail({
            to,
            subject: 'Membresía suspendida por mora',
            text: `Hola ${nombre}, tu membresía (MEM_ID ${memId}) fue suspendida automáticamente por mora superior a 3 días. Regulariza tu pago en recepción.`,
          });
          exito = 1;
        }
      } catch (mailErr) {
        exito = 0;
        await insertSystemAlerta({
          motivo: 'Fallo correo suspensión membresía',
          descripcion: `MEM_ID ${memId}: ${mailErr?.message || mailErr}`,
        });
      }
      const prox = addDays(new Date(), 7);
      await createNotificacion({
        TNO_ID: tnoSusp,
        MEM_ID: memId,
        NOT_ULTIMA_FECHA_ENVIO: new Date(),
        NOT_PROXIMA_FECHA_ENVIO: prox,
        NOT_EXITO: exito,
      });
    } catch (e) {
      await insertSystemAlerta({
        motivo: 'Error notificación suspensión',
        descripcion: `MEM_ID ${memId}: ${e?.message || e}`,
      });
    }
  }

  return { ok: true, suspendidas: candidatos.length };
}

/**
 * Recordatorios: 3 días antes, 2, vencimiento, día siguiente.
 * Respeta pago antes del hito, evita duplicado mismo día mismo TNO, NOT_PROXIMA_FECHA_ENVIO al siguiente hito.
 */
export async function sendMembershipDueReminders() {
  const tipos = await listTiposNotificacion();
  if (!tipos.length) return { ok: false, reason: 'Sin PAR_TIPO_NOTIFICACION' };

  const rows = await executeSql(
    `SELECT m.MEM_ID, m.MEM_FECHA_VENCIMIENTO, c.CLI_CORREO, c.CLI_PRIMER_NOMBRE
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE LOWER(em.EME_ESTADO) LIKE '%activ%'
        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) IN (3, 2, 0, -1)`,
  );

  let sent = 0;
  for (const row of rows) {
    const memId = row.MEM_ID ?? row.mem_id;
    const venc = row.MEM_FECHA_VENCIMIENTO ?? row.mem_fecha_vencimiento;
    if (!memId || !venc) continue;

    const daysUntil = daysUntilVencimiento(venc);
    const stageIdx = stageIndex(daysUntil);
    if (stageIdx < 0) continue;

    const tnoId = tnoIdForStage(tipos, stageIdx);
    if (tnoId == null) continue;

    const yaHoy = await executeSql(
      `SELECT 1 FROM PAR_NOTIFICACION n
        WHERE n.MEM_ID = :memId AND n.TNO_ID = :tnoId
          AND TRUNC(n.NOT_ULTIMA_FECHA_ENVIO) = TRUNC(SYSDATE)`,
      { memId, tnoId },
    );
    if (yaHoy.length) continue;

    const ultimaNotif = await executeSql(
      `SELECT NOT_ID, NOT_ULTIMA_FECHA_ENVIO, NOT_PROXIMA_FECHA_ENVIO
         FROM PAR_NOTIFICACION
        WHERE MEM_ID = :memId
        ORDER BY NOT_ID DESC
        FETCH FIRST 1 ROW ONLY`,
      { memId },
    );
    const un = ultimaNotif[0];
    const proxProgramada =
      un?.NOT_PROXIMA_FECHA_ENVIO ?? un?.not_proxima_fecha_envio;
    const ultEnvio =
      un?.NOT_ULTIMA_FECHA_ENVIO ?? un?.not_ultima_fecha_envio;
    if (proxProgramada && ultEnvio) {
      const pagoAntesDeProxima = await executeSql(
        `SELECT 1 FROM PAR_DETALLE_PAGO_MEMBRESIA d
           JOIN PAR_PAGO p ON p.PAG_ID = d.PAG_ID
          WHERE d.MEM_ID = :memId
            AND p.PAG_FECHA_HORA >= :ultEnvio
            AND p.PAG_FECHA_HORA < :proxProgramada`,
        {
          memId,
          ultEnvio: new Date(ultEnvio),
          proxProgramada: new Date(proxProgramada),
        },
      );
      if (pagoAntesDeProxima.length) continue;
    }

    const vencT = truncDate(venc);
    const pagoCubreVenc = await executeSql(
      `SELECT 1 FROM PAR_DETALLE_PAGO_MEMBRESIA d
         JOIN PAR_PAGO p ON p.PAG_ID = d.PAG_ID
        WHERE d.MEM_ID = :memId
          AND TRUNC(p.PAG_FECHA_HORA) >= :venc`,
      { memId, venc: vencT },
    );
    if (pagoCubreVenc.length && daysUntil <= 0) continue;

    const to = row.CLI_CORREO ?? row.cli_correo;
    const nombre = row.CLI_PRIMER_NOMBRE ?? row.cli_primer_nombre ?? '';
    const proxEnvio = proximaFechaParaEtapa(venc, stageIdx);
    let exito = 0;
    const etapas = ['3 días antes del vencimiento', '2 días antes del vencimiento', 'día del vencimiento', 'día siguiente al vencimiento'];
    try {
      if (to) {
        await sendPlainMail({
          to,
          subject: 'Recordatorio membresía parqueo',
          text: `Hola ${nombre}, recordatorio (${etapas[stageIdx] || 'vencimiento'}). MEM_ID ${memId}. Revisa el pago de tu mensualidad.`,
        });
        exito = 1;
      }
    } catch (mailErr) {
      exito = 0;
      await insertSystemAlerta({
        motivo: 'Fallo envío recordatorio membresía',
        descripcion: `MEM_ID ${memId}, TNO_ID ${tnoId}: ${mailErr?.message || mailErr}`,
      });
    }

    await createNotificacion({
      TNO_ID: tnoId,
      MEM_ID: memId,
      NOT_ULTIMA_FECHA_ENVIO: new Date(),
      NOT_PROXIMA_FECHA_ENVIO: proxEnvio,
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
