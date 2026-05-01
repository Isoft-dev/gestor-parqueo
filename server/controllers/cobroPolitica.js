import {
  getCobroMinimoSub1hEffective,
  getTarifaActivaRuntimeId,
  updateMinimoSub1hRuntime,
  updateTarifaActivaRuntime,
  clearMinimoSub1hRuntime,
  clearTarifaActivaRuntime,
} from '../services/cobroPoliticaRuntime.js';
import { executeSql } from '../db/oracle.js';

async function fetchTarifaById(id) {
  const rows = await executeSql(
    `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
       FROM PAR_TARIFA
      WHERE TAR_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

async function fetchTarifaLatest() {
  const rows = await executeSql(
    `SELECT TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA
       FROM PAR_TARIFA
      ORDER BY TAR_ID DESC`
  );
  return rows[0] || null;
}

async function buildCobroPoliticaResponse() {
  const minimo = getCobroMinimoSub1hEffective();
  const runtimeTarId = getTarifaActivaRuntimeId();
  let activa = null;
  let selectedBy = 'latest';
  if (runtimeTarId != null) {
    const hit = await fetchTarifaById(runtimeTarId);
    if (hit) {
      activa = hit;
      selectedBy = 'runtime';
    }
  }
  if (!activa) {
    activa = await fetchTarifaLatest();
  }
  return {
    ...minimo,
    tarifaActivaTarId: activa?.TAR_ID ?? null,
    tarifaActiva: activa,
    tarifaActivaOrigen: selectedBy,
  };
}

export async function get(_req, res) {
  try {
    res.json(await buildCobroPoliticaResponse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function put(req, res) {
  try {
    const { habilitado, quetzales, tarifaActivaTarId } = req.body || {};
    const patch = {};
    if (habilitado !== undefined) patch.habilitado = !!habilitado;
    if (quetzales !== undefined) patch.quetzales = Number(quetzales);
    if (tarifaActivaTarId !== undefined) {
      const tarifa = await fetchTarifaById(tarifaActivaTarId);
      if (!tarifa) return res.status(400).json({ error: 'La tarifa activa seleccionada no existe' });
      updateTarifaActivaRuntime(tarifaActivaTarId);
    }
    updateMinimoSub1hRuntime(patch);
    res.json(await buildCobroPoliticaResponse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(_req, res) {
  try {
    clearMinimoSub1hRuntime();
    clearTarifaActivaRuntime();
    res.json(await buildCobroPoliticaResponse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
