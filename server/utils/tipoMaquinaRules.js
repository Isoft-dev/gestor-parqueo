/** Normaliza texto de PAR_TIPO_MAQUINA.TMA_TIPO para reglas de negocio (sin acentos). */
export function normTipoMaquina(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isTipoMaquinaCobro(tmaTipo) {
  return normTipoMaquina(tmaTipo).includes('cobro');
}

export function isTipoMaquinaEntrada(tmaTipo) {
  const x = normTipoMaquina(tmaTipo);
  return x.includes('entrad') || x.includes('entrada');
}

export function isTipoMaquinaSalida(tmaTipo) {
  const x = normTipoMaquina(tmaTipo);
  return x.includes('salid') || x.includes('salida');
}
