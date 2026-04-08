import * as service from '../services/cobro.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/no se permite modificar|emitido|aplican solo a transacciones nuevas|faltan campos|required/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { COB_ID, COB_HORAS_TOTALES, TCO_ID, COB_MONTO_TOTAL, COB_MONTO_RECIBIDO, COB_VUELTO, COB_FECHA_HORA, TAR_ID } = req.body;
    if (
      !COB_ID ||
      COB_HORAS_TOTALES == null ||
      !TCO_ID ||
      COB_MONTO_TOTAL == null ||
      COB_MONTO_RECIBIDO == null ||
      COB_VUELTO == null ||
      !COB_FECHA_HORA ||
      !TAR_ID
    ) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

