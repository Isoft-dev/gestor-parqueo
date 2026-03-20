import * as service from '../services/maquina.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { MAQ_ID, MAQ_CODIGO, TMA_ID, EMA_ID } = req.body;
    if (!MAQ_ID || !MAQ_CODIGO || !TMA_ID || !EMA_ID) {
      return res.status(400).json({ error: 'MAQ_ID, MAQ_CODIGO, TMA_ID y EMA_ID son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
