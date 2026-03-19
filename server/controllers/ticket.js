import * as service from '../services/ticket.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { TIC_ID, TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, ETI_ID } = req.body;
    if (!TIC_ID || !TIC_CODIGO || !VEH_ID || !TIC_FECHA_HORA_ENTRADA || !ETI_ID) {
      return res.status(400).json({ error: 'TIC_ID, TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA y ETI_ID son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
