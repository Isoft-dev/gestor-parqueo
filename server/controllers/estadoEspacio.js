import * as service from '../services/estadoEspacio.js';

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
    if (!row) return res.status(404).json({ error: 'Estado de espacio no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { EES_ID, EES_ESTADO } = req.body;
    if (!EES_ID || !EES_ESTADO) {
      return res.status(400).json({ error: 'EES_ID y EES_ESTADO son requeridos' });
    }
    const created = await service.create({ EES_ID, EES_ESTADO });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
