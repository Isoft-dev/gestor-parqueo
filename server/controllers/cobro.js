import * as service from '../services/cobro.js';

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { COB_ID, COB_HORAS_TOTALES, TCO_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO, COB_FECHA_HORA, TAR_ID } = req.body;
    if (!COB_ID || !COB_HORAS_TOTALES || !TCO_ID || !COB_MONTO_TOTAL || !COB_MONTO_RECIBIDO || !COB_VUELTO || !COB_FECHA_HORA || !TAR_ID) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

