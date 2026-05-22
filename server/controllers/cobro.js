import * as service from '../services/cobro.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/no se permite modificar|emitido|aplican solo a transacciones nuevas|faltan campos|required|ticket ya saldado|monto recibido|fecha\/hora|tarifa seleccionada|tarifa vigente|TIC_ID es inválido/i.test(msg)) return 400;
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
    const {
      TIC_ID,
      TCO_ID,
      COB_FECHA_HORA,
    } = req.body;
    if (
      TIC_ID == null ||
      String(TIC_ID).trim() === '' ||
      TCO_ID == null ||
      String(TCO_ID).trim() === '' ||
      !COB_FECHA_HORA
    ) {
      return res.status(400).json({
        error:
          'Faltan campos requeridos: TIC_ID, TCO_ID, COB_FECHA_HORA',
      });
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
