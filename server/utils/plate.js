export const PLATE_MAX_LENGTH = 7;

const PLATE_REGEX = /^[A-Z0-9]{1,7}$/;

export function normalizePlate(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function assertValidPlate(value, label = 'La placa') {
  const plate = normalizePlate(value);
  if (!plate) throw new Error(`${label} es obligatoria.`);
  if (plate.length > PLATE_MAX_LENGTH) {
    throw new Error(`${label} debe tener máximo ${PLATE_MAX_LENGTH} caracteres.`);
  }
  if (!PLATE_REGEX.test(plate)) {
    throw new Error(`${label} solo puede contener letras y números, sin espacios ni caracteres especiales.`);
  }
  return plate;
}
