import * as service from '../services/membresia.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Membresía no encontrada' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { MEM_ID, TME_ID, MEM_FECHA_INICIO, MEM_FECHA_VENCIMIENTO, VEH_ID, ESP_ID } = req.body;
    if (!MEM_ID || !TME_ID || !MEM_FECHA_INICIO || !MEM_FECHA_VENCIMIENTO || !VEH_ID || !ESP_ID) {
      return res.status(400).json({ error: 'MEM_ID, TME_ID, MEM_FECHA_INICIO, MEM_FECHA_VENCIMIENTO, VEH_ID y ESP_ID son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Membresía no encontrada' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
