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
    if (!row) return res.status(404).json({ error: 'Cobro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const {
      COB_ID,
      COB_HORAS_TOTALES,
      TCO_ID,
      COB_MONTO_TOTAL,
      COB_MONTO_RECIBIDO,
      COB_VUELTO,
      COB_FECHA_HORA,
      TAR_ID,
    } = req.body;
    
    if (
      !COB_ID ||
      COB_HORAS_TOTALES === undefined ||
      !TCO_ID ||
      COB_MONTO_TOTAL === undefined ||
      COB_MONTO_RECIBIDO === undefined ||
      COB_VUELTO === undefined ||
      !COB_FECHA_HORA ||
      !TAR_ID
    ) {
      return res.status(400).json({
        error: 'Todos los campos obligatorios del cobro son requeridos (COB_ID, COB_HORAS_TOTALES, TCO_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO, COB_FECHA_HORA, TAR_ID)',
      });
    }

    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
