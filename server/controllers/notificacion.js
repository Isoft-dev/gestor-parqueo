import * as service from '../services/notificacion.js';
import { getMailMode } from '../utils/mailer.js';
import { previewMembershipJobs, runDailyMembershipJobs } from '../services/jobMembershipTasks.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400|ORA-02292/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO, NOT_PROXIMA_FECHA_ENVIO } = req.body;
    if (!TNO_ID || !MEM_ID || !NOT_ULTIMA_FECHA_ENVIO || !NOT_PROXIMA_FECHA_ENVIO) {
      return res.status(400).json({ error: 'TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO y NOT_PROXIMA_FECHA_ENVIO son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

/** Bandeja de correos simulados (lista + estado del modo mail). */
export async function getInbox(_req, res) {
  try {
    const items = await service.getInbox();
    res.json({ mailMode: getMailMode(), items });
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

/** Vista previa del job diario (membresías que recibirían correo hoy). */
export async function getJobsPreview(_req, res) {
  try {
    const preview = await previewMembershipJobs();
    res.json({ mailMode: getMailMode(), ...preview });
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudo obtener la vista previa' });
  }
}

/** Forzar la ejecucion del job diario desde el panel admin. */
export async function runJobsNow(req, res) {
  try {
    const force = Boolean(req.body?.force);
    const demoOnly = Boolean(req.body?.demoOnly);
    const result = await runDailyMembershipJobs({ force, demoOnly });
    res.json({ ok: true, mailMode: getMailMode(), result });
  } catch (err) {
    console.error('[notificacion/jobs/run]', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'No se pudo ejecutar el job de membresías',
    });
  }
}
