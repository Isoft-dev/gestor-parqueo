import * as service from '../services/alerta.js';

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
    if (!row) return res.status(404).json({ error: 'Alerta no encontrada' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { 
      ALE_ID, ALE_MOTIVO, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID 
    } = req.body;
    
    if (!ALE_ID || !ALE_MOTIVO || !ALE_FECHA_HORA_GENERACION || !EAL_ID || !TAL_ID) {
      return res.status(400).json({
        error: 'ALE_ID, ALE_MOTIVO, ALE_FECHA_HORA_GENERACION, EAL_ID y TAL_ID son requeridos',
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
    const { EAL_ID } = req.body;
    
    if (!EAL_ID) {
      return res.status(400).json({
        error: 'EAL_ID es requerido para la actualización',
      });
    }
    
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Alerta no encontrada' });
    
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
