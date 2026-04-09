import * as service from '../services/detalleSaldo.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/requerid|umbral|ORA-02291|ORA-01400|ORA-00904/i.test(msg)) return 400;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Detalle de saldo no encontrado' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { SDI_ID, MAQ_ID } = req.body;
    if (!SDI_ID || !MAQ_ID) return res.status(400).json({ error: 'SDI_ID y MAQ_ID son requeridos' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getByMachine(req, res) {
  try {
    res.json(await service.getByMachineId(req.params.maqId));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function updateUmbral(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Detalle de saldo no encontrado' });
    const { DSA_UMBRAL_MINIMO } = req.body;
    if (DSA_UMBRAL_MINIMO == null || DSA_UMBRAL_MINIMO === '') {
      return res.status(400).json({ error: 'DSA_UMBRAL_MINIMO es requerido' });
    }
    res.json(await service.updateUmbral(req.params.id, Number(DSA_UMBRAL_MINIMO)));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
