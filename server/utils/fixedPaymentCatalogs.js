export const FIXED_PAYMENT_CATALOG_ERROR =
  'Este catalogo es fijo del sistema: solo se permiten Efectivo y Tarjeta.';

export function assertFixedPaymentCatalogLocked() {
  throw new Error(FIXED_PAYMENT_CATALOG_ERROR);
}
