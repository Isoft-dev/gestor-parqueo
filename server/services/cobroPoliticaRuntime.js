import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  COBRO_MINIMO_SUB_1H_ENABLED_DEFAULT,
  COBRO_MINIMO_SUB_1H_QUETZALES_DEFAULT,
} from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../data/cobro-politica.json');

function readJsonFile() {
  try {
    if (!fs.existsSync(DATA_PATH)) return {};
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeJsonFile(obj) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

export function getCobroPoliticaRuntimeRaw() {
  return readJsonFile();
}

export function getTarifaActivaRuntimeId() {
  const file = readJsonFile();
  const id = file?.tarifaActiva?.tarId;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function updateTarifaActivaRuntime(tarId) {
  const cur = readJsonFile();
  const n = Number(tarId);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('tarId inválido para tarifa activa');
  }
  cur.tarifaActiva = { ...(cur.tarifaActiva || {}), tarId: Math.trunc(n) };
  writeJsonFile(cur);
}

/**
 * Valores efectivos del mínimo &lt; 1 h: .env por defecto; `minimoSub1H` en JSON sobreescribe (panel admin).
 */
export function getCobroMinimoSub1hEffective() {
  const base = {
    habilitado: COBRO_MINIMO_SUB_1H_ENABLED_DEFAULT,
    quetzales: COBRO_MINIMO_SUB_1H_QUETZALES_DEFAULT,
  };
  const file = readJsonFile();
  const o = file.minimoSub1H || {};
  const fromFile =
    Object.prototype.hasOwnProperty.call(o, 'habilitado') ||
    Object.prototype.hasOwnProperty.call(o, 'quetzales');
  const habilitado = o.habilitado !== undefined ? !!o.habilitado : base.habilitado;
  const quetzales =
    o.quetzales !== undefined && Number.isFinite(Number(o.quetzales))
      ? Number(o.quetzales)
      : base.quetzales;
  return {
    habilitado,
    quetzales,
    origen: fromFile ? 'runtime' : 'env',
  };
}

export function updateMinimoSub1hRuntime(partial) {
  const cur = readJsonFile();
  cur.minimoSub1H = { ...(cur.minimoSub1H || {}), ...partial };
  writeJsonFile(cur);
}

export function clearMinimoSub1hRuntime() {
  const cur = readJsonFile();
  if (!cur.minimoSub1H) return;
  delete cur.minimoSub1H;
  if (Object.keys(cur).length === 0) {
    try {
      fs.unlinkSync(DATA_PATH);
    } catch {
      /* ignore */
    }
  } else {
    writeJsonFile(cur);
  }
}

export function clearTarifaActivaRuntime() {
  const cur = readJsonFile();
  if (!cur.tarifaActiva) return;
  delete cur.tarifaActiva;
  if (Object.keys(cur).length === 0) {
    try {
      fs.unlinkSync(DATA_PATH);
    } catch {
      /* ignore */
    }
  } else {
    writeJsonFile(cur);
  }
}
