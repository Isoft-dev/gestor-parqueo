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

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes('UK_PAR_TICKET_COB_ID')) {
      return res.status(400).json({
        error: 'Ese cobro ya está asociado a otro ticket. Cada cobro solo puede pertenecer a un ticket.',
      });
    }
    if (msg.includes('FK_PAR_TICKET_COBRO') || msg.includes('ORA-02291')) {
      return res.status(400).json({
        error: 'El COB_ID indicado no existe. Debes seleccionar un cobro válido.',
      });
    }
    res.status(500).json({ error: err.message });
  }
}
