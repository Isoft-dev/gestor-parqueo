function normalizeMachineStatusText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isMachineStatusOutOfService(value) {
  const x = normalizeMachineStatusText(value);
  return (
    (x.includes('fuera') && x.includes('servicio'))
    || x.includes('no disponible')
    || x.includes('averiad')
  );
}

export function isMachineStatusOperative(value) {
  const x = normalizeMachineStatusText(value);
  if (!x) return false;
  if (x.includes('fuera') && x.includes('servicio')) return false;
  if (x.includes('manten')) return false;
  if (x.includes('inoper')) return false;
  if (x.includes('desactiv')) return false;
  if (x.includes('pendiente') && x.includes('activ')) return false;
  return (
    x.includes('operativ')
    || x.includes('habilitad')
    || x === 'activa'
    || (x.includes('en') && x.includes('servicio'))
  );
}

export function isMachineStatusMaintenance(value) {
  const x = normalizeMachineStatusText(value);
  return x.includes('manten') || x.includes('revision') || (x.includes('servicio') && x.includes('tecnic'));
}

export function filterOperativeMachines(list) {
  const rows = Array.isArray(list) ? list : [];
  return rows.filter((row) => isMachineStatusOperative(row?.EMA_ESTADO ?? row?.ema_estado));
}

export function filterMaintenanceEligibleMachines(list) {
  const rows = Array.isArray(list) ? list : [];
  return rows.filter((row) => {
    const estado = row?.EMA_ESTADO ?? row?.ema_estado;
    return isMachineStatusOperative(estado) || isMachineStatusMaintenance(estado);
  });
}

export function getMaintenanceMovementForMachine(row) {
  const estado = row?.EMA_ESTADO ?? row?.ema_estado;
  if (isMachineStatusMaintenance(estado)) return 'FINALIZACION';
  if (isMachineStatusOperative(estado)) return 'INICIO';
  return '';
}

export function pickInoperativeMachineStatusId(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  const match = rows.find((row) => {
    const x = normalizeMachineStatusText(row?.EMA_ESTADO ?? row?.ema_estado);
    return (
      x.includes('inoper')
      || x.includes('desactiv')
      || (x.includes('pendiente') && x.includes('activ'))
      || (x.includes('sin') && x.includes('activar'))
    );
  });
  return match?.EMA_ID ?? match?.ema_id ?? null;
}

export function filterMaintenanceResultMachineStatuses(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  return rows.filter((row) => {
    const estado = row?.EMA_ESTADO ?? row?.ema_estado;
    return isMachineStatusOperative(estado) || isMachineStatusOutOfService(estado);
  });
}

export function filterManualMachineStatuses(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  return rows.filter((row) => !isMachineStatusMaintenance(row?.EMA_ESTADO ?? row?.ema_estado));
}
