export const PLATE_MAX_LENGTH = 7;

const ALPHANUMERIC_ONLY = /[^A-Z0-9]/g;
const PLATE_REGEX = /^[A-Z0-9]{1,7}$/;

export function normalizePlateInput(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(ALPHANUMERIC_ONLY, '')
    .slice(0, PLATE_MAX_LENGTH);
}

export function getPlateValidationMessage(value) {
  const plate = String(value ?? '').trim().toUpperCase();
  if (!plate) return 'La placa es obligatoria.';
  if (plate.length > PLATE_MAX_LENGTH) return `La placa debe tener máximo ${PLATE_MAX_LENGTH} caracteres.`;
  if (!/^[A-Z0-9]+$/.test(plate)) {
    return 'La placa solo puede contener letras y números, sin espacios ni caracteres especiales.';
  }
  return '';
}

export function isValidPlate(value) {
  return PLATE_REGEX.test(String(value ?? '').trim().toUpperCase());
}
