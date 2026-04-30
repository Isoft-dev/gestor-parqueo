import * as service from '../services/registroMovimientoMembresia.js';

export async function getAll(req, res) {
  try {
    const placa = String(req.query.placa ?? req.query.q ?? '').trim();
    res.json(await service.getAll({ placa }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { MEM_ID } = req.body;
    if (!MEM_ID) {
      return res.status(400).json({ error: 'MEM_ID es requerido' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

