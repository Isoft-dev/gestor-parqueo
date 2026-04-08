import * as service from '../services/detalleSaldo.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Detalle de saldo no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { DSA_ID, SDI_ID, MAQ_ID } = req.body;
    if (!DSA_ID || !SDI_ID || !MAQ_ID) return res.status(400).json({ error: 'DSA_ID, SDI_ID y MAQ_ID son requeridos' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
