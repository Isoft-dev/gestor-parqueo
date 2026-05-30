/**
 * fieldValidation.js
 * Sanitizadores y validadores de campos de formulario.
 * Usado en CrudDemo y otros formularios del sistema.
 */

import { normalizePlateInput } from './plate.js';

// Solo letras (incluyendo acentos, ñ, ü, etc.), espacios y guiones
const LETTERS_ONLY = /[^a-záéíóúàèìòùâêîôûäëïöüñüãõçA-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÜÃÕÇ \-']/gi;

// Solo dígitos
const DIGITS_ONLY = /[^0-9]/g;

// Dígitos + K (para NIT guatemalteco)
const NIT_CHARS = /[^0-9kK]/g;

/**
 * Retorna el valor sanitizado según la clave de campo.
 * Si el campo no tiene regla especial, retorna el valor sin cambios.
 *
 * @param {string} key  - Clave del campo (ej. 'CLI_DPI', 'CLI_PRIMER_NOMBRE')
 * @param {string} value - Valor crudo del input
 * @returns {string}
 */
export function sanitizeFieldValue(key, value) {
  const k = String(key);
  const v = String(value ?? '');

  // ── Nombres y apellidos (clientes y usuarios) ──────────────────────────
  if (
    k.endsWith('_PRIMER_NOMBRE') ||
    k.endsWith('_SEGUNDO_NOMBRE') ||
    k.endsWith('_PRIMER_APELLIDO') ||
    k.endsWith('_SEGUNDO_APELLIDO')
  ) {
    return v.replace(LETTERS_ONLY, '');
  }

  // ── DPI (solo dígitos, máx 13) ─────────────────────────────────────────
  if (k === 'CLI_DPI') {
    return v.replace(DIGITS_ONLY, '').slice(0, 13);
  }

  // ── NIT (dígitos y K, máx 12) ─────────────────────────────────────────
  if (k === 'CLI_NIT') {
    return v.replace(NIT_CHARS, '').toUpperCase().slice(0, 12);
  }

  // ── Teléfono (solo dígitos, máx 15) ───────────────────────────────────
  if (k.endsWith('_TELEFONO')) {
    return v.replace(DIGITS_ONLY, '').slice(0, 15);
  }

  // ── Zona (solo dígitos, máx 5) ────────────────────────────────────────
  if (k === 'CLI_ZONA') {
    return v.replace(DIGITS_ONLY, '').slice(0, 5);
  }

  // ── Código postal (solo dígitos, máx 10) ──────────────────────────────
  if (k === 'CLI_CODIGO_POSTAL') {
    return v.replace(DIGITS_ONLY, '').slice(0, 10);
  }

  // ── Placas ─────────────────────────────────────────────────────────────
  if (k === 'VEH_PLACA' || k === 'MEM_VEH_PLACA') {
    return normalizePlateInput(v);
  }

  return v;
}

/**
 * Retorna el atributo inputMode apropiado para un campo.
 * @param {string} key
 * @returns {string|undefined}
 */
export function getInputMode(key) {
  const k = String(key);
  if (k === 'CLI_DPI' || k.endsWith('_TELEFONO') || k === 'CLI_ZONA' || k === 'CLI_CODIGO_POSTAL') {
    return 'numeric';
  }
  if (k === 'CLI_NIT') return 'text';
  return undefined;
}

/**
 * Retorna el maxLength para un campo, si aplica.
 * @param {string} key
 * @returns {number|undefined}
 */
export function getMaxLength(key) {
  const k = String(key);
  if (k === 'CLI_DPI') return 13;
  if (k === 'CLI_NIT') return 12;
  if (k.endsWith('_TELEFONO')) return 15;
  if (k === 'CLI_ZONA') return 5;
  if (k === 'CLI_CODIGO_POSTAL') return 10;
  return undefined;
}
