import { memo } from 'react';
import CrudLocalFilterForm from './CrudLocalFilterForm.jsx';
import { sanitizeSearchValue, getSearchPlaceholder } from '../utils/fieldValidation.js';
import { clampDateYmd, clampDatetimeLocal, syncDateRangeOnChange } from '../utils/dateLimits.js';
import { maquinasTipoCobroList } from './crudFormModalHelpers.js';

const emptyBivFilter = { placa: '', resuelto: '', desde: '', hasta: '' };
const emptyAlertaFilter = { eal: '', tal: '', maq: '' };
const emptyTicketFilter = { eti: '', q: '' };
const emptyCobroFilter = { q: '' };
const emptyClienteFilter = { q: '' };
const emptyMembresiaFilter = { q: '', eme: '' };
const emptyDetalleMaqTicketFilter = { q: '', desde: '', hasta: '', tx: '' };
const emptyDetalleSaldoMaqFilter = { maq: '' };
const emptyRecargoMaqFilter = { maq: '' };
const emptyRmmPlacaFilter = { placa: '' };
const emptyDpmPlacaFilter = { placa: '' };
const emptyMaquinaFilter = { tma: '' };
const emptyVehiculoFilter = { q: '', tve: '' };

function CrudEntitySearchBar({
  entityKey,
  syncKey,
  searchParams,
  loading = false,
  catalogOptions = {},
  isMonthlyVehicleMembershipView = false,
  todayYmd = '',
  nowLocal = '',
  scopedDmtMaqId = '',
  scopedMachineActionMaqId = '',
  scopedMachineActionLabel = '',
  detalleMaqTicketTxOptions = [],
  labelMaquina,
  labelEstadoTicket,
  handlers = {},
}) {
  const fullSyncKey = `${entityKey}:${syncKey}`;

  if (entityKey === 'bitacora-incidente-vehiculo') {
    return (
      <CrudLocalFilterForm
        syncKey={fullSyncKey}
        initialValues={{
          placa: searchParams.get('biv_placa') || '',
          resuelto: searchParams.get('biv_resuelto') || '',
          desde: searchParams.get('biv_desde') || '',
          hasta: searchParams.get('biv_hasta') || '',
        }}
        clearValues={emptyBivFilter}
        onApply={(draft) => handlers.applyBivFilters(undefined, draft)}
        onClear={handlers.clearBivFilters}
        loading={loading}
      >
        {({ draft, setDraft }) => (
          <>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Placa</span>
              <input
                className="admin-search-input crudx-admin-filter-input-compact"
                type="search"
                value={draft.placa}
                onChange={(e) => setDraft((prev) => ({ ...prev, placa: sanitizeSearchValue('placa', e.target.value) }))}
                placeholder={getSearchPlaceholder('placa')}
                aria-label="Filtrar por placa"
              />
            </label>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Estado</span>
              <select
                className="admin-search-select"
                value={draft.resuelto}
                onChange={(e) => setDraft((prev) => ({ ...prev, resuelto: e.target.value }))}
                aria-label="Estado del incidente"
              >
                <option value="">Todos</option>
                <option value="0">Pendientes</option>
                <option value="1">Resueltos</option>
              </select>
            </label>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Desde</span>
              <input
                className="admin-search-input"
                type="date"
                value={draft.desde}
                max={draft.hasta || todayYmd}
                onChange={(e) => setDraft((prev) => syncDateRangeOnChange(prev, 'desde', e.target.value, { max: todayYmd }))}
                aria-label="Fecha desde"
              />
            </label>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Hasta</span>
              <input
                className="admin-search-input"
                type="date"
                value={draft.hasta}
                min={draft.desde || undefined}
                max={todayYmd}
                onChange={(e) => setDraft((prev) => syncDateRangeOnChange(prev, 'hasta', e.target.value, { max: todayYmd }))}
                aria-label="Fecha hasta"
              />
            </label>
          </>
        )}
      </CrudLocalFilterForm>
    );
  }

  if (entityKey === 'alerta') {
    return (
      <CrudLocalFilterForm
        syncKey={fullSyncKey}
        initialValues={{
          eal: searchParams.get('eal_id') || '',
          tal: searchParams.get('tal_id') || '',
          maq: searchParams.get('maq_id') || '',
        }}
        clearValues={emptyAlertaFilter}
        onApply={(draft) => handlers.applyAlertaFilters(undefined, draft)}
        onClear={handlers.clearAlertaFilters}
        loading={loading}
      >
        {({ draft, setField }) => (
          <>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Estado</span>
              <select
                className="admin-search-select"
                value={draft.eal}
                onChange={(e) => setField('eal', e.target.value)}
                aria-label="Estado de la alerta"
              >
                <option value="">Todos</option>
                {(catalogOptions?.['estado-alerta'] || []).map((x) => (
                  <option key={x.EAL_ID} value={String(x.EAL_ID)}>
                    {x.EAL_ESTADO}
                  </option>
                ))}
              </select>
            </label>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Tipo de alerta</span>
              <select
                className="admin-search-select"
                value={draft.tal}
                onChange={(e) => setField('tal', e.target.value)}
                aria-label="Tipo de alerta"
              >
                <option value="">Todos</option>
                {(catalogOptions?.['tipo-alerta'] || []).map((x) => (
                  <option key={x.TAL_ID} value={String(x.TAL_ID)}>
                    {x.TAL_TIPO}
                  </option>
                ))}
              </select>
            </label>
            <label className="crudx-ticket-search-estado">
              <span className="crudx-ticket-search-estado-label">Máquina</span>
              <select
                className="admin-search-select"
                value={draft.maq}
                onChange={(e) => setField('maq', e.target.value)}
                aria-label="Máquina"
              >
                <option value="">Todas</option>
                {(catalogOptions?.maquina || []).map((x) => (
                  <option key={x.MAQ_ID} value={String(x.MAQ_ID)}>
                    {labelMaquina(x, catalogOptions)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </CrudLocalFilterForm>
    );
  }

  if (entityKey === 'detalle-saldo') {
    if (scopedMachineActionMaqId) return null;

    return (
      <CrudLocalFilterForm
        syncKey={fullSyncKey}
        initialValues={{
          maq: searchParams.get('ds_maq_id') || '',
        }}
        clearValues={emptyDetalleSaldoMaqFilter}
        onApply={(draft) => handlers.applyDetalleSaldoMaqFilter(undefined, draft)}
        onClear={handlers.clearDetalleSaldoMaqFilter}
        loading={loading}
      >
        {({ draft, setField }) => (
          <label className="crudx-ticket-search-estado">
            <span className="crudx-ticket-search-estado-label">Máquina de cobro</span>
            <select
              className="admin-search-select"
              value={draft.maq}
              onChange={(e) => setField('maq', e.target.value)}
              required
              aria-required="true"
              aria-label="Máquina de cobro"
            >
              <option value="" disabled>
                Seleccione una máquina...
              </option>
              {maquinasTipoCobroList(catalogOptions, { onlyOperative: true }).map((x) => (
                <option key={x.MAQ_ID} value={String(x.MAQ_ID)}>
                  {labelMaquina(x, catalogOptions)}
                </option>
              ))}
            </select>
          </label>
        )}
      </CrudLocalFilterForm>
    );
  }

  if (entityKey === 'maquina') {
    return (
      <CrudLocalFilterForm
        syncKey={fullSyncKey}
        initialValues={{
          tma: searchParams.get('maq_tma_id') || '',
        }}
        clearValues={emptyMaquinaFilter}
        onApply={(draft) => handlers.applyMaquinaFilters(undefined, draft)}
        onClear={handlers.clearMaquinaFilters}
        loading={loading}
      >
        {({ draft, setField }) => (
          <label className="crudx-ticket-search-estado">
            <span className="crudx-ticket-search-estado-label">Tipo de máquina</span>
            <select
              className="admin-search-select"
              value={draft.tma}
              onChange={(e) => setField('tma', e.target.value)}
              aria-label="Filtrar máquinas por tipo"
            >
              <option value="">Todos</option>
              {(catalogOptions?.['tipo-maquina'] || [])
                .filter((x) => !/cabina/i.test(String(x?.TMA_TIPO || '')))
                .map((x) => (
                  <option key={x.TMA_ID} value={String(x.TMA_ID)}>
                    {x.TMA_TIPO}
                  </option>
                ))}
            </select>
          </label>
        )}
      </CrudLocalFilterForm>
    );
  }

  if (entityKey === 'recargo-maquina') {
    if (scopedMachineActionMaqId) return null;

    return (
      <CrudLocalFilterForm
        syncKey={fullSyncKey}
        initialValues={{
          maq: searchParams.get('rma_maq_id') || '',
        }}
        clearValues={emptyRecargoMaqFilter}
        onApply={(draft) => handlers.applyRecargoMaqFilter(undefined, draft)}
        onClear={handlers.clearRecargoMaqFilter}
        loading={loading}
      >
        {({ draft, setField }) => (
          <label className="crudx-ticket-search-estado">
            <span className="crudx-ticket-search-estado-label">Máquina de cobro</span>
            <select
              className="admin-search-select"
              value={draft.maq}
              onChange={(e) => setField('maq', e.target.value)}
              required
              aria-required="true"
              aria-label="Filtrar recargos por máquina de cobro"
            >
              <option value="" disabled>
                Seleccione una máquina...
              </option>
              {maquinasTipoCobroList(catalogOptions, { onlyOperative: true }).map((x) => (
                <option key={x.MAQ_ID} value={String(x.MAQ_ID)}>
                  {labelMaquina(x, catalogOptions)}
                </option>
              ))}
            </select>
          </label>
        )}
      </CrudLocalFilterForm>
    );
  }

  if (entityKey === 'vehiculo') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('veh_q') || '',
            tve: searchParams.get('veh_tve_id') || '',
          }}
          clearValues={emptyVehiculoFilter}
          onApply={(draft) => handlers.applyVehiculoFilters(undefined, draft)}
          onClear={handlers.clearVehiculoFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <>
              <div className="admin-search-input-wrap">
                <input
                  className="admin-search-input"
                  type="search"
                  value={draft.q}
                  onChange={(e) => setField('q', sanitizeSearchValue('placa', e.target.value))}
                  placeholder={getSearchPlaceholder('placa')}
                  autoComplete="off"
                  aria-label="Filtrar vehículos por placa"
                />
              </div>
              <label className="crudx-ticket-search-estado">
                <span className="crudx-ticket-search-estado-label">Tipo de vehículo</span>
                <select
                  className="admin-search-select"
                  value={draft.tve}
                  onChange={(e) => setField('tve', e.target.value)}
                  aria-label="Filtrar vehículos por tipo"
                >
                  <option value="">Todos</option>
                  {(catalogOptions?.['tipo-vehiculo'] || []).map((x) => (
                    <option key={x.TVE_ID} value={String(x.TVE_ID)}>
                      {x.TVE_TIPO}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'ticket') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('q') || '',
            eti: searchParams.get('eti_id') || '',
          }}
          clearValues={emptyTicketFilter}
          onApply={(draft) => handlers.applyTicketFilters(undefined, draft)}
          onClear={handlers.clearTicketFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <>
              <div className="admin-search-input-wrap">
                <input
                  className="admin-search-input"
                  type="search"
                  value={draft.q}
                  onChange={(e) => setField('q', sanitizeSearchValue('ticket', e.target.value))}
                  placeholder={getSearchPlaceholder('ticket')}
                  autoComplete="off"
                  aria-label="Buscar por código de ticket o placa"
                />
              </div>
              <label className="crudx-ticket-search-estado" htmlFor="crud-ticket-filter-estado">
                <span className="crudx-ticket-search-estado-label">Estado</span>
                <select
                  id="crud-ticket-filter-estado"
                  className="admin-search-select"
                  value={draft.eti}
                  onChange={(e) => setField('eti', e.target.value)}
                  aria-label="Estado del ticket"
                >
                  <option value="">Todos</option>
                  {(catalogOptions?.['estado-ticket'] || []).map((x) => (
                    <option key={x.ETI_ID} value={String(x.ETI_ID)}>
                      {x.ETI_ESTADO != null && String(x.ETI_ESTADO).trim() !== ''
                        ? String(x.ETI_ESTADO)
                        : labelEstadoTicket(x.ETI_ID, catalogOptions)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'cobro') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('cob_q') || '',
          }}
          clearValues={emptyCobroFilter}
          onApply={(draft) => handlers.applyCobroFilters(undefined, draft)}
          onClear={handlers.clearCobroFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <div className="admin-search-input-wrap">
              <input
                className="admin-search-input"
                type="search"
                value={draft.q}
                onChange={(e) => setField('q', sanitizeSearchValue('cobro', e.target.value))}
                placeholder={getSearchPlaceholder('cobro')}
                autoComplete="off"
                aria-label="Buscar cobro por ticket ID o NIT / CF"
              />
            </div>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'cliente') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('cli_q') || '',
          }}
          clearValues={emptyClienteFilter}
          onApply={(draft) => handlers.applyClienteFilters(undefined, draft)}
          onClear={handlers.clearClienteFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <div className="admin-search-input-wrap">
              <input
                className="admin-search-input"
                type="search"
                value={draft.q}
                onChange={(e) => setField('q', sanitizeSearchValue('cliente', e.target.value))}
                placeholder={getSearchPlaceholder('cliente')}
                autoComplete="off"
                aria-label="Buscar cliente por nombre, apellido, nombre completo o DPI"
              />
            </div>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'membresia' && !isMonthlyVehicleMembershipView) {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('mem_q') || '',
            eme: searchParams.get('mem_eme') || '',
          }}
          clearValues={emptyMembresiaFilter}
          onApply={(draft) => handlers.applyMembresiaFilters(undefined, draft)}
          onClear={handlers.clearMembresiaFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <>
              <div className="admin-search-input-wrap">
                <input
                  className="admin-search-input"
                  type="search"
                  value={draft.q}
                  onChange={(e) => setField('q', sanitizeSearchValue('general', e.target.value))}
                  placeholder={getSearchPlaceholder('membresia')}
                  autoComplete="off"
                  aria-label="Filtrar membresía por cliente o placa"
                />
              </div>
              <label className="crudx-ticket-search-estado">
                <span className="crudx-ticket-search-estado-label">Estado membresía</span>
                <select
                  className="admin-search-select"
                  value={draft.eme}
                  onChange={(e) => setField('eme', e.target.value)}
                  aria-label="Filtrar membresía por estado"
                >
                  <option value="">Todos</option>
                  {(catalogOptions?.['estado-membresia'] || []).map((x) => (
                    <option key={x.EME_ID} value={String(x.EME_ID)}>
                      {x.EME_ESTADO}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'detalle-pago-membresia') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            placa: searchParams.get('dpm_placa') || '',
          }}
          clearValues={emptyDpmPlacaFilter}
          onApply={(draft) => handlers.applyDpmPlacaFilters(undefined, draft)}
          onClear={handlers.clearDpmPlacaFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <div className="admin-search-input-wrap">
              <input
                className="admin-search-input"
                type="search"
                value={draft.placa}
                onChange={(e) => setField('placa', sanitizeSearchValue('placa', e.target.value))}
                placeholder={getSearchPlaceholder('placa')}
                autoComplete="off"
                aria-label="Filtrar detalle de pago membresía por placa; deja vacío para ver todos"
              />
            </div>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'detalle-maquina-ticket') {
    return (
      <div className="crudx-ticket-search-block">
        {scopedDmtMaqId ? (
          <div className="crudx-scoped-filter-note">
            <span>Máquina</span>
            <strong>{scopedMachineActionLabel || `MAQ_ID ${scopedDmtMaqId}`}</strong>
          </div>
        ) : null}
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            q: searchParams.get('dmt_q') || '',
            desde: searchParams.get('dmt_desde') || '',
            hasta: searchParams.get('dmt_hasta') || '',
            tx: searchParams.get('dmt_tx') || '',
          }}
          clearValues={emptyDetalleMaqTicketFilter}
          onApply={(draft) => handlers.applyDetalleMaqTicketFilters(undefined, draft)}
          onClear={handlers.clearDetalleMaqTicketFilters}
          loading={loading}
        >
          {({ draft, setField, setDraft }) => (
            <>
              <div className="admin-search-input-wrap">
                <input
                  className="admin-search-input"
                  type="search"
                  value={draft.q}
                  onChange={(e) => setField('q', sanitizeSearchValue('ticket', e.target.value))}
                  placeholder={getSearchPlaceholder('detalleMaq')}
                  autoComplete="off"
                  aria-label="Filtrar detalle máquina-ticket por placa o ticket"
                />
              </div>
              <label className="crudx-ticket-search-estado">
                <span className="crudx-ticket-search-estado-label">Desde</span>
                <input
                  className="admin-search-input"
                  type="datetime-local"
                  value={draft.desde}
                  max={draft.hasta && draft.hasta < nowLocal ? draft.hasta : nowLocal}
                  onChange={(e) => setDraft((prev) => syncDateRangeOnChange(prev, 'desde', e.target.value, {
                    max: nowLocal,
                    useDatetime: true,
                  }))}
                  autoComplete="off"
                  aria-label="Fecha y hora inicial"
                />
              </label>
              <label className="crudx-ticket-search-estado">
                <span className="crudx-ticket-search-estado-label">Hasta</span>
                <input
                  className="admin-search-input"
                  type="datetime-local"
                  value={draft.hasta}
                  min={draft.desde || undefined}
                  max={nowLocal}
                  onChange={(e) => setDraft((prev) => syncDateRangeOnChange(prev, 'hasta', e.target.value, {
                    max: nowLocal,
                    useDatetime: true,
                  }))}
                  autoComplete="off"
                  aria-label="Fecha y hora final"
                />
              </label>
              {!scopedDmtMaqId ? (
                <label className="crudx-ticket-search-estado">
                  <span className="crudx-ticket-search-estado-label">Transacción</span>
                  <select
                    className="admin-search-select"
                    value={draft.tx}
                    onChange={(e) => setField('tx', e.target.value)}
                    aria-label="Filtrar detalle máquina-ticket por transacción"
                  >
                    <option value="">Todas</option>
                    {detalleMaqTicketTxOptions.map((tx) => (
                      <option key={tx} value={tx}>{tx}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  if (entityKey === 'registro-movimiento-membresia') {
    return (
      <div className="crudx-ticket-search-block">
        <CrudLocalFilterForm
          syncKey={fullSyncKey}
          initialValues={{
            placa: searchParams.get('rmm_placa') || '',
          }}
          clearValues={emptyRmmPlacaFilter}
          onApply={(draft) => handlers.applyRmmPlacaFilters(undefined, draft)}
          onClear={handlers.clearRmmPlacaFilters}
          loading={loading}
        >
          {({ draft, setField }) => (
            <div className="admin-search-input-wrap">
              <input
                className="admin-search-input"
                type="search"
                value={draft.placa}
                onChange={(e) => setField('placa', sanitizeSearchValue('placa', e.target.value))}
                placeholder="Ej. P123ABC (opcional)"
                autoComplete="off"
                aria-label="Filtrar movimientos de membresía por placa; deja vacío para ver todos"
              />
            </div>
          )}
        </CrudLocalFilterForm>
      </div>
    );
  }

  return null;
}

export default memo(CrudEntitySearchBar);
