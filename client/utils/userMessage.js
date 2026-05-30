/** Mensajes legibles para el usuario, sin URLs técnicas ni ruido de red. */
export function formatUserFacingMessage(raw) {
  let text = String(raw ?? '').trim();
  if (!text) return '';

  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/localhost(?::\d+)?/gi, '');
  text = text.replace(/\s{2,}/g, ' ').trim();

  if (/^failed to fetch\.?$/i.test(text)) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  if (/^networkerror/i.test(text)) {
    return 'Error de red. Intenta de nuevo en unos segundos.';
  }
  if (/ORA-02292/i.test(text)) {
    return 'No se puede eliminar porque este registro está siendo usado por otro.';
  }
  if (/ORA-20001/i.test(text)) {
    const cleaned = text.replace(/^.*?ORA-20001:\s*/i, '').split('\n')[0].trim();
    return cleaned || 'Esta operación no está permitida.';
  }
  if (/ORA-\d+/i.test(text)) {
    return 'Ocurrió un error al procesar la solicitud. Intenta de nuevo.';
  }

  text = text.replace(/^Error:\s*/i, '');
  return text.trim() || 'Ocurrió un error inesperado.';
}

export function isErrorLikeMessage(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^Error(:|\s)/i.test(t)) return true;
  if (/^No se puede\b/i.test(t)) return true;
  if (/^No se pudo\b/i.test(t)) return true;
  if (/^No existe\b/i.test(t)) return true;
  if (/^Ocurrió un error/i.test(t)) return true;
  return false;
}
