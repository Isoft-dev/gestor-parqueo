import { memo, useEffect, useId, useMemo, useState } from 'react';
import { API_BASE } from '../config.js';
import { getDbColumnLabel } from '../utils/dbColumnLabel.js';
import {
  getFieldPlaceholder,
  getInputMode,
  getMaxLength,
  sanitizeFieldValue,
} from '../utils/fieldValidation.js';
import { clampDateYmd, nowLocalDatetime, todayYmd } from '../utils/dateLimits.js';
import CrudModalShell from './CrudModalShell.jsx';
import {
  calcMembresiaVencimientoInput,
  findMachineById,
  getMaintenanceMovementForMachine,
  getRemMaqIdFromSearchParams,
  isCurrentSessionUser,
  isMachineStatusMaintenanceById,
  labelIncidente,
  labelMaquina,
  machineManualStatusOptions,
  maintenanceMovementHelp,
  maintenanceMovementOptionsForMachine,
  maquinasMantenimientoElegiblesList,
  maquinasOperativasList,
  maquinasTipoCobroList,
  parseJsonSafe,
  pickEmeIdActiva,
  pickEtiIdActivo,
  pickInoperativeMachineStatusId,
  round2,
  shouldHideFieldForCurrentForm,
  shouldHideFieldOnCreate,
  toDateTimeLocalInput,
  filterMaintenanceResultMachineStatuses,
} from './crudFormModalHelpers.js';

const READ_ONLY_FIELD_STYLE = {
  background: '#e5e7eb',
  color: '#4b5563',
  borderColor: '#d1d5db',
  cursor: 'default',
};

function sanitizeFormOnLoad(entityKey, initialForm) {
  const next = { ...(initialForm ?? {}) };
  if (entityKey === 'cliente') {
    if (next.CLI_NIT != null) {
      next.CLI_NIT = sanitizeFieldValue('CLI_NIT', next.CLI_NIT);
    }
    if (next.CLI_TELEFONO != null) {
      next.CLI_TELEFONO = sanitizeFieldValue('CLI_TELEFONO', next.CLI_TELEFONO);
    }
  }
  return next;
}

function CrudEditFormModal({
  entity,
  editId,
  initialForm,
  columnLabels,
  catalogOptions,
  searchParams,
  sessionUserId,
  sessionIsFullAdmin,
  isMonthlyVehicleMembershipView = false,
  isMonthlyClientVehicleView = false,
  monthlySelectedClientName = '',
  monthlySelectedVehiclePlate = '',
  onSave,
  onCancel,
}) {
  const formId = useId();
  const TODAY = todayYmd();
  const NOW_LOCAL = nowLocalDatetime();
  const isNewRecord = editId === '__new__';
  const remMaqId = getRemMaqIdFromSearchParams(searchParams);

  const [form, setForm] = useState(() => sanitizeFormOnLoad(entity?.key, initialForm));

  useEffect(() => {
    setForm(sanitizeFormOnLoad(entity?.key, initialForm));
  }, [editId, initialForm, entity?.key]);

  /** Nuevo ticket: estado por defecto «Activo» (solo lectura hasta guardar). */
  useEffect(() => {
    if (entity?.key !== 'ticket' || editId !== '__new__') return;
    const activoId = pickEtiIdActivo(catalogOptions?.['estado-ticket']);
    if (!activoId) return;
    setForm((prev) => {
      if (prev?.ETI_ID != null && String(prev.ETI_ID).trim() !== '') return prev;
      return { ...prev, ETI_ID: activoId };
    });
  }, [entity?.key, editId, catalogOptions?.['estado-ticket']]);

  /** Nueva máquina: inicia como «Inoperativa» y se activa luego desde edición. */
  useEffect(() => {
    if (entity?.key !== 'maquina' || editId !== '__new__') return;
    const inoperativaId = pickInoperativeMachineStatusId(catalogOptions?.['estado-maquina']);
    if (!inoperativaId) return;
    setForm((prev) => {
      if (prev?.EMA_ID != null && String(prev.EMA_ID).trim() !== '') return prev;
      return { ...prev, EMA_ID: inoperativaId };
    });
  }, [entity?.key, editId, catalogOptions?.['estado-maquina']]);

  /** Nuevo mantenimiento: el movimiento se define según el estado actual de la máquina. */
  useEffect(() => {
    if (entity?.key !== 'registro-mantenimiento' || editId !== '__new__') return;
    const machine = findMachineById(catalogOptions, form?.MAQ_ID);
    const nextMovement = getMaintenanceMovementForMachine(machine);
    setForm((prev) => {
      const currentMovement = String(prev?.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase();
      if (currentMovement === nextMovement) return prev;
      return { ...prev, REM_TIPO_MOVIMIENTO: nextMovement };
    });
  }, [entity?.key, editId, form?.MAQ_ID, catalogOptions]);

  useEffect(() => {
    if (entity?.key !== 'registro-mantenimiento') return;
    if (String(form?.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase() === 'FINALIZACION') return;
    setForm((prev) => (
      String(prev?.REM_ESTADO_RESULTANTE_EMA_ID ?? '').trim() === ''
        ? prev
        : { ...prev, REM_ESTADO_RESULTANTE_EMA_ID: '' }
    ));
  }, [entity?.key, form?.REM_TIPO_MOVIMIENTO]);

  /** Nueva membresía: vencimiento automático según `TME_DURACION`. */
  useEffect(() => {
    if (entity?.key !== 'membresia' || editId !== '__new__') return;
    const tmeId = String(form?.TME_ID ?? '').trim();
    const inicio = String(form?.MEM_FECHA_INICIO ?? '').trim();
    if (!tmeId || !inicio) return;
    const tipos = catalogOptions?.['tipo-membresia'] || [];
    const tipo = tipos.find((x) => String(x.TME_ID) === tmeId);
    const nextVenc = calcMembresiaVencimientoInput(inicio, Number(tipo?.TME_DURACION));
    if (!nextVenc) return;
    setForm((prev) => (
      String(prev?.MEM_FECHA_VENCIMIENTO ?? '') === String(nextVenc)
        ? prev
        : { ...prev, MEM_FECHA_VENCIMIENTO: nextVenc }
    ));
  }, [entity?.key, editId, form?.TME_ID, form?.MEM_FECHA_INICIO, catalogOptions?.['tipo-membresia']]);

  /** Nuevo cobro: fecha/hora automática actual. */
  useEffect(() => {
    if (entity?.key !== 'cobro' || editId !== '__new__') return;
    setForm((prev) => {
      if (String(prev?.COB_FECHA_HORA || '').trim() !== '') return prev;
      return {
        ...prev,
        COB_FECHA_HORA: toDateTimeLocalInput(new Date()),
      };
    });
  }, [entity?.key, editId]);

  /** Nuevo cobro: con ticket calcula horas, monto y tarifa sugerida. */
  useEffect(() => {
    if (entity?.key !== 'cobro' || editId !== '__new__') return;
    const ticId = String(form?.TIC_ID ?? '').trim();
    if (!ticId) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const rTicket = await fetch(`${API_BASE}/ticket/${encodeURIComponent(ticId)}`, { cache: 'no-store' });
        const dTicket = await parseJsonSafe(rTicket);
        if (!rTicket.ok) throw new Error(dTicket.error || dTicket.message || rTicket.statusText);
        const ticCodigo = String(dTicket?.TIC_CODIGO ?? '').trim();
        if (!ticCodigo) return;
        const rQuote = await fetch(`${API_BASE}/ticket/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ TIC_CODIGO: ticCodigo }),
        });
        const dQuote = await parseJsonSafe(rQuote);
        if (!rQuote.ok) throw new Error(dQuote.error || dQuote.message || rQuote.statusText);
        if (cancelled) return;
        const horas = Number(
          dQuote?.estadia?.horasFacturables
          ?? dQuote?.estadia?.horasCobradas
          ?? dQuote?.cobro?.horas
          ?? 0,
        );
        const monto = Number(
          dQuote?.montoTotal
          ?? dQuote?.cobro?.montoTotal
          ?? 0,
        );
        const tarifaId = dQuote?.tarifa?.TAR_ID ?? dQuote?.tarifa?.tar_id ?? '';
        setForm((prev) => ({
          ...prev,
          COB_HORAS_TOTALES: Number.isFinite(horas) ? String(horas) : prev.COB_HORAS_TOTALES,
          COB_MONTO_TOTAL: Number.isFinite(monto) ? String(round2(monto)) : prev.COB_MONTO_TOTAL,
          TAR_ID: tarifaId != null && String(tarifaId).trim() !== '' ? String(tarifaId) : prev.TAR_ID,
        }));
      } catch {
        // Si falla el cálculo automático, el usuario puede completar manualmente.
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [entity?.key, editId, form?.TIC_ID]);

  /** Nuevo cobro: vuelto automático según monto recibido y total. */
  useEffect(() => {
    if (entity?.key !== 'cobro' || editId !== '__new__') return;
    const recibido = Number(form?.COB_MONTO_RECIBIDO ?? 0);
    const total = Number(form?.COB_MONTO_TOTAL ?? 0);
    if (!Number.isFinite(recibido) || !Number.isFinite(total)) return;
    const vuelto = round2(Math.max(0, recibido - total));
    setForm((prev) => (
      String(prev?.COB_VUELTO ?? '') === String(vuelto)
        ? prev
        : { ...prev, COB_VUELTO: String(vuelto) }
    ));
  }, [entity?.key, editId, form?.COB_MONTO_RECIBIDO, form?.COB_MONTO_TOTAL]);

  /** Nueva membresía mensual: estado activo por defecto. */
  useEffect(() => {
    if (entity?.key !== 'membresia') return;
    if (
      !isMonthlyVehicleMembershipView
      || editId !== '__new__'
      || String(form?.EME_ID ?? '').trim() !== ''
    ) {
      return;
    }
    const emeIdActiva = pickEmeIdActiva(catalogOptions?.['estado-membresia']);
    if (!emeIdActiva) return;
    setForm((prev) => {
      if (String(prev?.EME_ID ?? '').trim() !== '') return prev;
      return { ...prev, EME_ID: emeIdActiva };
    });
  }, [
    entity?.key,
    catalogOptions?.['estado-membresia'],
    editId,
    form?.EME_ID,
    isMonthlyVehicleMembershipView,
  ]);

  const formFields = useMemo(() => {
    if (!entity) return [];
    if (!isNewRecord && editId && (entity.updateFields || entity.readOnlyOnUpdate)) {
      const updateKeys = Array.from(
        new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
      );
      return entity.fields.filter((f) => f.k === entity.id || updateKeys.includes(f.k));
    }
    return entity.fields.filter((f) => !(editId && !isNewRecord && f.createOnly));
  }, [entity, editId, isNewRecord]);

  const visibleFormFields = useMemo(() => {
    if (isNewRecord) {
      return formFields.filter((f) => {
        if (entity?.key === 'ticket' && ['TIC_ID', 'TIC_CODIGO', 'TIC_FECHA_HORA_SALIDA'].includes(f.k)) {
          return false;
        }
        if (isMonthlyClientVehicleView && entity?.key === 'vehiculo' && f.k === 'CLI_ID') {
          return false;
        }
        if (isMonthlyVehicleMembershipView && entity?.key === 'membresia' && f.k === 'MEM_VEH_PLACA') {
          return false;
        }
        if (shouldHideFieldOnCreate(entity?.key, f.k)) {
          return false;
        }
        if (shouldHideFieldForCurrentForm(entity?.key, f.k, form, isNewRecord)) {
          return false;
        }
        return true;
      });
    }
    return formFields.filter((f) => {
      if (isMonthlyClientVehicleView && entity?.key === 'vehiculo' && f.k === 'CLI_ID') {
        return false;
      }
      if (isMonthlyVehicleMembershipView && entity?.key === 'membresia' && f.k === 'MEM_VEH_PLACA') {
        return false;
      }
      return !shouldHideFieldForCurrentForm(entity?.key, f.k, form, isNewRecord);
    });
  }, [
    form,
    formFields,
    isMonthlyClientVehicleView,
    isMonthlyVehicleMembershipView,
    isNewRecord,
    entity?.key,
  ]);

  function handleSubmit(ev) {
    ev.preventDefault();
    onSave(form);
  }

  const modalTitle = isNewRecord ? `Nuevo: ${entity?.label}` : `Editar: ${entity?.label}`;
  const editMeta = !isNewRecord ? (
    <>
      {getDbColumnLabel(entity.id, columnLabels)}:{' '}
      <strong>{editId}</strong>
    </>
  ) : null;

  return (
    <CrudModalShell
      title={modalTitle}
      meta={editMeta}
      onClose={onCancel}
      footer={(
        <>
          <button type="submit" form={formId} className="crudx-btn-primary">
            Guardar
          </button>
          <button type="button" onClick={onCancel} className="crudx-btn-secondary">
            Cancelar
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={handleSubmit} className="crudx-cliente-modal__form">
        <div className="crudx-form-grid">
          {entity.key === 'membresia' && isNewRecord ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              El vencimiento se calcula automáticamente según el tipo de membresía (duración en días) y la fecha de inicio.
            </p>
          ) : null}
          {entity.key === 'membresia' && isNewRecord && isMonthlyVehicleMembershipView ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              La membresía se activará para la placa <strong>{monthlySelectedVehiclePlate}</strong>. Solo completa el plan, la fecha de inicio y ajusta el estado si hace falta.
            </p>
          ) : null}
          {entity.key === 'membresia' && !isNewRecord ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              Esta vista es consultiva. La edición solo permite ajustar el espacio asignado y su ubicación; el plan, estado, placa y vigencia se gestionan por el flujo de pago/renovación.
            </p>
          ) : null}
          {entity.key === 'ticket' && isNewRecord ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              El código del ticket se genera solo. La salida se registra al editar el ticket. Al crear,
              el estado queda en Activo y no es editable.
            </p>
          ) : null}
          {entity.key === 'vehiculo' && isNewRecord && isMonthlyClientVehicleView ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              Este vehículo quedará vinculado automáticamente a <strong>{monthlySelectedClientName}</strong>.
            </p>
          ) : null}
          {entity.key === 'registro-mantenimiento' && isNewRecord ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              El flujo se define por el estado actual de la máquina: si está <strong>Operativa</strong> se registrará <strong>Inicio</strong>; si ya está en <strong>Mantenimiento</strong> se registrará <strong>Finalización</strong>.
            </p>
          ) : null}
          {entity.key === 'tarifa' && isNewRecord ? (
            <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
              Define el precio por hora de estacionamiento. Los <strong>minutos de gracia</strong> son el tiempo inicial sin cobro (ej. 15 min = si sales antes de 15 min no se cobra). El ID se genera automáticamente.
            </p>
          ) : null}
          {visibleFormFields.map((f) => {
            const fieldId = `crud-${entity.key}-${String(f.k).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const ticketVehIdAsPlacaLabel =
              entity?.key === 'ticket' && isNewRecord && f.k === 'VEH_ID';
            const lblBase = ticketVehIdAsPlacaLabel
              ? 'Placa'
              : getDbColumnLabel(f.k, columnLabels);
            const lbl = lblBase;
            const readOnlyOnUpdate = !isNewRecord && !!entity?.readOnlyOnUpdate?.includes(f.k);
            const readOnlyOnCreate = isNewRecord && !!(entity?.readOnlyOnCreate || []).includes(f.k);
            const lockByAlertBusinessRule =
              entity?.key === 'alerta'
              && !isNewRecord
              && (f.k === 'ALE_USU_ID_RESOLVIO' || f.k === 'ALE_DESCRIPCION_SOLUCION')
              && !form?.ALE_FECHA_ATENCION;
            const lockResolverUserByRole =
              !sessionIsFullAdmin
              && !isNewRecord
              && (
                (entity?.key === 'alerta' && f.k === 'ALE_USU_ID_RESOLVIO')
                || (entity?.key === 'bitacora-incidente-vehiculo' && f.k === 'USU_ID')
              );
            const lockOwnSessionActivationToggle =
              entity?.key === 'usuario'
              && f.k === 'USU_ACTIVO'
              && !isNewRecord
              && isCurrentSessionUser(editId, sessionUserId);
            const lockMachineStatusByMaintenanceFlow =
              entity?.key === 'maquina'
              && f.k === 'EMA_ID'
              && isMachineStatusMaintenanceById(catalogOptions, form?.EMA_ID);
            const lockScopedMaintenanceMachine =
              entity?.key === 'registro-mantenimiento'
              && f.k === 'MAQ_ID'
              && Boolean(remMaqId);
            const fieldDisabled =
              (f.k === entity.id && editId !== '__new__')
              || (isNewRecord && f.k === entity?.id)
              || readOnlyOnUpdate
              || readOnlyOnCreate
              || (entity?.key === 'cobro' && isNewRecord && ['COB_HORAS_TOTALES', 'COB_MONTO_TOTAL', 'COB_VUELTO', 'COB_FECHA_HORA', 'TAR_ID'].includes(f.k))
              || lockByAlertBusinessRule
              || lockResolverUserByRole
              || lockOwnSessionActivationToggle
              || lockMachineStatusByMaintenanceFlow
              || lockScopedMaintenanceMachine;
            const maintenanceMachine =
              entity?.key === 'registro-mantenimiento'
                ? findMachineById(catalogOptions, form?.MAQ_ID)
                : null;
            const selectOptions = f.t === 'select'
              ? (() => {
                  if (Array.isArray(f.options)) {
                    if (entity?.key === 'registro-mantenimiento' && f.k === 'REM_TIPO_MOVIMIENTO') {
                      return maintenanceMovementOptionsForMachine(maintenanceMachine);
                    }
                    return f.options;
                  }
                  if (f.catalog === 'estado-maquina' && f.estadoMaquinaResultadoMantenimiento) {
                    return filterMaintenanceResultMachineStatuses(catalogOptions[f.catalog] || []);
                  }
                  if (entity?.key === 'maquina' && f.catalog === 'estado-maquina') {
                    return machineManualStatusOptions(catalogOptions, form?.EMA_ID);
                  }
                  if (f.catalog !== 'maquina') return catalogOptions[f.catalog] || [];
                  if (entity?.key === 'registro-mantenimiento') {
                    const eligible = maquinasMantenimientoElegiblesList(catalogOptions);
                    const scopedMaq = remMaqId ? findMachineById(catalogOptions, remMaqId) : null;
                    if (scopedMaq && !eligible.some((item) => String(item.MAQ_ID) === remMaqId)) {
                      return [scopedMaq, ...eligible];
                    }
                    return eligible;
                  }
                  if (f.maquinaSoloCobro) {
                    return maquinasTipoCobroList(catalogOptions, {
                      onlyOperative: !!f.maquinaSoloOperativa,
                    });
                  }
                  if (f.maquinaSoloOperativa) {
                    return maquinasOperativasList(catalogOptions);
                  }
                  return catalogOptions[f.catalog] || [];
                })()
              : null;
            const lockMaintenanceMovement =
              entity?.key === 'registro-mantenimiento'
              && f.k === 'REM_TIPO_MOVIMIENTO'
              && (
                String(form?.MAQ_ID ?? '').trim() === ''
                || (Array.isArray(selectOptions) && selectOptions.length <= 1)
              );
            const effectiveFieldDisabled = fieldDisabled || lockMaintenanceMovement;
            return (
              <div
                key={f.k}
                className={`crudx-field${
                  f.req ? ' crudx-field--required' : ''
                }${
                  f.t === 'checkbox'
                    ? ' crudx-field--checkbox'
                    : f.t === 'select'
                      ? ' crudx-field--select'
                      : ''
                }${
                  entity?.key === 'registro-mantenimiento' && f.k === 'REM_DESCRIPCION'
                    ? ' crudx-field--maintenance-desc'
                    : ''
                }`}
              >
                {f.t === 'checkbox' ? (
                  <label htmlFor={fieldId} className="crudx-checkbox-inline">
                    <input
                      id={fieldId}
                      type="checkbox"
                      checked={!!form[f.k]}
                      disabled={fieldDisabled}
                      onChange={(ev) =>
                        setForm((p) => ({ ...p, [f.k]: ev.target.checked ? 1 : 0 }))
                      }
                      aria-label={lbl}
                    />
                    <span>{lbl}</span>
                  </label>
                ) : f.t === 'select' ? (
                  <>
                    <label htmlFor={fieldId}>{lbl}</label>
                    <select
                      id={fieldId}
                      className="crudx-select"
                      value={form[f.k] ?? ''}
                      required={!!f.req && !(isNewRecord && f.k === entity?.id)}
                      disabled={effectiveFieldDisabled}
                      style={effectiveFieldDisabled ? READ_ONLY_FIELD_STYLE : undefined}
                      onChange={(ev) => {
                        const nextValue = ev.target.value;
                        setForm((p) => {
                          if (entity?.key === 'membresia' && f.k === 'ESP_ID') {
                            const selectedEspacio = (catalogOptions?.espacio || [])
                              .find((row) => String(row?.ESP_ID) === String(nextValue));
                            return {
                              ...p,
                              [f.k]: nextValue,
                              ESP_UBICACION: selectedEspacio?.ESP_UBICACION ?? p.ESP_UBICACION ?? '',
                            };
                          }
                          return { ...p, [f.k]: nextValue };
                        });
                      }}
                      aria-label={lbl}
                      title={lbl}
                    >
                      {f.req ? (
                        <option value="" disabled>
                          Seleccione…
                        </option>
                      ) : (
                        <option value="">—</option>
                      )}
                      {(selectOptions || []).map((row) => {
                        const val =
                          Array.isArray(f.options)
                            ? String(row.value ?? '')
                            : row[f.valueKey] != null ? String(row[f.valueKey]) : '';
                        if (val === '') return null;
                        const lab = Array.isArray(f.options)
                          ? String(row.label ?? val)
                          : f.catalog === 'usuario'
                            ? [row.USU_PRIMER_NOMBRE, row.USU_PRIMER_APELLIDO].filter(Boolean).join(' ') || val
                            : f.catalog === 'maquina'
                              ? entity?.key === 'registro-mantenimiento'
                                ? `${labelMaquina(row, catalogOptions)} (${String(row.EMA_ESTADO ?? 'Sin estado').trim() || 'Sin estado'})`
                                : labelMaquina(row, catalogOptions)
                              : f.catalog === 'incidente'
                                ? labelIncidente(row)
                                : row[f.labelKey] != null
                                  ? String(row[f.labelKey])
                                  : val;
                        return (
                          <option key={`${f.k}-${val}`} value={val}>
                            {lab}
                          </option>
                        );
                      })}
                    </select>
                    {f.help || (entity?.key === 'registro-mantenimiento' && f.k === 'REM_TIPO_MOVIMIENTO') ? (
                      <p
                        className="crudx-form-note"
                        style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.4 }}
                      >
                        {entity?.key === 'registro-mantenimiento' && f.k === 'REM_TIPO_MOVIMIENTO'
                          ? maintenanceMovementHelp(maintenanceMachine)
                          : f.help}
                      </p>
                    ) : null}
                  </>
                ) : entity?.key === 'registro-mantenimiento' && f.k === 'REM_DESCRIPCION' ? (
                  <>
                    <label htmlFor={fieldId}>{lbl}</label>
                    <textarea
                      id={fieldId}
                      className="crudx-textarea"
                      value={form[f.k] ?? ''}
                      placeholder={getFieldPlaceholder(f.k, {
                        explicit: entity?.key === 'registro-mantenimiento' && f.k === 'REM_DESCRIPCION'
                          ? 'Detalle breve del trabajo realizado o hallazgo encontrado'
                          : undefined,
                        label: lblBase,
                        fieldType: 'textarea',
                      })}
                      disabled={fieldDisabled}
                      style={fieldDisabled ? READ_ONLY_FIELD_STYLE : undefined}
                      onChange={(ev) => setForm((p) => ({ ...p, [f.k]: sanitizeFieldValue(f.k, ev.target.value, { fieldType: 'textarea' }) }))}
                      aria-label={lbl}
                      title={lbl}
                      rows={2}
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor={fieldId}>{lbl}</label>
                    <input
                      id={fieldId}
                      type={f.t === 'password' && editId !== '__new__' ? 'text' : (f.t || 'text')}
                      value={form[f.k] ?? ''}
                      placeholder={getFieldPlaceholder(f.k, {
                        explicit: f.placeholder,
                        label: lblBase,
                        fieldType: f.t,
                        isAutoId: isNewRecord && f.k === entity?.id,
                      })}
                      required={!!f.req && !(isNewRecord && f.k === entity?.id)}
                      disabled={fieldDisabled}
                      style={fieldDisabled ? READ_ONLY_FIELD_STYLE : undefined}
                      inputMode={getInputMode(f.k)}
                      maxLength={getMaxLength(f.k)}
                      max={f.t === 'date' ? TODAY : f.t === 'datetime-local' ? NOW_LOCAL : undefined}
                      onChange={(ev) => {
                        let next = ev.target.value;
                        if (f.t === 'date') next = clampDateYmd(next);
                        if (f.t === 'datetime-local' && next > NOW_LOCAL) next = NOW_LOCAL;
                        setForm((p) => ({
                          ...p,
                          [f.k]: sanitizeFieldValue(f.k, next, {
                            fieldType: f.t,
                            asPlate: f.k === 'VEH_ID',
                          }),
                        }));
                      }}
                      aria-label={lbl}
                      title={lbl}
                    />
                    {f.help ? (
                      <p
                        className="crudx-form-note"
                        style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.4 }}
                      >
                        {f.help}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </form>
    </CrudModalShell>
  );
}

export default memo(CrudEditFormModal);
