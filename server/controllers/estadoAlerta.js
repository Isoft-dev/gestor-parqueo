import * as service from '../services/estadoAlerta.js';

export async function getAll(_req, res) {
  try {
    res.json(await service.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
<<<<<<< HEAD
    if (!row) return res.status(404).json({ error: 'Estado de alerta no encontrado' });
=======
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
>>>>>>> 7201aaf1947b037e8bed0619c18efd831d4ccfe7
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { EAL_ID, EAL_ESTADO } = req.body;
    if (!EAL_ID || !EAL_ESTADO) {
<<<<<<< HEAD
      return res.status(400).json({
        error: 'EAL_ID y EAL_ESTADO son requeridos',
      });
=======
      return res.status(400).json({ error: 'Faltan campos requeridos' });
>>>>>>> 7201aaf1947b037e8bed0619c18efd831d4ccfe7
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
<<<<<<< HEAD
=======

>>>>>>> 7201aaf1947b037e8bed0619c18efd831d4ccfe7
