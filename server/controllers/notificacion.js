import * as service from '../services/notificacion.js';

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { NOT_ID, TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO, NOT_PROXIMA_FECHA_ENVIO } = req.body;
    if (!NOT_ID || !TNO_ID || !MEM_ID || !NOT_ULTIMA_FECHA_ENVIO || !NOT_PROXIMA_FECHA_ENVIO) {
      return res.status(400).json({ error: 'NOT_ID, TNO_ID, MEM_ID, NOT_ULTIMA_FECHA_ENVIO y NOT_PROXIMA_FECHA_ENVIO son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(500).json({ error: err.message }); }
}
