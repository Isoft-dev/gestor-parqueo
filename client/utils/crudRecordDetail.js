import { getDbColumnLabel } from '../utils/dbColumnLabel.js';
import { getClienteFichaItems, clienteNombreCompleto } from '../utils/clienteDisplay.js';

function formatDefaultCellValue(key, value) {
  if (value == null || value === '') return '—';
  if (key === 'USU_PASSWORD') return '••••';
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      return new Date(value).toLocaleString('es-GT');
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

function getVehiculoFichaItems(row, catalogOptions) {
  const activo = Number(row?.VEH_ACTIVO ?? 1) === 1;
  const tipo = row?.TVE_TIPO
    || catalogOptions?.['tipo-vehiculo']?.find((t) => String(t.TVE_ID) === String(row?.TVE_ID))?.TVE_TIPO
    || '—';
  return [
    { label: 'Placa', value: row?.VEH_PLACA || row?.VEH_ID || '—' },
    { label: 'Modelo', value: row?.VEH_MODELO || '—' },
    { label: 'Color', value: row?.VEH_COLOR || '—' },
    { label: 'Tipo', value: tipo },
    { label: 'Cliente ID', value: row?.CLI_ID ?? '—' },
    { label: 'Estado membresía', value: row?.EME_ESTADO || '—' },
    { label: 'Activo', value: activo ? 'Activo' : 'Inactivo', tone: activo ? 'ok' : 'muted' },
  ];
}

export function buildRecordDetailView(entity, row, { columnLabels, catalogOptions, formatValue } = {}) {
  const entityKey = entity?.key;
  const recordId = row?.[entity?.id];

  if (entityKey === 'cliente') {
    const nombre = clienteNombreCompleto(row) || `Cliente ${recordId ?? ''}`;
    return {
      title: nombre,
      eyebrow: 'Ficha de cliente',
      meta: recordId != null ? `ID cliente: ${recordId}` : null,
      items: getClienteFichaItems(row),
      editLabel: 'Editar cliente',
    };
  }

  if (entityKey === 'vehiculo') {
    const placa = String(row?.VEH_PLACA ?? row?.VEH_ID ?? '').trim() || 'Vehículo';
    return {
      title: placa,
      eyebrow: 'Ficha de vehículo',
      meta: recordId != null ? `ID vehículo: ${recordId}` : null,
      items: getVehiculoFichaItems(row, catalogOptions),
      editLabel: 'Editar vehículo',
    };
  }

  if (entityKey === 'alerta') {
    return {
      title: `Alerta ${recordId ?? ''}`.trim(),
      eyebrow: 'Detalle de alerta',
      meta: null,
      items: Object.entries(row || {}).map(([key, value]) => ({
        label: getDbColumnLabel(key, columnLabels),
        value: formatValue ? formatValue(key, value, row) : formatDefaultCellValue(key, value),
        fullWidth: key === 'ALE_DESCRIPCION' || key === 'ALE_DESCRIPCION_SOLUCION',
      })),
      editLabel: 'Resolver / editar',
    };
  }

  const items = Object.entries(row || {}).map(([key, value]) => ({
    label: getDbColumnLabel(key, columnLabels),
    value: formatValue ? formatValue(key, value, row) : formatDefaultCellValue(key, value),
    fullWidth: String(key).includes('DESCRIPCION') || String(key).includes('MOTIVO'),
  }));

  return {
    title: `${entity?.label ?? 'Registro'} ${recordId ?? ''}`.trim(),
    eyebrow: `Resumen · ${entity?.label ?? 'Registro'}`,
    meta: recordId != null ? `ID: ${recordId}` : null,
    items,
    editLabel: `Editar ${entity?.label?.toLowerCase() ?? 'registro'}`,
  };
}

export function shouldOfferRecordDetail(entityKey) {
  if (!entityKey) return false;
  // Alertas: botón «Detalle» en la celda de descripción truncada.
  if (entityKey === 'alerta') return false;
  return true;
}
