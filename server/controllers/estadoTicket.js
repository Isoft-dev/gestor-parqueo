import * as service from '../services/estadoTicket.js';

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
    if (!row) return res.status(404).json({ error: 'Estado de ticket no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { ETI_ESTADO } = req.body;
    if (!ETI_ESTADO) {
      return res.status(400).json({ error: 'ETI_ESTADO es requerido' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
