import * as service from '../services/vehiculo.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/misma placa|misma VEH_PLACA|requerid/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict/i.test(msg)) return 409;
  return 500;
}

export async function getAll(req, res) {
  try {
    const soloClienteConMembresia =
      req.query?.con_membresia_cliente === '1' ||
      String(req.query?.solo_cliente_con_membresia || '').toLowerCase() === 'true';
    const soloEsporadicos =
      req.query?.esporadico === '1' || String(req.query?.solo_esporadicos || '').toLowerCase() === 'true';
    if (soloClienteConMembresia && soloEsporadicos) {
      return res.status(400).json({ error: 'No combines con_membresia_cliente y esporadico' });
    }
    res.json(
      await service.getAll({
        soloClienteConMembresia,
        soloEsporadicos,
      }),
    );
  } catch (err) {
    const code = /misma placa|misma VEH_PLACA/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    const code = /misma placa|misma VEH_PLACA/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { VEH_PLACA, TVE_ID } = req.body;
    if (!VEH_PLACA || !TVE_ID) {
      return res.status(400).json({ error: 'La placa y el tipo de vehículo son obligatorios.' });
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

