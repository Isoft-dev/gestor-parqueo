import * as service from '../services/alerta.js';

export async function getAll(_req, res) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await service.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    res.set('Cache-Control', 'no-store');
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { ALE_MOTIVO, EAL_ID, TAL_ID } = req.body || {};
    if (!String(ALE_MOTIVO ?? '').trim()) {
      return res.status(400).json({ error: 'El motivo de la alerta es obligatorio.' });
    }
    if (EAL_ID == null || String(EAL_ID).trim() === '' || TAL_ID == null || String(TAL_ID).trim() === '') {
      return res.status(400).json({ error: 'Debe elegir estado (EAL_ID) y tipo (TAL_ID) de la alerta.' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    const updated = await service.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function solicitudAsistencia(req, res) {
  try {
    const { MAQ_ID, ALE_MOTIVO } = req.body || {};
    if (!MAQ_ID) return res.status(400).json({ error: 'MAQ_ID es requerido' });
    const created = await service.createSolicitudAsistencia({ MAQ_ID, ALE_MOTIVO });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

