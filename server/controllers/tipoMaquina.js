import * as service from '../services/tipoMaquina.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrad/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400|ORA-02292|usado|no puede/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Tipo de maquina no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function create(_req, res) {
  res.status(405).json({ error: 'Los tipos de maquina se administran desde el seeder y no pueden crearse manualmente' });
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de maquina no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function remove(_req, res) {
  res.status(405).json({ error: 'Los tipos de maquina se administran desde el seeder y no pueden eliminarse manualmente' });
}
