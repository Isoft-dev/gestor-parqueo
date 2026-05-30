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
 * Definicion de etapas de recordatorio. Mapeo directo dias-hasta-vencimiento → metadata.
 * Cada etapa se relaciona con un TNO_TIPO buscando por substring (case-insensitive),
 * de modo que el orden de TNO_ID en la tabla no afecta el comportamiento.
 */
const STAGE_DEFS = [
  {
    daysUntil: 3,
    asunto: 'Recordatorio: tu membresía vence en 3 días',
    etapaCorta: '3 días antes',
    tipoMatch: '-3d',
  },
  {
    daysUntil: 2,
    asunto: 'Recordatorio: tu membresía vence en 2 días',
    etapaCorta: '2 días antes',
    tipoMatch: '-2d',
  },
  {
    daysUntil: 1,
    asunto: 'Recordatorio: tu membresía vence mañana',
    etapaCorta: '1 día antes',
    tipoMatch: '-1d',
  },
  {
    daysUntil: 0,
    asunto: 'Aviso: tu membresía vence hoy',
    etapaCorta: 'día del vencimiento',
    tipoMatch: 'venc',
  },
  {
    daysUntil: -1,
    asunto: 'Aviso: tu membresía venció ayer',
    etapaCorta: 'día siguiente al vencimiento',
    tipoMatch: '+1d',
  },
];

function stageDefForDaysUntil(daysUntil) {
  return STAGE_DEFS.find((d) => d.daysUntil === daysUntil) || null;
}

/**
 * Próxima fecha de envío programada según la etapa actual.
 * Si todavía hay etapas posteriores, apunta al siguiente hito; si ya es la última, +1 día.
 */
function proximaFechaParaStage(vencimiento, daysUntil) {
  const V = truncDate(vencimiento);
  const idx = STAGE_DEFS.findIndex((d) => d.daysUntil === daysUntil);
  if (idx === -1) return addDays(V, 2);
  const next = STAGE_DEFS[idx + 1];
  if (!next) return addDays(V, 2);
  // daysUntil del siguiente hito → fecha = V - daysUntil
  return addDays(V, -next.daysUntil);
}

async function listTiposNotificacion() {
  return executeSql(
    `SELECT TNO_ID, TNO_TIPO FROM PAR_TIPO_NOTIFICACION ORDER BY TNO_ID`,
  );
}

/** Tipos de recordatorio (excluye suspensión). */
function reminderTipos(tipos) {
  return tipos.filter((r) => {
    const t = String(r.TNO_TIPO ?? r.tno_tipo ?? '').toLowerCase();
    return !t.includes('susp');
  });
}

/**
 * Devuelve el TNO_ID que corresponde a una etapa, buscando por TNO_TIPO substring
 * (más robusto que depender del orden de inserción).
 */
function tnoIdForStageDef(tipos, stageDef) {
  if (!tipos.length || !stageDef) return null;
  const recs = reminderTipos(tipos);
  const target = String(stageDef.tipoMatch).toLowerCase();
  const exact = recs.find((t) =>
    String(t.TNO_TIPO ?? t.tno_tipo ?? '').toLowerCase().includes(target),
  );
  if (exact) return exact.TNO_ID ?? exact.tno_id;
  // Fallback: si no hay match, usa el último recordatorio disponible
  const last = recs[recs.length - 1] ?? tipos[tipos.length - 1];
  return last ? (last.TNO_ID ?? last.tno_id) : null;
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

async function estadoMembresiaVencidaId() {
  const rows = await executeSql(
    `SELECT EME_ID FROM PAR_ESTADO_MEMBRESIA
      WHERE LOWER(EME_ESTADO) LIKE '%venc%'
      ORDER BY EME_ID FETCH FIRST 1 ROW ONLY`,
  );
  return rows[0]?.EME_ID ?? rows[0]?.eme_id ?? null;
}

/**
 * Marcar como vencidas las membresías cuyo periodo ya venció
 * sin un pago registrado que cubra la vigencia (pago con fecha >= vencimiento).
 * El ingreso con tag queda bloqueado hasta renovar en máquina de cobro («Pagar membresía»).
 */
export async function suspendMembershipsOverdue() {
  const vencidaId = await estadoMembresiaVencidaId();
  if (vencidaId == null) {
    return { ok: false, reason: 'Sin estado «vencida» en PAR_ESTADO_MEMBRESIA' };
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
        WHERE TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
        AND m.EME_ID <> :vencidaId
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_ESTADO_MEMBRESIA em
           WHERE em.EME_ID = m.EME_ID
             AND (
               LOWER(em.EME_ESTADO) LIKE '%suspend%'
               OR LOWER(em.EME_ESTADO) LIKE '%inactiv%'
             )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
            JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
           WHERE dpm.MEM_ID = m.MEM_ID
             AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
        )`,
    { vencidaId },
  );

  await executeSql(
    `UPDATE PAR_MEMBRESIA m
        SET EME_ID = :vencidaId,
            MEM_FECHA_ULTIMO_CAMBIO_ESTADO = SYSDATE
      WHERE TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
        AND m.EME_ID <> :vencidaId
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_ESTADO_MEMBRESIA em
           WHERE em.EME_ID = m.EME_ID
             AND (
               LOWER(em.EME_ESTADO) LIKE '%suspend%'
               OR LOWER(em.EME_ESTADO) LIKE '%inactiv%'
             )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
            JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
           WHERE dpm.MEM_ID = m.MEM_ID
             AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
        )`,
    { vencidaId },
    { autoCommit: true },
  );

  if (disponibleEesId != null) {
    await executeSql(
      `UPDATE PAR_ESPACIO e
          SET EES_ID = :ees
        WHERE EXISTS (
          SELECT 1 FROM PAR_MEMBRESIA m
           WHERE m.ESP_ID = e.ESP_ID
             AND m.EME_ID = :vencidaId
             AND TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
        )`,
      { ees: disponibleEesId, vencidaId },
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
      const asuntoSusp = 'Membresía vencida por expiración del periodo';
      const cuerpoSusp = `Hola ${nombre}, tu membresía (MEM_ID ${memId}) quedó vencida al finalizar el periodo pagado. Puedes renovarla en la máquina de cobro (opción Pagar membresía) o en recepción.`;
      let exito = 0;
      try {
        if (to) {
          await sendPlainMail({
            to,
            subject: asuntoSusp,
            text: cuerpoSusp,
          });
          exito = 1;
        }
      } catch (mailErr) {
        exito = 0;
        await insertSystemAlerta({
          motivo: 'Fallo correo vencimiento membresía',
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
        NOT_ASUNTO: asuntoSusp,
        NOT_CUERPO: cuerpoSusp,
      });
    } catch (e) {
      await insertSystemAlerta({
        motivo: 'Error notificación vencimiento',
        descripcion: `MEM_ID ${memId}: ${e?.message || e}`,
      });
    }
  }

  return { ok: true, vencidas: candidatos.length, suspendidas: 0 };
}

/**
 * Recordatorios: 3 días antes, 2, 1, vencimiento, día siguiente.
 * Respeta pago antes del hito, evita duplicado mismo día mismo TNO, NOT_PROXIMA_FECHA_ENVIO al siguiente hito.
 */
export async function sendMembershipDueReminders(options = {}) {
  const { force = false, demoOnly = false } = options;
  const tipos = await listTiposNotificacion();
  if (!tipos.length) return { ok: false, reason: 'Sin PAR_TIPO_NOTIFICACION' };

  const demoFilter = demoOnly
    ? ` AND LOWER(c.CLI_CORREO) LIKE 'demo.vencer%clientes.seed'`
    : '';
  const dayFilter = demoOnly
    ? ''
    : ` AND TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) IN (3, 2, 1, 0, -1)`;

  const rows = await executeSql(
    `SELECT m.MEM_ID, m.MEM_FECHA_VENCIMIENTO, c.CLI_CORREO, c.CLI_PRIMER_NOMBRE
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE LOWER(em.EME_ESTADO) LIKE '%activ%'
      ${dayFilter}
      ${demoFilter}`,
  );

  let sent = 0;
  let skipped = 0;
  for (const row of rows) {
    const memId = row.MEM_ID ?? row.mem_id;
    const venc = row.MEM_FECHA_VENCIMIENTO ?? row.mem_fecha_vencimiento;
    if (!memId || !venc) continue;

    const daysUntil = daysUntilVencimiento(venc);
    const stageDef = stageDefForDaysUntil(daysUntil);
    if (!stageDef) {
      skipped += 1;
      continue;
    }

    const tnoId = tnoIdForStageDef(tipos, stageDef);
    if (tnoId == null) continue;

    if (!force) {
      const yaHoy = await executeSql(
        `SELECT 1 FROM PAR_NOTIFICACION n
          WHERE n.MEM_ID = :memId AND n.TNO_ID = :tnoId
            AND TRUNC(n.NOT_ULTIMA_FECHA_ENVIO) = TRUNC(SYSDATE)`,
        { memId, tnoId },
      );
      if (yaHoy.length) {
        skipped += 1;
        continue;
      }
    }

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
    if (!force && proxProgramada && ultEnvio) {
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
      if (pagoAntesDeProxima.length) {
        skipped += 1;
        continue;
      }
    }

    const vencT = truncDate(venc);
    const pagoCubreVenc = await executeSql(
      `SELECT 1 FROM PAR_DETALLE_PAGO_MEMBRESIA d
         JOIN PAR_PAGO p ON p.PAG_ID = d.PAG_ID
        WHERE d.MEM_ID = :memId
          AND TRUNC(p.PAG_FECHA_HORA) >= :venc`,
      { memId, venc: vencT },
    );
    if (pagoCubreVenc.length && daysUntil <= 0) {
      skipped += 1;
      continue;
    }

    const to = row.CLI_CORREO ?? row.cli_correo;
    const nombre = row.CLI_PRIMER_NOMBRE ?? row.cli_primer_nombre ?? '';
    const proxEnvio = proximaFechaParaStage(venc, daysUntil);
    const asunto = stageDef.asunto;
    const etapaTxt = stageDef.etapaCorta;
    const fechaVencTxt = (() => {
      const d = truncDate(venc);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    })();
    const cuerpoFraseVenc = (() => {
      if (daysUntil === 0) return 'vence HOY';
      if (daysUntil === -1) return 'venció el ' + fechaVencTxt;
      if (daysUntil === 1) return 'vence MAÑANA (' + fechaVencTxt + ')';
      return 'vence el ' + fechaVencTxt;
    })();
    const cuerpo = [
      `Hola ${nombre || 'cliente'},`,
      '',
      `Te recordamos que tu membresía de parqueo (ID ${memId}) ${cuerpoFraseVenc}.`,
      `Etapa de aviso: ${etapaTxt}.`,
      '',
      'Para renovar puedes acercarte a una máquina de cobro y elegir la opción "Pagar membresía", o pasar por recepción.',
      '',
      'Gracias por confiar en el servicio de parqueo.',
    ].join('\n');

    let exito = 0;
    try {
      if (to) {
        await sendPlainMail({
          to,
          subject: asunto,
          text: cuerpo,
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
      NOT_ASUNTO: asunto,
      NOT_CUERPO: cuerpo,
    });
    sent += 1;
  }

  return { ok: true, sent, skipped, candidatos: rows.length };
}

/** Vista previa para el panel: cuántas membresías entrarían hoy al job. */
export async function previewMembershipJobs() {
  const elegibles = await executeSql(
    `SELECT m.MEM_ID,
            TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) AS DIAS,
            c.CLI_CORREO,
            c.CLI_PRIMER_NOMBRE,
            v.VEH_PLACA
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE LOWER(em.EME_ESTADO) LIKE '%activ%'
        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) IN (3, 2, 1, 0, -1)
      ORDER BY DIAS, m.MEM_ID`,
  );

  const demo = await executeSql(
    `SELECT m.MEM_ID,
            TRUNC(m.MEM_FECHA_VENCIMIENTO) - TRUNC(SYSDATE) AS DIAS,
            c.CLI_CORREO,
            v.VEH_PLACA
       FROM PAR_MEMBRESIA m
       JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
       JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
      WHERE LOWER(c.CLI_CORREO) LIKE 'demo.vencer%clientes.seed'
        AND LOWER(em.EME_ESTADO) LIKE '%activ%'
      ORDER BY DIAS, m.MEM_ID`,
  );

  const enviadosHoy = await executeSql(
    `SELECT COUNT(DISTINCT n.MEM_ID) AS C
       FROM PAR_NOTIFICACION n
      WHERE TRUNC(n.NOT_ULTIMA_FECHA_ENVIO) = TRUNC(SYSDATE)`,
  );

  const items = elegibles.map((r) => {
    const dias = Number(r.DIAS ?? r.dias ?? 0);
    const stageDef = stageDefForDaysUntil(dias);
    return {
      memId: r.MEM_ID ?? r.mem_id,
      dias,
      etapa: stageDef?.etapaCorta ?? '—',
      correo: r.CLI_CORREO ?? r.cli_correo,
      nombre: r.CLI_PRIMER_NOMBRE ?? r.cli_primer_nombre,
      placa: r.VEH_PLACA ?? r.veh_placa,
    };
  });

  return {
    elegiblesHoy: items.length,
    enviadosHoy: Number(enviadosHoy[0]?.C ?? enviadosHoy[0]?.c ?? 0),
    items,
    demoClientes: demo.map((r) => ({
      memId: r.MEM_ID ?? r.mem_id,
      dias: Number(r.DIAS ?? r.dias ?? 0),
      correo: r.CLI_CORREO ?? r.cli_correo,
      placa: r.VEH_PLACA ?? r.veh_placa,
      etapa: stageDefForDaysUntil(Number(r.DIAS ?? r.dias ?? 0))?.etapaCorta ?? '—',
    })),
  };
}

export async function runDailyMembershipJobs(options = {}) {
  const { force = false, demoOnly = false } = options;
  const a = demoOnly ? { ok: true, vencidas: 0, suspendidas: 0 } : await suspendMembershipsOverdue();
  const b = await sendMembershipDueReminders({ force, demoOnly });
  return { suspension: a, reminders: b };
}
