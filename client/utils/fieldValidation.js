/**
 * fieldValidation.js
 * Sanitizadores, placeholders y validadores de campos de formulario.
 */

import { normalizePlateInput, PLATE_MAX_LENGTH } from './plate.js';

const LETTERS_ONLY = /[^a-záéíóúàèìòùâêîôûäëïöüñüãõçA-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÜÃÕÇ \-']/gi;
const DIGITS_ONLY = /[^0-9]/g;
const NIT_CHARS = /[^0-9kK]/g;
const EMAIL_CHARS = /[^a-zA-Z0-9@._+\-]/g;
const CODE_CHARS = /[^a-zA-Z0-9_\-]/g;
const ADDRESS_CHARS = /[^a-zA-Z0-9áéíóúàèìòùâêîôûäëïöüñüãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÜÃÕÇ \-#.,/]/g;
const LABEL_TEXT_CHARS = /[^a-zA-Z0-9áéíóúàèìòùâêîôûäëïöüñüãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÜÃÕÇ \-().,/]/g;
const DESCRIPTION_CHARS = /[^a-zA-Z0-9áéíóúàèìòùâêîôûäëïöüñüãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÜÃÕÇ \-#.,;:()!?/%\n\r]/g;
const PASSWORD_CHARS = /[^\x21-\x7E]/g;
const DECIMAL_CHARS = /[^0-9.]/g;

function isNameKey(k) {
  return (
    k.endsWith('_PRIMER_NOMBRE') ||
    k.endsWith('_SEGUNDO_NOMBRE') ||
    k.endsWith('_PRIMER_APELLIDO') ||
    k.endsWith('_SEGUNDO_APELLIDO')
  );
}

function isDescriptionKey(k) {
  return (
    k.endsWith('_DESCRIPCION') ||
    k.endsWith('_DESCRIPCION_SOLUCION') ||
    k === 'ALE_MOTIVO' ||
    k === 'BIV_DESCRIPCION'
  );
}

function isCatalogLabelKey(k) {
  return (
    k.endsWith('_TIPO') ||
    k.endsWith('_ESTADO') ||
    k.endsWith('_NOMBRE') ||
    k === 'TAR_TIPO' ||
    k === 'SDI_TIPO' ||
    k === 'INC_TIPO'
  );
}

function isNumericIdKey(k) {
  return (
    k.endsWith('_ID') &&
    k !== 'VEH_ID' &&
    !k.startsWith('ESP_') &&
    k !== 'MOD_ID'
  );
}

function isMoneyOrDecimalKey(k) {
  return (
    k.includes('MONTO') ||
    k.includes('PRECIO') ||
    k.includes('SUBTOTAL') ||
    k.includes('VUELTO') ||
    k.includes('VALOR') ||
    k.includes('HORAS') ||
    k.includes('UMBRAL')
  );
}

function sanitizeDecimal(value, maxDecimals = 2) {
  let v = String(value ?? '').replace(DECIMAL_CHARS, '');
  const parts = v.split('.');
  if (parts.length > 2) {
    v = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  if (parts.length === 2 && maxDecimals >= 0) {
    const [intPart, decPart = ''] = v.split('.');
    return decPart ? `${intPart}.${decPart.slice(0, maxDecimals)}` : intPart;
  }
  return v;
}

function sanitizeInteger(value, maxLen) {
  const v = String(value ?? '').replace(DIGITS_ONLY, '');
  return maxLen ? v.slice(0, maxLen) : v;
}

/**
 * Retorna el valor sanitizado según la clave de campo.
 * @param {string} key
 * @param {string} value
 * @param {{ fieldType?: string }} [opts]
 */
export function sanitizeFieldValue(key, value, opts = {}) {
  const k = String(key);
  const fieldType = opts.fieldType || '';
  const v = String(value ?? '');

  if (fieldType === 'number' || isMoneyOrDecimalKey(k)) {
    if (k.includes('DURACION') || k.includes('CANTIDAD') || k.includes('TIEMPO_GRACIA') || k.endsWith('_ID')) {
      return sanitizeInteger(v);
    }
    return sanitizeDecimal(v);
  }

  if (isNameKey(k)) {
    return v.replace(LETTERS_ONLY, '');
  }

  if (k.endsWith('_CORREO')) {
    return v.replace(EMAIL_CHARS, '').slice(0, 120);
  }

  if (k === 'CLI_DPI') {
    return v.replace(DIGITS_ONLY, '').slice(0, 13);
  }

  if (k === 'CLI_NIT' || k === 'COB_NIT') {
    const upper = v.toUpperCase();
    if (upper === 'C' || upper === 'CF' || upper.startsWith('CF')) {
      return upper.replace(/[^CF]/g, '').slice(0, 2);
    }
    return upper.replace(NIT_CHARS, '').slice(0, 12);
  }

  if (k.endsWith('_TELEFONO')) {
    return v.replace(DIGITS_ONLY, '').slice(0, 15);
  }

  if (k === 'CLI_ZONA') {
    return v.replace(DIGITS_ONLY, '').slice(0, 5);
  }

  if (k === 'CLI_CODIGO_POSTAL') {
    return v.replace(DIGITS_ONLY, '').slice(0, 10);
  }

  if (k === 'VEH_PLACA' || k === 'MEM_VEH_PLACA' || (k === 'VEH_ID' && opts.asPlate)) {
    return normalizePlateInput(v);
  }

  if (k === 'MAQ_CODIGO' || k === 'ESP_CODIGO' || k === 'TIC_CODIGO') {
    return v.replace(CODE_CHARS, '').slice(0, 40);
  }

  if (k === 'CLI_NUMERO') {
    return v.replace(/[^a-zA-Z0-9#\-]/g, '').slice(0, 20);
  }

  if (k === 'CLI_CALLE' || k === 'CLI_COLONIA' || k === 'CLI_CIUDAD' || k === 'ESP_UBICACION') {
    return v.replace(ADDRESS_CHARS, '').slice(0, 120);
  }

  if (isDescriptionKey(k)) {
    return v.replace(DESCRIPTION_CHARS, '').slice(0, 500);
  }

  if (isCatalogLabelKey(k)) {
    return v.replace(LABEL_TEXT_CHARS, '').slice(0, 80);
  }

  if (k === 'USU_PASSWORD') {
    return v.replace(PASSWORD_CHARS, '').slice(0, 64);
  }

  if (k === 'DMT_TRANSACCION') {
    return v.replace(/[^A-Z0-9_]/g, '').slice(0, 40);
  }

  if (isNumericIdKey(k) && fieldType !== 'text') {
    return sanitizeInteger(v, 12);
  }

  return v;
}

/** Sanitiza valores de filtros de búsqueda (más permisivos que formularios). */
export function sanitizeSearchValue(kind, value) {
  const v = String(value ?? '');
  switch (kind) {
    case 'placa':
      return normalizePlateInput(v);
    case 'nit':
      return sanitizeFieldValue('COB_NIT', v);
    case 'nombre':
      return v.replace(LETTERS_ONLY, '').slice(0, 80);
    case 'dpi':
      return v.replace(DIGITS_ONLY, '').slice(0, 13);
    case 'ticket':
      return v.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 30);
    case 'codigo':
      return v.replace(CODE_CHARS, '').slice(0, 40);
    case 'cobro':
      return v.replace(/[^a-zA-Z0-9kK\- ]/g, '').slice(0, 30);
    case 'cliente':
      return v.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ \-']/g, '').slice(0, 80);
    case 'general':
    default:
      return v.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ @.\-_]/g, '').slice(0, 80);
  }
}

export function getInputMode(key) {
  const k = String(key);
  if (k === 'CLI_DPI' || k.endsWith('_TELEFONO') || k === 'CLI_ZONA' || k === 'CLI_CODIGO_POSTAL') {
    return 'numeric';
  }
  if (k === 'CLI_NIT' || k === 'COB_NIT') return 'text';
  if (k.endsWith('_CORREO')) return 'email';
  if (k === 'VEH_PLACA' || k === 'MEM_VEH_PLACA') return 'text';
  if (isMoneyOrDecimalKey(k)) return 'decimal';
  return undefined;
}

export function getMaxLength(key) {
  const k = String(key);
  if (k === 'CLI_DPI') return 13;
  if (k === 'CLI_NIT' || k === 'COB_NIT') return 12;
  if (k.endsWith('_TELEFONO')) return 15;
  if (k === 'CLI_ZONA') return 5;
  if (k === 'CLI_CODIGO_POSTAL') return 10;
  if (k === 'VEH_PLACA' || k === 'MEM_VEH_PLACA') return PLATE_MAX_LENGTH;
  if (k.endsWith('_CORREO')) return 120;
  if (k === 'MAQ_CODIGO' || k === 'ESP_CODIGO') return 40;
  if (k === 'USU_PASSWORD') return 64;
  if (isDescriptionKey(k)) return 500;
  if (isNameKey(k)) return 60;
  return undefined;
}

const PLACEHOLDER_BY_KEY = {
  CLI_PRIMER_NOMBRE: 'Ej. María',
  CLI_SEGUNDO_NOMBRE: 'Ej. José (opcional)',
  CLI_PRIMER_APELLIDO: 'Ej. López',
  CLI_SEGUNDO_APELLIDO: 'Ej. García (opcional)',
  CLI_DPI: 'Ej. 1234567890123 (13 dígitos)',
  CLI_NIT: 'Ej. 1234567-K o dejar vacío',
  CLI_CORREO: 'Ej. cliente@correo.com',
  CLI_TELEFONO: 'Ej. 50212345678',
  CLI_ZONA: 'Ej. 10',
  CLI_CALLE: 'Ej. 5a Avenida',
  CLI_NUMERO: 'Ej. 12-34 o 15B',
  CLI_COLONIA: 'Ej. Colonia Centro',
  CLI_CIUDAD: 'Ej. Guatemala',
  CLI_CODIGO_POSTAL: 'Ej. 01001',
  USU_PRIMER_NOMBRE: 'Ej. Ana',
  USU_SEGUNDO_NOMBRE: 'Ej. Lucía (opcional)',
  USU_PRIMER_APELLIDO: 'Ej. Morales',
  USU_SEGUNDO_APELLIDO: 'Ej. Ruiz (opcional)',
  USU_CORREO: 'Ej. usuario@empresa.com',
  USU_PASSWORD: 'Mínimo 8 caracteres',
  USU_TELEFONO: 'Ej. 50255551234',
  VEH_PLACA: 'Ej. P123ABC',
  MEM_VEH_PLACA: 'Ej. P123ABC',
  VEH_ID: 'Ej. P123ABC',
  MAQ_CODIGO: 'Ej. Entrada_1',
  ESP_CODIGO: 'Ej. A-015',
  ESP_UBICACION: 'Ej. Nivel 2, sector norte',
  TAR_TIPO: 'Ej. Estándar',
  TAR_PRECIO: 'Ej. 8.00',
  TAR_TIEMPO_GRACIA: 'Ej. 15',
  TCO_TIPO: 'Ej. Efectivo',
  TCO_DESCRIPCION: 'Ej. Pago en caja',
  COB_NIT: 'Ej. 1234567-K o CF',
  COB_HORAS_TOTALES: 'Ej. 2.5',
  COB_MONTO_TOTAL: 'Ej. 16.00',
  COB_MONTO_RECIBIDO: 'Ej. 20.00',
  COB_VUELTO: 'Ej. 4.00',
  TIC_CODIGO: 'Ej. TIC-20260529-001',
  TME_TIPO: 'Ej. Mensual básico',
  TME_DURACION: 'Ej. 30',
  TME_PRECIO: 'Ej. 450.00',
  TVE_TIPO: 'Ej. Sedán',
  MAR_NOMBRE: 'Ej. Toyota',
  MOD_NOMBRE: 'Ej. Corolla',
  COL_NOMBRE: 'Ej. Blanco',
  INC_TIPO: 'Ej. Rayón',
  ALE_MOTIVO: 'Ej. Saldo bajo en caja',
  BIV_DESCRIPCION: 'Ej. Choque leve en columna 3',
  REM_DESCRIPCION: 'Ej. Limpieza de sensor y prueba',
  RMA_DESCRIPCION: 'Ej. Recarga de billetes',
  EMA_DESCRIPCION: 'Ej. Fuera de servicio por revisión',
  TMA_DESCRIPCION: 'Ej. Equipo de cobro automático',
  SDI_TIPO: 'Ej. Billete',
  SDI_VALOR: 'Ej. 20',
  DSA_CANTIDAD: 'Ej. 10',
  PAG_MONTO_TOTAL: 'Ej. 450.00',
  PAG_MONTO_RECIBIDO: 'Ej. 500.00',
  PAG_VUELTO: 'Ej. 50.00',
  ROL_DESCRIPCION: 'Ej. Acceso completo al panel',
  TNO_DESCRIPCION: 'Ej. Aviso de vencimiento',
  TPA_DESCRIPCION: 'Ej. Transferencia bancaria',
};

const SEARCH_PLACEHOLDERS = {
  placa: 'Ej. P123ABC',
  ticket: 'Ej. código de ticket o placa',
  cobro: 'Ej. ID de ticket o NIT',
  cliente: 'Ej. nombre, apellido o DPI',
  membresia: 'Ej. cliente o placa',
  vehiculo: 'Ej. placa o modelo',
  maquina: 'Ej. código de máquina',
  detalleMaq: 'Ej. placa o ticket',
  rmm: 'Ej. placa del vehículo',
  dpm: 'Ej. placa o cliente',
  biv: 'Ej. P123ABC',
  general: 'Escribe para filtrar…',
};

/**
 * Placeholder de ayuda para un campo de formulario.
 * @param {string} key
 * @param {{ label?: string, fieldType?: string, isAutoId?: boolean, explicit?: string }} [opts]
 */
export function getFieldPlaceholder(key, opts = {}) {
  if (opts.explicit) return opts.explicit;
  if (opts.isAutoId) return 'Se genera automáticamente al guardar';

  const k = String(key);
  if (PLACEHOLDER_BY_KEY[k]) return PLACEHOLDER_BY_KEY[k];

  const t = opts.fieldType || '';
  if (t === 'datetime-local') return 'Selecciona fecha y hora';
  if (t === 'date') return 'Selecciona una fecha';
  if (t === 'password') return 'Ingresa tu contraseña';
  if (t === 'number') {
    if (k.includes('DURACION')) return 'Ej. 30 (días)';
    if (k.includes('CANTIDAD')) return 'Ej. 5';
    if (k.includes('PRECIO') || k.includes('MONTO')) return 'Ej. 0.00';
    if (k.includes('HORAS')) return 'Ej. 1.5';
    return 'Solo números';
  }
  if (t === 'select') return 'Selecciona una opción';

  if (isDescriptionKey(k)) return 'Escribe una descripción breve…';
  if (isNameKey(k)) return 'Solo letras';
  if (k.endsWith('_CORREO')) return 'Ej. nombre@correo.com';
  if (k.endsWith('_ID')) return 'Ej. 12345';
  if (isCatalogLabelKey(k)) return `Ej. ${String(opts.label || 'valor').toLowerCase()}`;

  return `Ingresa ${String(opts.label || 'el valor').toLowerCase()}`;
}

export function getSearchPlaceholder(kind) {
  return SEARCH_PLACEHOLDERS[kind] || SEARCH_PLACEHOLDERS.general;
}
