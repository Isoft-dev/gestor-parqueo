import * as service from '../services/pago.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { PAG_ID, TPA_ID, PAG_MONTO_TOTAL } = req.body;
    if (!PAG_ID || !TPA_ID || PAG_MONTO_TOTAL == null) {
      return res.status(400).json({ error: 'PAG_ID, TPA_ID y PAG_MONTO_TOTAL son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
