import * as service from '../services/usuario.js';

function businessStatus(err) {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('mismo usu_correo')) return 409;
  if (msg.includes('credenciales invalidas')) return 401;
  if (msg.includes('desactivado')) return 403;
  return 500;
}

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
    const { USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD, ROL_ID } = req.body;
    if (!USU_PRIMER_NOMBRE || !USU_PRIMER_APELLIDO || !USU_CORREO || !USU_PASSWORD || !ROL_ID) {
      return res.status(400).json({
        error: 'USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD y ROL_ID son requeridos',
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
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { USU_CORREO, USU_PASSWORD } = req.body;
    if (!USU_CORREO || !USU_PASSWORD) {
      return res.status(400).json({ error: 'USU_CORREO y USU_PASSWORD son requeridos' });
    }
    const user = await service.login(req.body);
    res.json(user);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
