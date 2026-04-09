import * as service from '../services/bitacoraIncidenteVehiculo.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400|ORA-02292/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Bitácora no encontrada' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { VEH_ID, INC_ID, BIV_FECHA_HORA, BIV_DESCRIPCION } = req.body;
    if (!VEH_ID || !INC_ID || !BIV_FECHA_HORA) {
      return res.status(400).json({ error: 'VEH_ID, INC_ID y BIV_FECHA_HORA son requeridos' });
    }
    if (BIV_DESCRIPCION == null || String(BIV_DESCRIPCION).trim() === '') {
      return res.status(400).json({ error: 'BIV_DESCRIPCION es requerido' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function resolve(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bitácora no encontrada' });
    const { BIV_RESUELTO, BIV_FECHA_RESOLUCION, USU_ID } = req.body;
    if (BIV_RESUELTO == null) return res.status(400).json({ error: 'BIV_RESUELTO es requerido' });
    const payload = {
      BIV_RESUELTO,
      BIV_FECHA_RESOLUCION: BIV_FECHA_RESOLUCION ?? new Date().toISOString(),
      USU_ID: USU_ID ?? null,
    };
    res.json(await service.resolve(req.params.id, payload));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}
