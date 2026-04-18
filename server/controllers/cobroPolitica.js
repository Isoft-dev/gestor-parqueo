import {
  getCobroMinimoSub1hEffective,
  updateMinimoSub1hRuntime,
  clearMinimoSub1hRuntime,
} from '../services/cobroPoliticaRuntime.js';

export async function get(_req, res) {
  try {
    res.json(getCobroMinimoSub1hEffective());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function put(req, res) {
  try {
    const { habilitado, quetzales } = req.body || {};
    const patch = {};
    if (habilitado !== undefined) patch.habilitado = !!habilitado;
    if (quetzales !== undefined) patch.quetzales = Number(quetzales);
    updateMinimoSub1hRuntime(patch);
    res.json(getCobroMinimoSub1hEffective());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(_req, res) {
  try {
    clearMinimoSub1hRuntime();
    res.json(getCobroMinimoSub1hEffective());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
