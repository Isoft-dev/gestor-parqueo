import * as service from '../services/tipoCobro.js';

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
    if (!row) return res.status(404).json({ error: 'Tipo de cobro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { TCO_ID, TCO_TIPO } = req.body;
    if (!TCO_ID || !TCO_TIPO) {
      return res.status(400).json({
        error: 'TCO_ID y TCO_TIPO son requeridos',
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
    if (!existing) return res.status(404).json({ error: 'Tipo de cobro no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de cobro no encontrado' });
    
    await service.remove(req.params.id);
    res.status(204).json(); // No content
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
