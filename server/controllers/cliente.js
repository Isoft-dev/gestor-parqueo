import * as service from '../services/cliente.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/mismo CLI_DPI|desactivar|requerid/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try {
    const mode = _req.query?.mode ?? _req.query?.tipo ?? '';
    const q = _req.query?.q ?? '';
    res.json(await service.getAll({ mode, q }));
  } catch (err) {
    const code = /mismo CLI_DPI|desactivar/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(row);
  } catch (err) {
    const code = /mismo CLI_DPI|desactivar/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { CLI_PRIMER_NOMBRE, CLI_PRIMER_APELLIDO, CLI_DPI } = req.body;
    if (!CLI_PRIMER_NOMBRE || !CLI_PRIMER_APELLIDO || !CLI_DPI) {
      return res.status(400).json({
        error: 'CLI_PRIMER_NOMBRE, CLI_PRIMER_APELLIDO y CLI_DPI son requeridos',
      });
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
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
