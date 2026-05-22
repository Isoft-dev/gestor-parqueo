import * as service from '../services/tipoPago.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/requerid|pagos asociados|catálogo es fijo|catalogo es fijo|ORA-20001|ORA-02292/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { TPA_TIPO } = req.body;
    if (!TPA_TIPO) return res.status(400).json({ error: 'TPA_TIPO es requerido' });
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function deleteItem(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tipo de pago no encontrado' });
    const deleted = await service.deleteItem(req.params.id);
    if (!deleted) {
      return res.status(400).json({
        error: 'No se puede eliminar el tipo de pago porque tiene pagos asociados',
      });
    }
    res.status(204).send();
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
