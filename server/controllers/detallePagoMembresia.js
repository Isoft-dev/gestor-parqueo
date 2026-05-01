import * as service from '../services/detallePagoMembresia.js';

export async function getAll(req, res) {
  try {
    const placa = String(req.query.placa ?? req.query.q ?? '').trim();
    res.json(await service.getAll({ placa }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Detalle de pago de membresía no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { MEM_ID, PAG_ID, DPM_MES_CANCELADO } = req.body;
    if (!MEM_ID || !PAG_ID || DPM_MES_CANCELADO == null) {
      return res.status(400).json({ error: 'MEM_ID, PAG_ID y DPM_MES_CANCELADO son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
