import * as service from '../services/maquina.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrada/i.test(msg)) return 404;
  if (/requerid|fk|ORA-02291|ORA-01400/i.test(msg)) return 400;
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
    if (!row) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { MAQ_CODIGO, TMA_ID, EMA_ID } = req.body;
    if (!MAQ_CODIGO || !TMA_ID || !EMA_ID) {
      return res.status(400).json({ error: 'MAQ_CODIGO, TMA_ID y EMA_ID son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getTransactions(req, res) {
  try {
    const maquina = await service.getById(req.params.id);
    if (!maquina) return res.status(404).json({ error: 'Máquina no encontrada' });
    res.json(await service.getTransactionsByMaqId(req.params.id));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
