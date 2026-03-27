import * as service from '../services/vehiculo.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/misma VEH_PLACA|requerid/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    const code = /misma VEH_PLACA/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    const code = /misma VEH_PLACA/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { VEH_PLACA, TVE_ID } = req.body;
    if (!VEH_PLACA || !TVE_ID) {
      return res.status(400).json({ error: 'VEH_PLACA y TVE_ID son requeridos' });
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

