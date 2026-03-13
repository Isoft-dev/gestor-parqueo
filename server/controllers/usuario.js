import * as service from '../services/usuario.js';

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { USU_ID, USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD, ROL_ID } = req.body;
    if (!USU_ID || !USU_PRIMER_NOMBRE || !USU_PRIMER_APELLIDO || !USU_CORREO || !USU_PASSWORD || !ROL_ID) {
      return res.status(400).json({
        error: 'USU_ID, USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD y ROL_ID son requeridos',
      });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
