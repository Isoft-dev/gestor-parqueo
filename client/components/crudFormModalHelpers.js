import {
  filterMaintenanceEligibleMachines,
  filterMaintenanceResultMachineStatuses,
  filterManualMachineStatuses,
  filterOperativeMachines,
  getMaintenanceMovementForMachine,
  isMachineStatusMaintenance,
  pickInoperativeMachineStatusId,
} from '../utils/machineStatus.js';

export {
  filterMaintenanceResultMachineStatuses,
  getMaintenanceMovementForMachine,
  isMachineStatusMaintenance,
  pickInoperativeMachineStatusId,
};

export function toInput(v, t) {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d)) return '';
    return t === 'date' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

export function toDateTimeLocalInput(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function calcMembresiaVencimientoInput(fechaInicio, duracionDias) {
  const dias = Number(duracionDias);
  if (!fechaInicio || !Number.isFinite(dias) || dias <= 0) return '';
  const ini = new Date(fechaInicio);
  if (Number.isNaN(ini.getTime())) return '';
  const venc = new Date(ini);
  venc.setDate(venc.getDate() + dias);
  return toDateTimeLocalInput(venc);
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function shouldHideFieldOnCreate(entityKey, fieldKey) {
  return entityKey === 'bitacora-incidente-vehiculo' && ['BIV_FECHA_RESOLUCION', 'USU_ID'].includes(fieldKey);
}

export function shouldHideFieldForCurrentForm(entityKey, fieldKey, form, isNewRecord = false) {
  if (
    entityKey === 'registro-mantenimiento'
    && fieldKey === 'REM_ESTADO_RESULTANTE_EMA_ID'
    && String(form?.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase() !== 'FINALIZACION'
  ) {
    return true;
  }
  if (entityKey === 'maquina' && fieldKey === 'MAQ_FECHA_ULTIMA_RECARGA') {
    return true;
  }
  if (entityKey === 'tarifa' && fieldKey === 'TAR_ID' && isNewRecord) {
    return true;
  }
  return false;
}

export function isCurrentSessionUser(rowUserId, sessionUserId) {
  if (rowUserId == null || sessionUserId == null) return false;
  return String(rowUserId).trim() !== '' && String(rowUserId) === String(sessionUserId);
}

function normTipoMaquinaClient(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isTipoMaquinaCobroClient(tmaTipo) {
  const x = normTipoMaquinaClient(tmaTipo);
  return x.includes('cobro') || x.includes('caja');
}

export function labelMaquina(row, catalogOptions) {
  const maqId = row?.MAQ_ID ?? row?.maq_id;
  if (maqId == null || maqId === '') return '—';
  const maq = (catalogOptions?.maquina || []).find((m) => String(m.MAQ_ID) === String(maqId));
  if (!maq) return String(maqId);
  const tma = (catalogOptions?.['tipo-maquina'] || []).find((t) => String(t.TMA_ID) === String(maq.TMA_ID));
  let tipo = String(tma?.TMA_TIPO || '').trim();
  if (!tipo) {
    const cod = String(maq.MAQ_CODIGO || '').toLowerCase();
    if (cod.includes('ent')) tipo = 'entrada';
    else if (cod.includes('cob')) tipo = 'cobro';
    else if (cod.includes('sal')) tipo = 'salida';
    else tipo = 'máquina';
  }
  const tipoNorm = String(tipo).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!tipoNorm.includes('maquina')) tipo = `Máquina de ${tipo.toLowerCase()}`;
  return `${tipo} ${maq.MAQ_ID}`;
}

export function maquinasTipoCobroList(catalogOptions, { onlyOperative = false } = {}) {
  const maqsBase = catalogOptions?.maquina || [];
  const maqs = onlyOperative ? filterOperativeMachines(maqsBase) : maqsBase;
  const tipos = catalogOptions?.['tipo-maquina'] || [];
  return maqs.filter((m) => {
    const t = tipos.find((t0) => String(t0.TMA_ID) === String(m.TMA_ID));
    return t != null && isTipoMaquinaCobroClient(t.TMA_TIPO);
  });
}

export function maquinasOperativasList(catalogOptions) {
  return filterOperativeMachines(catalogOptions?.maquina || []);
}

export function maquinasMantenimientoElegiblesList(catalogOptions) {
  return filterMaintenanceEligibleMachines(catalogOptions?.maquina || []);
}

export function findMachineById(catalogOptions, maqId) {
  if (maqId == null || String(maqId).trim() === '') return null;
  return (catalogOptions?.maquina || []).find((row) => String(row.MAQ_ID) === String(maqId)) || null;
}

export function maintenanceMovementOptionsForMachine(machine) {
  const movement = getMaintenanceMovementForMachine(machine);
  if (!movement) return [];
  if (movement === 'FINALIZACION') return [{ value: 'FINALIZACION', label: 'Finalización' }];
  return [{ value: 'INICIO', label: 'Inicio' }];
}

export function maintenanceMovementHelp(machine) {
  if (!machine) {
    return 'Selecciona una máquina operativa o en mantenimiento para que el movimiento se defina automáticamente.';
  }
  const estado = String(machine.EMA_ESTADO ?? '').trim() || 'Sin estado';
  if (isMachineStatusMaintenance(estado)) {
    return `La máquina está en ${estado}; este registro cerrará el mantenimiento con una finalización.`;
  }
  const movement = getMaintenanceMovementForMachine(machine);
  if (movement === 'INICIO') {
    return `La máquina está ${estado}; este registro abrirá el mantenimiento con un inicio.`;
  }
  return `La máquina está ${estado} y no admite movimientos de mantenimiento desde este formulario.`;
}

export function isMaquinaCobroRow(row, catalogOptions) {
  const tipos = catalogOptions?.['tipo-maquina'] || [];
  const tipo = tipos.find((t) => String(t.TMA_ID) === String(row?.TMA_ID));
  return tipo != null && isTipoMaquinaCobroClient(tipo.TMA_TIPO);
}

export function isMachineStatusMaintenanceById(catalogOptions, emaId) {
  if (emaId == null || String(emaId).trim() === '') return false;
  const estados = catalogOptions?.['estado-maquina'] || [];
  const estado = estados.find((row) => String(row.EMA_ID) === String(emaId));
  return estado != null && isMachineStatusMaintenance(estado.EMA_ESTADO);
}

export function machineManualStatusOptions(catalogOptions, currentEmaId) {
  const rows = catalogOptions?.['estado-maquina'] || [];
  const manualRows = filterManualMachineStatuses(rows);
  if (!isMachineStatusMaintenanceById(catalogOptions, currentEmaId)) return manualRows;
  const current = rows.find((row) => String(row.EMA_ID) === String(currentEmaId));
  return current ? [current, ...manualRows] : manualRows;
}

export function labelIncidente(row) {
  const id = row?.INC_ID ?? row?.inc_id;
  if (id == null || id === '') return '—';
  const tipo = String(row?.INC_TIPO ?? '').trim();
  return tipo || String(id);
}

export function pickEtiIdActivo(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  const exact = rows.find(
    (x) => x?.ETI_ESTADO != null && String(x.ETI_ESTADO).trim().toLowerCase() === 'activo',
  );
  if (exact?.ETI_ID != null) return String(exact.ETI_ID);
  const loose = rows.find((x) => String(x?.ETI_ESTADO || '').toLowerCase().includes('activ'));
  return loose?.ETI_ID != null ? String(loose.ETI_ID) : '';
}

export function pickEmeIdActiva(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  const exact = rows.find(
    (x) => x?.EME_ESTADO != null && String(x.EME_ESTADO).trim().toLowerCase() === 'activa',
  );
  if (exact?.EME_ID != null) return String(exact.EME_ID);
  const loose = rows.find((x) => String(x?.EME_ESTADO || '').toLowerCase().includes('activ'));
  return loose?.EME_ID != null ? String(loose.EME_ID) : '';
}

/** Resuelve rem_maq_id desde URLSearchParams o string directo. */
export function getRemMaqIdFromSearchParams(searchParams) {
  if (searchParams == null) return '';
  if (typeof searchParams === 'string') return String(searchParams).trim();
  if (typeof searchParams.get === 'function') {
    return String(searchParams.get('rem_maq_id') || '').trim();
  }
  return '';
}

export async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
