import * as service from '../services/registroMantenimiento.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400/i.test(msg)) return 400;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro de mantenimiento no encontrado' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { MAQ_ID } = req.body;
    if (!MAQ_ID) return res.status(400).json({ error: 'MAQ_ID es requerido' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getByMachine(req, res) {
  try {
    res.json(await service.getByMachineId(req.params.maqId));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
