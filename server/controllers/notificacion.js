import * as service from '../services/notificacion.js';

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
