import * as service from '../services/tarifa.js';

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
    if (!row) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { TAR_ID, TAR_TIPO, TAR_PRECIO } = req.body;
    if (!TAR_ID || !TAR_TIPO || TAR_PRECIO === undefined) {
      return res.status(400).json({
        error: 'TAR_ID, TAR_TIPO y TAR_PRECIO son requeridos',
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
    if (!existing) return res.status(404).json({ error: 'Tarifa no encontrada' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tarifa no encontrada' });
    
    await service.remove(req.params.id);
    res.status(204).json();
  } catch (err) {
    // Si la tarifa está asociada a registros (como cobros), se devuelve error manejado.
    res.status(400).json({ error: err.message });
  }
}
