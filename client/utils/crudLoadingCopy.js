/** Indica si la URL trae filtros de búsqueda activos para la entidad actual. */
export function hasActiveCrudSearchFilters(entityKey, searchParams) {
  if (!entityKey || !searchParams) return false;

  switch (entityKey) {
    case 'bitacora-incidente-vehiculo':
      return Boolean(
        searchParams.get('biv_placa')
        || searchParams.get('biv_resuelto')
        || searchParams.get('biv_desde')
        || searchParams.get('biv_hasta'),
      );
    case 'alerta':
      return Boolean(
        searchParams.get('eal_id')
        || searchParams.get('tal_id')
        || searchParams.get('maq_id'),
      );
    case 'ticket':
      return Boolean(searchParams.get('q') || searchParams.get('eti_id'));
    case 'cobro':
      return Boolean(searchParams.get('cob_q'));
    case 'cliente':
      return Boolean(searchParams.get('cli_q'));
    case 'membresia':
      return Boolean(searchParams.get('mem_q') || searchParams.get('mem_eme'));
    case 'vehiculo':
      return Boolean(searchParams.get('veh_q') || searchParams.get('veh_tve_id'));
    case 'maquina':
      return Boolean(searchParams.get('maq_tma_id'));
    case 'detalle-saldo':
      return Boolean(searchParams.get('ds_maq_id'));
    case 'recargo-maquina':
      return Boolean(searchParams.get('rma_maq_id'));
    case 'detalle-maquina-ticket':
      return Boolean(
        searchParams.get('dmt_q')
        || searchParams.get('dmt_desde')
        || searchParams.get('dmt_hasta')
        || searchParams.get('dmt_tx')
        || searchParams.get('dmt_maq_id'),
      );
    case 'registro-movimiento-membresia':
      return Boolean(searchParams.get('rmm_placa'));
    case 'detalle-pago-membresia':
      return Boolean(searchParams.get('dpm_placa'));
    default:
      return false;
  }
}

export function getCrudLoadingCopy(entityKey, searchParams, { isRefresh = false } = {}) {
  const searching = hasActiveCrudSearchFilters(entityKey, searchParams);

  if (isRefresh || searching) {
    return {
      title: 'Buscando resultados…',
      hint: 'Estamos aplicando tus filtros. Puede tardar unos segundos si la lista es grande.',
      overlayLabel: 'Actualizando resultados…',
    };
  }

  return {
    title: 'Cargando registros…',
    hint: 'Obteniendo datos del servidor. Un momento, por favor.',
    overlayLabel: 'Cargando…',
  };
}
