import * as service from '../services/saldoDisponible.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrad/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400|ORA-02292|no puede/i.test(msg)) return 400;
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
    if (!row) return res.status(404).json({ error: 'Saldo disponible no encontrado' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(_req, res) {
  res.status(405).json({ error: 'Los saldos disponibles se administran desde el seeder y no pueden crearse manualmente' });
}

export async function update(_req, res) {
  res.status(405).json({ error: 'Los saldos disponibles se administran desde el seeder y no pueden modificarse manualmente' });
}
