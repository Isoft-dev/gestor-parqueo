import * as service from '../services/bitacoraIncidenteVehiculo.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Bitácora no encontrada' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { BIV_ID, VEH_ID, INC_ID, BIV_FECHA_HORA } = req.body;
    if (!BIV_ID || !VEH_ID || !INC_ID || !BIV_FECHA_HORA) {
      return res.status(400).json({ error: 'BIV_ID, VEH_ID, INC_ID y BIV_FECHA_HORA son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function resolve(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bitácora no encontrada' });
    const { BIV_RESUELTO } = req.body;
    if (BIV_RESUELTO == null) return res.status(400).json({ error: 'BIV_RESUELTO es requerido' });
    res.json(await service.resolve(req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
