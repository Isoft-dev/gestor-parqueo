import * as service from '../services/tipoPago.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { TPA_ID, TPA_TIPO } = req.body;
    if (!TPA_ID || !TPA_TIPO) return res.status(400).json({ error: 'TPA_ID y TPA_TIPO son requeridos' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function deleteItem(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    await service.deleteItem(req.params.id);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
}
