/**
 * Etiquetas legibles para columnas estilo Oracle (PREFIJO_CAMPO).
 * Usado en tablas y vistas donde la API devuelve nombres de columna literales.
 */

/** Prefijos TAB_ de TAB_CAMPO → nombre corto en español (para heurística). */
const TABLE_PREFIX_ES = {
  ALE: 'Alerta',
  BIV: 'Bitácora incidente',
  CLI: 'Cliente',
  COB: 'Cobro',
  DMT: 'Det. máquina/ticket',
  DPM: 'Det. pago membresía',
  DSA: 'Detalle saldo',
  EAL: 'Estado alerta',
  EES: 'Estado espacio',
  EMA: 'Estado máquina',
  EME: 'Estado membresía',
  ETI: 'Estado ticket',
  ESP: 'Espacio',
  INC: 'Incidente',
  MAQ: 'Máquina',
  MEM: 'Membresía',
  NOT: 'Notificación',
  PAG: 'Pago',
  REM: 'Mantenimiento',
  RMA: 'Recarga máquina',
  RMM: 'Mov. membresía',
  ROL: 'Rol',
  SDI: 'Saldo disponible',
  TAL: 'Tipo alerta',
  TAR: 'Tarifa',
  TCO: 'Tipo cobro',
  TIC: 'Ticket',
  TMA: 'Tipo máquina',
  TME: 'Tipo membresía',
  TNO: 'Tipo notificación',
  TPA: 'Tipo pago',
  TVE: 'Tipo vehículo',
  USU: 'Usuario',
  VEH: 'Vehículo',
};

const KNOWN_TAIL_WORDS = {
  ID: 'ID',
  NIT: 'NIT',
  DPI: 'DPI',
  CF: 'CF',
};

function formatTailWord(part) {
  const u = part.toUpperCase();
  if (KNOWN_TAIL_WORDS[u]) return KNOWN_TAIL_WORDS[u];
  if (part.length <= 2) return part;
  return part.charAt(0) + part.slice(1).toLowerCase();
}

/**
 * Convierte una clave desconocida a etiqueta legible (fallback).
 * @param {string} key
 * @returns {string}
 */
export function humanizeDbColumn(key) {
  const raw = String(key ?? '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();

  const idOnly = /^([A-Z]{2,5})_ID$/i.exec(raw);
  if (idOnly) {
    const pref = idOnly[1].toUpperCase();
    const label = TABLE_PREFIX_ES[pref];
    return label ? `${label} (ID)` : `${formatTailWord(pref)} (ID)`;
  }

  const parts = upper.split('_').filter(Boolean);
  if (parts.length >= 2) {
    const pref = parts[0];
    if (TABLE_PREFIX_ES[pref]) {
      const tail = parts.slice(1).map((p) => formatTailWord(p)).join(' ');
      return `${TABLE_PREFIX_ES[pref]}: ${tail}`;
    }
  }

  return parts.map((p) => formatTailWord(p)).join(' ');
}

/**
 * Construye mapa k → l desde la config CRUD (SECTIONS).
 * @param {Record<string, { entities: { fields: { k: string, l: string }[] }[] }>} sections
 * @returns {Record<string, string>}
 */
export function buildLabelMapFromCrudFields(sections) {
  const m = Object.create(null);
  for (const s of Object.values(sections)) {
    for (const e of s.entities || []) {
      for (const f of e.fields || []) {
        if (f?.k && m[f.k] === undefined) m[f.k] = f.l;
      }
    }
  }
  return m;
}

/**
 * @param {string} key nombre de columna
 * @param {Record<string, string> | null | undefined} labelMap mapa opcional (p. ej. desde SECTIONS)
 * @returns {string}
 */
export function getDbColumnLabel(key, labelMap) {
  const k = String(key ?? '');
  if (!k) return '';
  if (labelMap && labelMap[k]) {
    const lbl = labelMap[k];
    // Si en SECTIONS quedó `l` igual al nombre de columna, usar heurística.
    if (lbl === k) return humanizeDbColumn(k);
    // En formularios muchas PK usan l:'ID'; en tablas con varias columnas *_ID eso repite "ID" sin contexto.
    if (lbl === 'ID' && /_ID$/i.test(k)) return humanizeDbColumn(k);
    return lbl;
  }
  return humanizeDbColumn(k);
}
