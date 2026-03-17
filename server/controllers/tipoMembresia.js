import * as service from '../services/tipoMembresia.js';

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
    if (!row) return res.status(404).json({ error: 'Tipo de membresía no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { TME_ID, TME_TIPO, TME_PRECIO } = req.body;
    if (!TME_ID || !TME_TIPO || TME_PRECIO === undefined) {
      return res.status(400).json({
        error: 'TME_ID, TME_TIPO y TME_PRECIO son requeridos',
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
    if (!existing) return res.status(404).json({ error: 'Tipo de membresía no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de membresía no encontrado' });
    
    await service.remove(req.params.id);
    res.status(204).json(); // No content
  } catch (err) {
    // Si hay membresías activas, la DB lanzará error
    res.status(400).json({ error: err.message });
  }
}
