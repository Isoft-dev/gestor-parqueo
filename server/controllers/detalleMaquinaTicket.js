import * as service from '../services/detalleMaquinaTicket.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Detalle de máquina-ticket no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { DMT_ID, TIC_ID, MAQ_ID } = req.body;
    if (!DMT_ID || !TIC_ID || !MAQ_ID) return res.status(400).json({ error: 'DMT_ID, TIC_ID y MAQ_ID son requeridos' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
