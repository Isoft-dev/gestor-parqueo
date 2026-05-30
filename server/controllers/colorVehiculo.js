import * as service from '../services/colorVehiculo.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/registro no encontrado|no encontrado/i.test(msg)) return 404;
  if (/requerid|ORA-01400|ORA-02291/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  if (/ORA-02292/i.test(msg)) return 409;
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
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    if (!req.body?.COL_NOMBRE) {
      return res.status(400).json({ error: 'COL_NOMBRE es requerido' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function deleteItem(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    await service.deleteItem(req.params.id);
    res.status(204).send();
  } catch (err) {
    const msg = String(err?.message || '');
    if (/ORA-02292/i.test(msg)) {
      return res.status(409).json({ error: 'No se puede eliminar el color porque tiene vehículos asociados.' });
    }
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
