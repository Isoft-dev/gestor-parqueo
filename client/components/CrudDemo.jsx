import { Fragment, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';
import { API_BASE } from '../config.js';
import { buildLabelMapFromCrudFields, getDbColumnLabel } from '../utils/dbColumnLabel.js';
import { sanitizeFieldValue, getInputMode, getMaxLength, getFieldPlaceholder, getSearchPlaceholder, sanitizeSearchValue } from '../utils/fieldValidation.js';
import HelpHint from './HelpHint.jsx';
import {
  BtnContent,
  IconBack,
  IconBalance,
  IconClear,
  IconEdit,
  IconMaintenance,
  IconPlus,
  IconRecharge,
  IconSearch,
  IconTrash,
  IconTransaction,
} from './UiIcons.jsx';
import { clampDateYmd, nowLocalDatetime, todayYmd } from '../utils/dateLimits.js';
import { formatUserFacingMessage, isErrorLikeMessage } from '../utils/userMessage.js';
import {
  filterManualMachineStatuses,
  filterMaintenanceResultMachineStatuses,
  filterMaintenanceEligibleMachines,
  filterOperativeMachines,
  getMaintenanceMovementForMachine,
  isMachineStatusMaintenance,
  pickInoperativeMachineStatusId,
} from '../utils/machineStatus.js';

// CONFIG
// ops: c=create, u=update, d=delete
// updateFields: si existe, el formulario de edición solo muestra esos campos
const SECTIONS = {
  'me-ms': {
    label: 'ME-MS - Entrada/Salida',
    entities: [
      { key: 'estado-ticket', label: 'Estado Ticket', id: 'ETI_ID',
        fields: [{ k:'ETI_ID',l:'ID',req:true },{ k:'ETI_ESTADO',l:'Estado',req:true }],
        ops:{c:false,u:false,d:false} },
      { key: 'tarifa', label: 'Tarifa', id: 'TAR_ID',
        fields: [
          { k:'TAR_ID',l:'ID',req:false },
          { k:'TAR_TIPO',l:'Nombre de la tarifa',req:true },
          { k:'TAR_PRECIO',l:'Precio (Q por hora)',t:'number',req:true },
          { k:'TAR_TIEMPO_GRACIA',l:'Minutos de gracia',t:'number',req:true },
        ],
        ops:{c:true,u:true,d:true},
        readOnlyOnCreate:['TAR_ID'] },
      { key: 'ticket', label: 'Ticket', id: 'TIC_ID',
        fields: [
          { k:'TIC_ID',l:'ID',req:true },
          { k:'TIC_CODIGO',l:'Código',req:true },
          { k:'VEH_ID',l:'VEH_ID',req:true,placeholder:'Ej. P123ABC' },
          { k:'TIC_FECHA_HORA_ENTRADA',l:'Entrada',t:'datetime-local',req:true },
          { k:'TIC_FECHA_HORA_SALIDA',l:'Salida',t:'datetime-local' },
          {
            k:'ETI_ID',
            l:'Estado del ticket',
            req:true,
            t:'select',
            catalog:'estado-ticket',
            valueKey:'ETI_ID',
            labelKey:'ETI_ESTADO',
          },
        ],
        ops:{c:false,u:true,d:false},
        updateFields:['TIC_FECHA_HORA_SALIDA','ETI_ID'],
        readOnlyOnCreate:['ETI_ID'],
      },
      { key: 'tipo-cobro', label: 'Tipo Cobro', id: 'TCO_ID',
        fields: [{ k:'TCO_ID',l:'ID',req:true },{ k:'TCO_TIPO',l:'Tipo',req:true },{ k:'TCO_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:false,d:false} },
      { key: 'cobro', label: 'Cobro', id: 'COB_ID',
        fields: [{ k:'COB_ID',l:'ID',req:true },{ k:'TIC_ID',l:'TIC_ID',req:true,t:'number' },{ k:'COB_NIT',l:'NIT / CF' },{ k:'COB_HORAS_TOTALES',l:'Horas',t:'number',req:true },{ k:'TCO_ID',l:'Tipo de cobro',req:true,t:'select',catalog:'tipo-cobro',valueKey:'TCO_ID',labelKey:'TCO_TIPO' },{ k:'COB_MONTO_TOTAL',l:'Monto Total',t:'number',req:true },{ k:'COB_MONTO_RECIBIDO',l:'Monto Recibido',t:'number' },{ k:'COB_VUELTO',l:'Vuelto',t:'number' },{ k:'COB_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true },{ k:'TAR_ID',l:'Tarifa',req:true,t:'select',catalog:'tarifa',valueKey:'TAR_ID',labelKey:'TAR_TIPO' }],
        ops:{c:true,u:false,d:false} },
      { key: 'detalle-maquina-ticket', label: 'Det. Máq./Ticket', id: 'DMT_ID',
        fields: [{ k:'DMT_ID',l:'ID',req:true },{ k:'DMT_TRANSACCION',l:'Transacción' },{ k:'TIC_ID',l:'TIC_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true },{ k:'DMT_HORA_TRANSACCION',l:'Hora',t:'datetime-local' }],
        ops:{c:false,u:false,d:false} },
    ],
  },
  'mc': {
    label: 'MC - Máquina Cobro',
    entities: [
      { key: 'estado-maquina', label: 'Estado Máquina', id: 'EMA_ID',
        fields: [{ k:'EMA_ID',l:'ID',req:true },{ k:'EMA_ESTADO',l:'Estado',req:true },{ k:'EMA_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:true,d:false},
        updateFields:['EMA_DESCRIPCION'],
        readOnlyOnUpdate:['EMA_ID','EMA_ESTADO'] },
      { key: 'tipo-maquina', label: 'Tipo Máquina', id: 'TMA_ID',
        fields: [{ k:'TMA_ID',l:'ID',req:true },{ k:'TMA_TIPO',l:'Tipo',req:true },{ k:'TMA_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:true,d:false},
        updateFields:['TMA_DESCRIPCION'],
        readOnlyOnUpdate:['TMA_ID','TMA_TIPO'] },
      { key: 'saldo-disponible', label: 'Saldo Disponible', id: 'SDI_ID',
        fields: [{ k:'SDI_ID',l:'ID',req:true },{ k:'SDI_TIPO',l:'Tipo (billete/moneda)',req:true },{ k:'SDI_VALOR',l:'Valor',t:'number' }],
        ops:{c:false,u:false,d:false} },
      { key: 'detalle-saldo', label: 'Recargo Máquina', id: 'DSA_ID',
        fields: [{ k:'DSA_ID',l:'ID',req:true },{ k:'DSA_CANTIDAD',l:'Cantidad',t:'number' },{ k:'DSA_SUBTOTAL',l:'Subtotal',t:'number' },{ k:'DSA_UMBRAL_MINIMO',l:'Umbral mínimo',t:'number' },{ k:'SDI_ID',l:'SDI_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true }],
        ops:{c:false,u:false,d:false} },
      { key: 'maquina', label: 'Máquina', id: 'MAQ_ID',
        fields: [
          { k:'MAQ_ID',l:'ID',req:true },
          { k:'MAQ_CODIGO',l:'Código',req:true },
          {
            k:'TMA_ID',
            l:'Tipo de máquina',
            req:true,
            t:'select',
            catalog:'tipo-maquina',
            valueKey:'TMA_ID',
            labelKey:'TMA_TIPO',
          },
          {
            k:'EMA_ID',
            l:'Estado máquina',
            req:true,
            t:'select',
            catalog:'estado-maquina',
            valueKey:'EMA_ID',
            labelKey:'EMA_ESTADO',
          },
          { k:'MAQ_FECHA_ULTIMA_RECARGA',l:'Última Recarga',t:'datetime-local' },
        ],
        ops:{c:true,u:true,d:false},
        updateFields:['EMA_ID'],
        readOnlyOnCreate:['EMA_ID'],
        readOnlyOnUpdate:['MAQ_ID'] },
      { key: 'recargo-maquina', label: 'Detalle Saldo', id: 'RMA_ID',
        fields: [
          { k:'RMA_ID',l:'ID',req:true },
          {
            k:'MAQ_ID',
            l:'Máquina',
            req:true,
            t:'select',
            catalog:'maquina',
            valueKey:'MAQ_ID',
            labelKey:'MAQ_CODIGO',
            maquinaSoloCobro:true,
            maquinaSoloOperativa:true,
          },
          { k:'RMA_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },
          { k:'RMA_DESCRIPCION',l:'Descripción' },
          { k:'RECARGA_DETALLE_SALDO',l:'Detalle billetes' },
        ],
        ops:{c:false,u:false,d:false} },
      { key: 'registro-mantenimiento', label: 'Reg. Mantenimiento', id: 'REM_ID',
        fields: [
          { k:'REM_ID',l:'ID',req:true },
          { k:'MAQ_ID',l:'Máquina',req:true,t:'select',catalog:'maquina',valueKey:'MAQ_ID',labelKey:'MAQ_CODIGO' },
          {
            k:'REM_TIPO_MOVIMIENTO',
            l:'Movimiento',
            req:true,
            t:'select',
            options:[
              { value:'INICIO', label:'Inicio' },
              { value:'FINALIZACION', label:'Finalización' },
            ],
          },
          {
            k:'REM_ESTADO_RESULTANTE_EMA_ID',
            l:'Estado al finalizar',
            t:'select',
            catalog:'estado-maquina',
            valueKey:'EMA_ID',
            labelKey:'EMA_ESTADO',
            estadoMaquinaResultadoMantenimiento:true,
          },
          { k:'REM_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },
          { k:'REM_DESCRIPCION',l:'Descripción' },
        ],
        ops:{c:true,u:true,d:false},
        updateFields:['REM_DESCRIPCION'],
        readOnlyOnUpdate:['REM_ID'] },
      { key: 'tipo-alerta', label: 'Tipo Alerta', id: 'TAL_ID',
        fields: [{ k:'TAL_ID',l:'ID',req:true },{ k:'TAL_TIPO',l:'Tipo de alerta',req:true },{ k:'TAL_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:true,d:false}, updateFields:['TAL_DESCRIPCION'], readOnlyOnUpdate:['TAL_ID','TAL_TIPO'] },
      { key: 'estado-alerta', label: 'Estado Alerta', id: 'EAL_ID',
        fields: [{ k:'EAL_ID',l:'ID',req:true },{ k:'EAL_ESTADO',l:'Estado',req:true },{ k:'EAL_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:false,d:false} },
      { key: 'alerta', label: 'Alerta', id: 'ALE_ID',
        fields: [{ k:'ALE_ID',l:'ID',req:true },{ k:'MAQ_ID',l:'Máquina',t:'select',catalog:'maquina',valueKey:'MAQ_ID',labelKey:'MAQ_CODIGO' },{ k:'ALE_MOTIVO',l:'Motivo',req:true },{ k:'ALE_DESCRIPCION',l:'Descripción' },{ k:'ALE_FECHA_HORA_GENERACION',l:'Generación',t:'datetime-local' },{ k:'EAL_ID',l:'Estado alerta',req:true,t:'select',catalog:'estado-alerta',valueKey:'EAL_ID',labelKey:'EAL_ESTADO' },{ k:'TAL_ID',l:'TAL_ID',req:true,t:'number' },{ k:'ALE_FECHA_ATENCION',l:'Atención',t:'datetime-local' },{ k:'ALE_USU_ID_RESOLVIO',l:'Persona a cargo',t:'select',catalog:'usuario',valueKey:'USU_ID',labelKey:'USU_PRIMER_NOMBRE' },{ k:'ALE_DESCRIPCION_SOLUCION',l:'Desc. Solución' }],
        ops:{c:false,u:true,d:false}, updateFields:['EAL_ID','ALE_FECHA_ATENCION','ALE_USU_ID_RESOLVIO','ALE_DESCRIPCION_SOLUCION'], readOnlyOnUpdate:['EAL_ID'] },
    ],
  },
  'pa': {
    label: 'PA - Parqueo General',
    entities: [
      { key: 'rol', label: 'Rol', id: 'ROL_ID',
        fields: [{ k:'ROL_ID',l:'ID',req:true },{ k:'ROL_TIPO',l:'Tipo',req:true },{ k:'ROL_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:true,d:true}, updateFields:['ROL_DESCRIPCION'] },
      { key: 'usuario', label: 'Usuario', id: 'USU_ID',
        fields: [{ k:'USU_ID',l:'ID',req:true },{ k:'USU_PRIMER_NOMBRE',l:'Primer Nombre',req:true },{ k:'USU_SEGUNDO_NOMBRE',l:'Segundo Nombre' },{ k:'USU_PRIMER_APELLIDO',l:'Primer Apellido',req:true },{ k:'USU_SEGUNDO_APELLIDO',l:'Segundo Apellido' },{ k:'USU_CORREO',l:'Correo',req:true },{ k:'USU_PASSWORD',l:'Contraseña',t:'password',req:true,createOnly:true },{ k:'USU_TELEFONO',l:'Teléfono' },{ k:'ROL_ID',l:'Rol',req:true,t:'select',catalog:'rol',valueKey:'ROL_ID',labelKey:'ROL_TIPO' },{ k:'USU_ACTIVO',l:'Activo',t:'checkbox' }],
        ops:{c:true,u:true,d:false} },
      { key: 'estado-espacio', label: 'Estado Espacio', id: 'EES_ID',
        fields: [{ k:'EES_ID',l:'ID',req:true },{ k:'EES_ESTADO',l:'Estado',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'espacio', label: 'Espacio', id: 'ESP_ID',
        fields: [{ k:'ESP_ID',l:'ID',req:true },{ k:'ESP_CODIGO',l:'Código',req:true },{ k:'EES_ID',l:'EES_ID' },{ k:'ESP_UBICACION',l:'Ubicación' }],
        ops:{c:true,u:true,d:false} },
      { key: 'cliente', label: 'Cliente', id: 'CLI_ID',
        fields: [{ k:'CLI_ID',l:'ID',req:true },{ k:'CLI_PRIMER_NOMBRE',l:'Primer Nombre',req:true },{ k:'CLI_SEGUNDO_NOMBRE',l:'Segundo Nombre' },{ k:'CLI_PRIMER_APELLIDO',l:'Primer Apellido',req:true },{ k:'CLI_SEGUNDO_APELLIDO',l:'Segundo Apellido' },{ k:'CLI_DPI',l:'DPI',req:true },{ k:'CLI_NIT',l:'NIT' },{ k:'CLI_CORREO',l:'Correo' },{ k:'CLI_TELEFONO',l:'Teléfono' },{ k:'CLI_ZONA',l:'Zona' },{ k:'CLI_CALLE',l:'Calle' },{ k:'CLI_NUMERO',l:'Número' },{ k:'CLI_COLONIA',l:'Colonia' },{ k:'CLI_CIUDAD',l:'Ciudad' },{ k:'CLI_CODIGO_POSTAL',l:'Cód. Postal' },{ k:'CLI_ACTIVO',l:'Activo',t:'checkbox' }],
        ops:{c:true,u:true,d:false} },
      { key: 'tipo-vehiculo', label: 'Tipo Vehículo', id: 'TVE_ID',
        fields: [{ k:'TVE_ID',l:'ID',req:true },{ k:'TVE_TIPO',l:'Tipo',req:true },{ k:'TVE_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'marca-vehiculo', label: 'Marca', id: 'MAR_ID',
        fields: [{ k:'MAR_ID',l:'ID',req:true },{ k:'MAR_NOMBRE',l:'Marca',req:true },{ k:'MAR_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'modelo-vehiculo', label: 'Modelo', id: 'MOD_ID',
        fields: [
          { k:'MOD_ID',l:'ID',req:true },
          { k:'MOD_NOMBRE',l:'Modelo',req:true },
          { k:'MAR_ID',l:'Marca',req:true,t:'select',catalog:'marca-vehiculo',valueKey:'MAR_ID',labelKey:'MAR_NOMBRE' },
          { k:'TVE_ID',l:'Tipo de vehículo',req:true,t:'select',catalog:'tipo-vehiculo',valueKey:'TVE_ID',labelKey:'TVE_TIPO' },
          { k:'MOD_DESCRIPCION',l:'Descripción' },
        ],
        ops:{c:true,u:true,d:true} },
      { key: 'color-vehiculo', label: 'Color', id: 'COL_ID',
        fields: [{ k:'COL_ID',l:'ID',req:true },{ k:'COL_NOMBRE',l:'Color',req:true },{ k:'COL_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'vehiculo', label: 'Vehículo', id: 'VEH_ID',
        fields: [
          { k:'VEH_ID',l:'ID',req:true },
          { k:'VEH_PLACA',l:'Placa',req:true },
          { k:'MOD_ID',l:'Modelo',req:true,t:'select',catalog:'modelo-vehiculo',valueKey:'MOD_ID',labelKey:'MOD_LABEL' },
          { k:'COL_ID',l:'Color',t:'select',catalog:'color-vehiculo',valueKey:'COL_ID',labelKey:'COL_NOMBRE' },
          { k:'CLI_ID',l:'CLI_ID' },
        ],
        ops:{c:true,u:true,d:false} },
      { key: 'estado-membresia', label: 'Estado Membresía', id: 'EME_ID',
        fields: [{ k:'EME_ID',l:'ID',req:true },{ k:'EME_ESTADO',l:'Estado',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'tipo-membresia', label: 'Tipo Membresía', id: 'TME_ID',
        fields: [{ k:'TME_ID',l:'ID',req:true },{ k:'TME_TIPO',l:'Tipo',req:true },{ k:'TME_DESCRIPCION',l:'Descripción' },{ k:'TME_DURACION',l:'Duración (días)',t:'number',req:true },{ k:'TME_PRECIO',l:'Precio',t:'number',req:true }],
        ops:{c:true,u:true,d:true} },
      { key: 'membresia', label: 'Membresía', id: 'MEM_ID',
        fields: [
          { k:'MEM_ID',l:'ID',req:true },
          { k:'TME_ID',l:'Tipo de membresía',req:true,t:'select',catalog:'tipo-membresia',valueKey:'TME_ID',labelKey:'TME_TIPO' },
          { k:'MEM_FECHA_INICIO',l:'Inicio',t:'datetime-local',req:true,createOnly:true },
          { k:'MEM_FECHA_VENCIMIENTO',l:'Vencimiento',t:'datetime-local',req:true },
          { k:'EME_ID',l:'Estado membresía',t:'select',catalog:'estado-membresia',valueKey:'EME_ID',labelKey:'EME_ESTADO' },
          { k:'MEM_FECHA_ULTIMO_CAMBIO_ESTADO',l:'Último Cambio',t:'datetime-local' },
          { k:'ESP_ID',l:'Espacio asignado',req:true,t:'select',catalog:'espacio',valueKey:'ESP_ID',labelKey:'ESP_CODIGO' },
          { k:'ESP_UBICACION',l:'Ubicación' },
          {
            k:'MEM_VEH_PLACA',
            l:'Placa del vehículo',
            req:true,
            omitFromApi:true,
            placeholder:'Ej. P-123ABC',
          },
        ],
        ops:{c:false,u:true,d:false},
        updateFields:['ESP_ID','ESP_UBICACION'],
        readOnlyOnUpdate:['MEM_ID'],
        readOnlyOnCreate:['MEM_FECHA_VENCIMIENTO'],
      },
      { key: 'registro-movimiento-membresia', label: 'Reg. Mov. Membresía', id: 'RMM_ID',
        fields: [{ k:'RMM_ID',l:'ID',req:true },{ k:'RMM_FECHA_HORA_ENTRADA',l:'Entrada',t:'datetime-local' },{ k:'RMM_FECHA_HORA_SALIDA',l:'Salida',t:'datetime-local' },{ k:'MEM_ID',l:'MEM_ID',req:true }],
        ops:{c:false,u:false,d:false} },
      { key: 'tipo-notificacion', label: 'Tipo Notificación', id: 'TNO_ID',
        fields: [{ k:'TNO_ID',l:'ID',req:true },{ k:'TNO_TIPO',l:'Tipo',req:true },{ k:'TNO_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'notificacion', label: 'Notificación', id: 'NOT_ID',
        fields: [{ k:'NOT_ID',l:'ID',req:true },{ k:'TNO_ID',l:'TNO_ID',req:true },{ k:'MEM_ID',l:'MEM_ID',req:true },{ k:'NOT_ULTIMA_FECHA_ENVIO',l:'Último Envío',t:'datetime-local',req:true },{ k:'NOT_PROXIMA_FECHA_ENVIO',l:'Próximo Envío',t:'datetime-local',req:true },{ k:'NOT_EXITO',l:'Éxito',t:'checkbox' }],
        ops:{c:true,u:false,d:false} },
      { key: 'incidente', label: 'Incidente', id: 'INC_ID',
        fields: [{ k:'INC_ID',l:'ID',req:true },{ k:'INC_TIPO',l:'Tipo',req:true },{ k:'INC_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'bitacora-incidente-vehiculo', label: 'Bitácora Incidente', id: 'BIV_ID',
        fields: [
          { k:'BIV_ID',l:'ID',req:true },
          { k:'BIV_DESCRIPCION',l:'Descripción',req:true },
          { k:'BIV_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true },
          { k:'VEH_ID',l:'Vehículo placa',req:true,placeholder:'Ej. P-123ABC' },
          { k:'INC_ID',l:'Incidente',req:true,t:'select',catalog:'incidente',valueKey:'INC_ID',labelKey:'INC_TIPO' },
          { k:'BIV_FECHA_RESOLUCION',l:'Fecha Resolución',t:'datetime-local' },
          { k:'USU_ID',l:'Usuario',t:'select',catalog:'usuario',valueKey:'USU_ID',labelKey:'USU_PRIMER_NOMBRE' },
        ],
        ops:{c:true,u:true,d:false}, updateFields:['BIV_FECHA_RESOLUCION','USU_ID'] },
      { key: 'tipo-pago', label: 'Tipo de Pago', id: 'TPA_ID',
        fields: [{ k:'TPA_ID',l:'ID',req:true },{ k:'TPA_TIPO',l:'Tipo',req:true },{ k:'TPA_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:false,d:false} },
      { key: 'pago', label: 'Pago', id: 'PAG_ID',
        fields: [{ k:'PAG_ID',l:'ID',req:true },{ k:'TPA_ID',l:'TPA_ID',req:true },{ k:'PAG_MONTO_TOTAL',l:'Monto Total',t:'number',req:true },{ k:'PAG_MONTO_RECIBIDO',l:'Monto Recibido',t:'number' },{ k:'PAG_VUELTO',l:'Vuelto',t:'number' },{ k:'PAG_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'detalle-pago-membresia', label: 'Det. Pago Membresía', id: 'DPM_ID',
        fields: [{ k:'DPM_ID',l:'ID',req:true },{ k:'MEM_ID',l:'MEM_ID',req:true },{ k:'PAG_ID',l:'PAG_ID',req:true }],
        ops:{c:false,u:false,d:false} },
    ],
  },
};

/** Entidades en el orden indicado; cada `key` aparece como máximo una vez. */
function collectEntitiesByKeys(keys) {
  const byKey = new Map();
  for (const s of Object.values(SECTIONS)) {
    for (const e of s.entities) {
      if (!byKey.has(e.key)) byKey.set(e.key, e);
    }
  }
  return keys.map((k) => byKey.get(k)).filter(Boolean);
}

/** Mapa columna API -> etiqueta de formulario (SECTIONS), con fallback en `getDbColumnLabel`. */
const CRUD_COLUMN_LABELS = buildLabelMapFromCrudFields(SECTIONS);

// ── HELPERS ───────────────────────────────────────────────────
function toInput(v, t) {
  if (!v) return '';
  try { const d = new Date(v); if (isNaN(d)) return ''; return t === 'date' ? d.toISOString().slice(0,10) : d.toISOString().slice(0,16); } catch { return ''; }
}
function toDateTimeLocalInput(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function calcMembresiaVencimientoInput(fechaInicio, duracionDias) {
  const dias = Number(duracionDias);
  if (!fechaInicio || !Number.isFinite(dias) || dias <= 0) return '';
  const ini = new Date(fechaInicio);
  if (Number.isNaN(ini.getTime())) return '';
  const venc = new Date(ini);
  venc.setDate(venc.getDate() + dias);
  return toDateTimeLocalInput(venc);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function shouldHideFieldOnCreate(entityKey, fieldKey) {
  return entityKey === 'bitacora-incidente-vehiculo' && ['BIV_FECHA_RESOLUCION', 'USU_ID'].includes(fieldKey);
}

function shouldHideFieldForCurrentForm(entityKey, fieldKey, form, isNewRecord = false) {
  if (
    entityKey === 'registro-mantenimiento'
    && fieldKey === 'REM_ESTADO_RESULTANTE_EMA_ID'
    && String(form?.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase() !== 'FINALIZACION'
  ) {
    return true;
  }
  if (
    entityKey === 'maquina'
    && fieldKey === 'MAQ_FECHA_ULTIMA_RECARGA'
  ) {
    return true;
  }
  if (entityKey === 'tarifa' && fieldKey === 'TAR_ID' && isNewRecord) {
    return true;
  }
  return false;
}

const MONTHLY_CLIENT_COMPACT_HIDDEN_COLUMNS = new Set([
  'CLI_SEGUNDO_NOMBRE',
  'CLI_SEGUNDO_APELLIDO',
  'CLI_NIT',
  'CLI_TELEFONO',
  'CLI_ZONA',
  'CLI_CALLE',
  'CLI_NUMERO',
  'CLI_COLONIA',
  'CLI_CIUDAD',
  'CLI_CODIGO_POSTAL',
]);

function clienteDireccionCompacta(row) {
  const parts = [
    row?.CLI_ZONA ? `Zona ${row.CLI_ZONA}` : '',
    row?.CLI_CALLE ? `Calle ${row.CLI_CALLE}` : '',
    row?.CLI_NUMERO ? `No. ${row.CLI_NUMERO}` : '',
    row?.CLI_COLONIA ? `Col. ${row.CLI_COLONIA}` : '',
    row?.CLI_CIUDAD ? String(row.CLI_CIUDAD) : '',
    row?.CLI_CODIGO_POSTAL ? `CP ${row.CLI_CODIGO_POSTAL}` : '',
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

function clienteCompactDetailItems(row) {
  return [
    { label: 'Nombre completo', value: clienteNombreCompleto(row) || '—' },
    { label: 'NIT', value: row?.CLI_NIT || '—' },
    { label: 'Telefono', value: row?.CLI_TELEFONO || '—' },
    { label: 'Direccion', value: clienteDireccionCompacta(row) || '—' },
  ];
}

function shouldHideTableColumn(
  entityKey,
  columnKey,
  {
    compactMonthlyClientTable = false,
    isMonthlyClientVehicleView = false,
    isMonthlyVehicleMembershipView = false,
    isScopedMachineMaintenanceView = false,
  } = {},
) {
  if (entityKey === 'ticket' && ['TIC_CODIGO', 'VEH_ID', 'MOD_ID', 'COL_ID', 'MAR_ID', 'TVE_ID', 'ETI_ID'].includes(columnKey)) {
    return true;
  }
  if (entityKey === 'alerta' && columnKey === 'TAL_ID') return true;
  if (entityKey === 'detalle-saldo' && ['SDI_ID', 'MAQ_ID', 'MAQ_CODIGO'].includes(columnKey)) return true;
  if (entityKey === 'registro-mantenimiento' && columnKey === 'REM_ESTADO_RESULTANTE_EMA_ID') return true;
  if (entityKey === 'registro-mantenimiento' && isScopedMachineMaintenanceView && ['MAQ_ID', 'MAQ_CODIGO'].includes(columnKey)) {
    return true;
  }
  if (
    entityKey === 'membresia'
    && [
      'EME_ESTADO',
      'TME_TIPO',
      'ESP_CODIGO',
      'CLI_PRIMER_NOMBRE',
      'CLI_SEGUNDO_NOMBRE',
      'CLI_PRIMER_APELLIDO',
      'CLI_SEGUNDO_APELLIDO',
      'VEH_ID',
      'VEH_MODELO',
    ].includes(columnKey)
  ) {
    return true;
  }
  if (entityKey === 'vehiculo' && columnKey === 'TVE_ID') return true;
  if (entityKey === 'vehiculo' && columnKey === 'EME_ID') return true;
  if (entityKey === 'vehiculo' && isMonthlyClientVehicleView && ['COL_ID', 'MAR_ID', 'MEM_ID'].includes(columnKey)) {
    return true;
  }
  if (
    entityKey === 'detalle-pago-membresia'
    && (
      columnKey === 'DPM_MES_CANCELADO'
      || columnKey === 'dpm_mes_cancelado'
      || columnKey === 'CLI_PRIMER_NOMBRE'
      || columnKey === 'CLI_SEGUNDO_NOMBRE'
      || columnKey === 'CLI_PRIMER_APELLIDO'
      || columnKey === 'CLI_SEGUNDO_APELLIDO'
    )
  ) {
    return true;
  }
  if (
    entityKey === 'bitacora-incidente-vehiculo'
    && [
      'VEH_ID',
      'VEH_MODELO',
      'BIV_RESUELTO',
      'USU_PRIMER_NOMBRE',
      'USU_PRIMER_APELLIDO',
      'INC_ID',
      'CLI_ID',
      'CLI_PRIMER_NOMBRE',
      'CLI_PRIMER_APELLIDO',
      'CLI_CORREO',
    ].includes(columnKey)
  ) {
    return true;
  }
  if (compactMonthlyClientTable && MONTHLY_CLIENT_COMPACT_HIDDEN_COLUMNS.has(columnKey)) return true;
  if (entityKey === 'vehiculo' && isMonthlyClientVehicleView && columnKey === 'CLI_ID') return true;
  if (entityKey === 'membresia' && isMonthlyVehicleMembershipView && ['CLI_ID', 'VEH_PLACA'].includes(columnKey)) {
    return true;
  }
  return false;
}

function isCurrentSessionUser(rowUserId, sessionUserId) {
  if (rowUserId == null || sessionUserId == null) return false;
  return String(rowUserId).trim() !== '' && String(rowUserId) === String(sessionUserId);
}
function emptyForm(fields) {
  return Object.fromEntries(
    fields.map((f) => [f.k, f.t === 'checkbox' ? 0 : '']),
  );
}
function preparePayload(fields, form) {
  const out = {};
  fields.forEach(f => {
    if (f.omitFromApi) return;
    const v = form[f.k];
    if (f.t === 'checkbox') out[f.k] = v ? 1 : 0;
    else if (f.t === 'number') out[f.k] = v !== '' && v != null ? Number(v) : null;
    else if (f.t === 'datetime-local' || f.t === 'date') out[f.k] = v ? new Date(v).toISOString() : null;
    else out[f.k] = v || null;
  });
  return out;
}

function clienteNombreCompleto(row) {
  return [
    row?.CLI_PRIMER_NOMBRE,
    row?.CLI_SEGUNDO_NOMBRE,
    row?.CLI_PRIMER_APELLIDO,
    row?.CLI_SEGUNDO_APELLIDO,
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function normPlacaVehiculo(s) {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Resuelve placa escrita → `VEH_ID` usando el listado de `/vehiculo`. */
async function resolveVehiculoIdByPlaca(rawPlaca) {
  const want = normPlacaVehiculo(rawPlaca);
  if (!want) return null;
  const res = await fetch(`${API_BASE}/vehiculo`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) return null;
  const hit = data.find((v) => normPlacaVehiculo(v.VEH_PLACA ?? v.veh_placa) === want);
  if (!hit) return null;
  const id = hit.VEH_ID ?? hit.veh_id;
  return id != null && String(id).trim() !== '' ? id : null;
}

async function resolveOrCreateVehiculoIdByPlacaForTicket(rawPlaca) {
  const placa = normPlacaVehiculo(rawPlaca);
  if (!placa) return null;
  const existingId = await resolveVehiculoIdByPlaca(placa);
  if (existingId != null && String(existingId).trim() !== '') return existingId;

  const [modeloRes, colorRes] = await Promise.all([
    fetch(`${API_BASE}/modelo-vehiculo`, { cache: 'no-store' }),
    fetch(`${API_BASE}/color-vehiculo`, { cache: 'no-store' }),
  ]);
  const [modeloData, colorData] = await Promise.all([modeloRes.json(), colorRes.json()]);
  const modeloList = Array.isArray(modeloData) ? modeloData : [];
  const colorList = Array.isArray(colorData) ? colorData : [];
  const modId = modeloList[0]?.MOD_ID;
  const colId = colorList[0]?.COL_ID;
  if (!modeloRes.ok || modId == null || String(modId).trim() === '') {
    throw new Error('No hay modelos de vehículo disponibles para registrar la placa nueva.');
  }
  if (!colorRes.ok || colId == null || String(colId).trim() === '') {
    throw new Error('No hay colores disponibles para registrar la placa nueva.');
  }

  const createVehRes = await fetch(`${API_BASE}/vehiculo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      VEH_PLACA: placa,
      MOD_ID: Number(modId) || modId,
      COL_ID: Number(colId) || colId,
      CLI_ID: null,
    }),
  });
  const createVehData = await parseJsonSafe(createVehRes);
  if (!createVehRes.ok) {
    throw new Error(createVehData?.error || createVehData?.message || createVehRes.statusText);
  }
  const createdVehId = createVehData?.VEH_ID ?? createVehData?.veh_id ?? null;
  if (createdVehId == null || String(createdVehId).trim() === '') {
    throw new Error('Se creó el vehículo, pero no se recibió su identificador.');
  }
  return createdVehId;
}

async function resolveVehiculoByPlaca(rawPlaca) {
  const placa = normPlacaVehiculo(rawPlaca);
  if (!placa) return null;
  const res = await fetch(`${API_BASE}/vehiculo`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) return null;
  return data.find((v) => normPlacaVehiculo(v.VEH_PLACA ?? v.veh_placa) === placa) || null;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

/** Tono de alerta en toolbar: errores de API y restricciones (p. ej. FK al eliminar). */
function isCrudErrorMessage(text) {
  return isErrorLikeMessage(text);
}

function userMsg(text) {
  return formatUserFacingMessage(text);
}

function getMachineStatusStripeClass(tone) {
  if (tone === 'success') return 'crudx-machine-card--status-success';
  if (tone === 'caution') return 'crudx-machine-card--status-caution';
  if (tone === 'danger') return 'crudx-machine-card--status-danger';
  return 'crudx-machine-card--status-neutral';
}

/** Texto corto y claro bajo el título de cada lista del panel admin (`sectionPath` + entidad). */
function getAdminListContextHint(sectionPath, entityKey) {
  if (!sectionPath || !entityKey) return null;

  const HINTS = {
    'clientes-mensuales': {
      cliente:
        'Clientes mensuales o de alta administrativa. Los esporádicos capturados por NIT en tickets se consultan en Tickets y vehículos.',
      membresia:
        'Contratos mensuales: unen un vehículo con un espacio fijo y el tipo de plan elegido.',
      'detalle-pago-membresia':
        'Cada fila representa un pago aplicado a una membresía. Puedes filtrar por placa con la búsqueda.',
      vehiculo:
        'Vehículos vinculados a clientes mensuales. Los vehículos de clientes esporádicos con NIT permanecen en Tickets y vehículos.',
      'tipo-vehiculo': 'Tipos de vehículo disponibles (sedán, SUV, etc.) para clasificar cada placa.',
      'tipo-membresia': 'Planes disponibles: duración, precio y nombre comercial para nuevas membresías.',
      'estado-membresia': 'Estados posibles del contrato (activa, cancelada, vencida o suspendida).',
      'registro-movimiento-membresia':
        'Movimientos de entrada y salida por membresía. Opcional: filtra por placa con la búsqueda.',
    },
    'tickets-vehiculos': {
      cliente:
        'Clientes esporádicos capturados por NIT en cobro (sin membresía). Puedes buscarlos por nombre, apellido o nombre completo.',
      'estado-ticket':
        'Define en qué etapa va cada ticket (por ejemplo activo o ya pagado).',
      ticket:
        'Tickets de visitantes sin plan mensual. Usa el buscador para filtrar por código o placa.',
      vehiculo:
        'Vehículos esporádicos: placas de visita sin cliente o ligadas a clientes esporádicos capturados por NIT. No se mezclan con Clientes mensuales.',
      cobro: 'Historial de cobros al salir: montos, NIT o consumidor final y máquina donde se pagó.',
      'tipo-cobro': 'Tipos de cobro que el cajero elige al cerrar un ticket (efectivo, tarjeta, etc.).',
      'detalle-maquina-ticket':
        'Línea de tiempo de cada paso del ticket en las máquinas (entrada, cobro o salida).',
    },
    usuarios: {
      usuario: 'Cuentas de quienes usan el sistema o el panel administrativo.',
      rol: 'Perfiles que agrupan permisos (por ejemplo, administrador u operador).',
    },
    maquinas: {
      maquina: 'Equipos de entrada, cobro o salida, con su código interno y estado.',
      'tipo-maquina': 'Clasifica cada equipo según su función en el parqueo.',
      'estado-maquina': 'Indica si la máquina está en servicio, en revisión o fuera de línea.',
      'detalle-maquina-ticket':
        'Auditoría de qué máquina atendió cada movimiento del ticket.',
      'saldo-disponible':
        'Billetes o monedas que la caja de una máquina puede recibir o devolver.',
      'detalle-saldo':
        'Selecciona una máquina de cobro y agrega billetes por denominación para registrar la recarga. La tabla solo aparece después de elegir máquina y aplicar el filtro.',
      'recargo-maquina': 'Consulta el historial de recargas de efectivo hechas en caja. Aquí solo se busca y visualiza.',
      'registro-mantenimiento': 'Intervenciones técnicas o preventivas sobre cada equipo.',
    },
    tarifas: {
      tarifa: 'Precio por tiempo, tipo de tarifa y minutos de gracia que aplican al cobrar estacionamiento.',
      'tipo-cobro': 'Catálogo reutilizable al registrar un cobro (nombre y descripción).',
      'tipo-pago': 'Medios de pago para otros procesos del sistema (membresías, mensualidades, etc.).',
    },
    informativo: {
      'tipo-vehiculo': 'Catálogo informativo de tipos de vehículo usados para clasificar placas y reportes.',
      'marca-vehiculo': 'Marcas disponibles para vincular modelos y analizar la flota.',
      'modelo-vehiculo': 'Modelos registrados con su marca y tipo de vehículo asociado.',
      'color-vehiculo': 'Colores disponibles para identificar vehículos en búsquedas y tickets.',
      'tipo-membresia': 'Planes mensuales disponibles: duración, precio y nombre comercial.',
      'estado-membresia': 'Estados posibles de una membresía durante su vigencia.',
      'tipo-cobro': 'Tipos de cobro usados al cerrar tickets y registrar pagos.',
      'estado-maquina': 'Estados operativos posibles para las máquinas del parqueo.',
    },
    'bitacora-incidentes': {
      'bitacora-incidente-vehiculo':
        'Seguimiento de novedades por vehículo. Arriba puedes filtrar por incidente, fechas o si ya quedó resuelto.',
      incidente: 'Tipos de suceso que luego enlazas en la bitácora (choque, avería, etc.).',
    },
    alertas: {
      'tipo-alerta': 'Motivos por los que el sistema genera alertas (saldo bajo, asistencia, etc.).',
      'estado-alerta': 'Etapas de atención de una alerta (pendiente, en curso, cerrada...).',
      alerta: 'Listado de alertas generadas; revisa su estado y la máquina asociada.',
    },
  };

  const specific = HINTS[sectionPath]?.[entityKey];
  if (specific) return specific;
  return 'Consulta o edita los registros de esta lista. Usa "+ Nuevo" para altas y "Editar" en cada fila cuando aplique.';
}

function getAdminListContextHelpModel(sectionPath, entityKey) {
  const detailedHints = {
    'tickets-vehiculos': {
      ticket: {
        summary:
          'Tickets de visitantes sin plan mensual. Usa la busqueda para localizar el caso por codigo o placa.',
        steps: [
          'Si un ticket vence por tiempo de gracia, el cliente vera una alerta al intentar salir y debe acercarse a administracion.',
          'Busca el ticket y cambia su estado a "Volver a cobrar".',
          'Ese cambio atiende automaticamente la alerta para que el cliente pueda pagar de nuevo y salir.',
          'Si el ticket se extravio, completa primero el proceso administrativo fuera del sistema y luego cambia el estado a "Extraviado" o usa el panel de ticket extraviado.',
        ],
        note: 'Al cobrar un ticket marcado como extraviado se aplica el recargo correspondiente.',
      },
    },
    maquinas: {
      'detalle-saldo': {
        summary: 'Selecciona una maquina de cobro para ver el efectivo disponible por denominacion.',
        steps: [
          'Filtra por maquina para cargar la tabla de denominaciones.',
          'Usa el boton "Recargar" en la fila del billete o moneda que estas agregando.',
          'Ingresa la cantidad de unidades agregadas.',
          'El sistema actualiza el saldo y registra la recarga en el historial de la maquina.',
        ],
      },
      'recargo-maquina': {
        summary: 'Consulta el historial de recargas de efectivo hechas en caja.',
        note: 'La recarga se ejecuta desde Detalle saldo; aqui solo se busca y visualiza.',
      },
      'registro-mantenimiento': {
        summary: 'Intervenciones tecnicas o preventivas sobre cada equipo.',
        steps: [
          'Selecciona la maquina que sera intervenida.',
          'Si la maquina esta operativa, el formulario registrara un INICIO y la movera a mantenimiento.',
          'Si la maquina ya esta en mantenimiento, el formulario solo permitira una FINALIZACION.',
          'Al finalizar, elige un estado resultante valido: Operativa o Fuera de servicio.',
        ],
      },
    },
  };

  const detailed = detailedHints[sectionPath]?.[entityKey];
  if (detailed) return detailed;

  const summary = getAdminListContextHint(sectionPath, entityKey);
  return summary ? { summary } : null;
}

function renderAdminListContextHint(help) {
  if (!help) return null;
  return (
    <>
      {help.summary ? <p>{help.summary}</p> : null}
      {help.steps?.length ? (
        <ol>
          {help.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {help.note ? <p>{help.note}</p> : null}
    </>
  );
}

function getAdminSectionTitle(sectionPath) {
  const titles = {
    'clientes-mensuales': 'Clientes mensuales',
    'tickets-vehiculos': 'Tickets y vehiculos',
    usuarios: 'Gestion de usuarios',
    maquinas: 'Gestion de maquinas',
    tarifas: 'Gestion de cobro',
    informativo: 'Informativo',
    'bitacora-incidentes': 'Bitacora de incidentes',
    alertas: 'Alertas',
  };
  return titles[sectionPath] || 'Modulo administrativo';
}

function getEntityIcon(entityKey) {
  const icons = {
    cliente: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    membresia: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
        <line x1="6" y1="15" x2="10" y2="15"/>
        <line x1="6" y1="17.5" x2="8" y2="17.5"/>
      </svg>
    ),
    'detalle-pago-membresia': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="13" y2="17"/>
      </svg>
    ),
    vehiculo: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h8l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
        <circle cx="7.5" cy="17" r="2.5"/>
        <circle cx="16.5" cy="17" r="2.5"/>
        <line x1="10" y1="17" x2="14" y2="17"/>
      </svg>
    ),
    'tipo-vehiculo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="14" y2="13"/>
        <line x1="8" y1="17" x2="11" y2="17"/>
      </svg>
    ),
    'tipo-membresia': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    'estado-membresia': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    'registro-movimiento-membresia': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
    ticket: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 1 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 1 0 0-4z"/>
        <path d="M9 8h6M9 12h6M9 16h4"/>
      </svg>
    ),
    'estado-ticket': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l4 4L19 6"/>
        <path d="M21 12a9 9 0 1 1-3.1-6.8"/>
      </svg>
    ),
    cobro: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
        <path d="M7 10v4M17 10v4"/>
      </svg>
    ),
    'tipo-cobro': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h16M4 17h10"/>
        <path d="M18 15l2 2 3-4"/>
      </svg>
    ),
    'tipo-pago': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3"/>
        <path d="M2 10h20M6 15h3"/>
      </svg>
    ),
    tarifa: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    usuario: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4"/>
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>
      </svg>
    ),
    rol: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    maquina: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <path d="M9 6h6M9 10h6M9 18h6"/>
        <circle cx="12" cy="14" r="1"/>
      </svg>
    ),
    'tipo-maquina': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="7" height="7" rx="1"/>
        <rect x="13" y="4" width="7" height="7" rx="1"/>
        <rect x="4" y="13" width="7" height="7" rx="1"/>
        <path d="M13 16h7M16.5 13v7"/>
      </svg>
    ),
    'estado-maquina': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    'detalle-maquina-ticket': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h9M4 12h16M4 18h9"/>
        <path d="M16 5l4 4-4 4"/>
      </svg>
    ),
    'saldo-disponible': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16v10H4z"/>
        <path d="M8 11h8M8 14h5"/>
      </svg>
    ),
    'detalle-saldo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M8 8h8M8 12h8M8 16h4"/>
      </svg>
    ),
    'recargo-maquina': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/>
        <path d="M7 8h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"/>
        <path d="M19 6l2 2 2-2"/>
      </svg>
    ),
    'registro-mantenimiento': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4"/>
        <path d="M16 3l5 5"/>
      </svg>
    ),
    'bitacora-incidente-vehiculo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l3 3v15H6z"/>
        <path d="M14 3v4h4M9 12h6M9 16h4"/>
      </svg>
    ),
    incidente: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
      </svg>
    ),
    'tipo-alerta': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
        <path d="M10 21h4"/>
      </svg>
    ),
    'estado-alerta': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    alerta: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
        <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
      </svg>
    ),
    'marca-vehiculo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16l-2 10H6z"/>
        <path d="M8 7l2-3h4l2 3"/>
        <circle cx="9" cy="17" r="2"/>
        <circle cx="15" cy="17" r="2"/>
      </svg>
    ),
    'modelo-vehiculo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13h18"/>
        <path d="M5 13l2-5h10l2 5"/>
        <path d="M7 17h10"/>
      </svg>
    ),
    'color-vehiculo': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>
        <path d="M8.5 14a3.5 3.5 0 0 0 7 0"/>
      </svg>
    ),
  };
  return icons[entityKey] || (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function getEntityCardMeta(entityKey) {
  /*
   * Lógica de colores (tone):
   *   ocean  (azul)   → Entidades principales / registros operativos core
   *   mint   (verde)  → Financiero: cobros, pagos, saldos, recargas
   *   sunset (naranja)→ Reglas de negocio, alertas, incidentes, mantenimiento
   *   steel  (gris)   → Catálogos de referencia y estados
   */
  const meta = {
    // ── Entidades core (ocean) ──────────────────────────────────────────────
    cliente:                      { badge: 'CLI', eyebrow: 'Base maestra',          tone: 'ocean'  },
    membresia:                    { badge: 'MEM', eyebrow: 'Planes y vigencias',     tone: 'ocean'  },
    vehiculo:                     { badge: 'VEH', eyebrow: 'Flota vinculada',        tone: 'ocean'  },
    ticket:                       { badge: 'TIC', eyebrow: 'Flujo de visita',        tone: 'ocean'  },
    usuario:                      { badge: 'USR', eyebrow: 'Acceso al sistema',      tone: 'ocean'  },
    maquina:                      { badge: 'MAQ', eyebrow: 'Equipos operativos',     tone: 'ocean'  },
    'registro-movimiento-membresia': { badge: 'MOV', eyebrow: 'Registro de acceso', tone: 'ocean'  },
    'detalle-maquina-ticket':     { badge: 'DMT', eyebrow: 'Trazabilidad',           tone: 'ocean'  },

    // ── Financiero (mint) ───────────────────────────────────────────────────
    cobro:                        { badge: 'COB', eyebrow: 'Pagos de salida',        tone: 'mint'   },
    'detalle-pago-membresia':     { badge: 'PAG', eyebrow: 'Cobros aplicados',       tone: 'mint'   },
    'saldo-disponible':           { badge: 'SAL', eyebrow: 'Efectivo en caja',       tone: 'mint'   },
    'detalle-saldo':              { badge: 'DET', eyebrow: 'Denominaciones',         tone: 'mint'   },
    'recargo-maquina':            { badge: 'REC', eyebrow: 'Recargas',               tone: 'mint'   },

    // ── Reglas, alertas, incidentes y mantenimiento (sunset) ───────────────
    tarifa:                       { badge: 'TAR', eyebrow: 'Reglas de precio',       tone: 'sunset' },
    alerta:                       { badge: 'ALE', eyebrow: 'Operacion activa',       tone: 'sunset' },
    'tipo-alerta':                { badge: 'TIP', eyebrow: 'Motivos de alerta',      tone: 'sunset' },
    incidente:                    { badge: 'INC', eyebrow: 'Catalogo de sucesos',    tone: 'sunset' },
    'bitacora-incidente-vehiculo':{ badge: 'BIT', eyebrow: 'Seguimiento',            tone: 'sunset' },
    'registro-mantenimiento':     { badge: 'MAN', eyebrow: 'Servicio tecnico',       tone: 'sunset' },

    // ── Catálogos y estados de referencia (steel) ──────────────────────────
    'tipo-vehiculo':              { badge: 'TIP', eyebrow: 'Catalogo de apoyo',      tone: 'steel'  },
    'marca-vehiculo':             { badge: 'MAR', eyebrow: 'Marca',                  tone: 'steel'  },
    'modelo-vehiculo':            { badge: 'MOD', eyebrow: 'Modelo',                 tone: 'steel'  },
    'color-vehiculo':             { badge: 'COL', eyebrow: 'Color',                  tone: 'steel'  },
    'tipo-membresia':             { badge: 'PLA', eyebrow: 'Oferta comercial',       tone: 'steel'  },
    'estado-membresia':           { badge: 'EST', eyebrow: 'Control operativo',      tone: 'steel'  },
    'estado-ticket':              { badge: 'EST', eyebrow: 'Control de ticket',      tone: 'steel'  },
    'estado-maquina':             { badge: 'EST', eyebrow: 'Disponibilidad',         tone: 'steel'  },
    'estado-alerta':              { badge: 'EST', eyebrow: 'Atencion',               tone: 'steel'  },
    'tipo-cobro':                 { badge: 'TIP', eyebrow: 'Catalogo de cobro',      tone: 'steel'  },
    'tipo-pago':                  { badge: 'PAG', eyebrow: 'Medios de pago',         tone: 'steel'  },
    'tipo-maquina':               { badge: 'TIP', eyebrow: 'Clasificacion',          tone: 'steel'  },
    rol:                          { badge: 'ROL', eyebrow: 'Permisos',               tone: 'steel'  },
  };

  return meta[entityKey] || { badge: String(entityKey || 'SEC').slice(0, 3).toUpperCase(), eyebrow: 'Seccion', tone: 'steel' };
}

function getEntityCardTraits(targetEntity) {
  if (!targetEntity?.ops) return ['Consulta'];

  const traits = ['Consulta'];
  if (targetEntity.ops.c) traits.push('Altas');
  if (targetEntity.ops.u) traits.push('Edicion');
  if (targetEntity.ops.d) traits.push('Eliminacion');
  return traits;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCellForPopup(v) {
  if (v == null) return '—';
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) {
    try {
      return new Date(v).toLocaleString('es-GT');
    } catch {
      /* keep */
    }
  }
  return String(v);
}

function labelMaquina(row, catalogOptions) {
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

function normTipoMaquinaClient(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Misma regla que en el servidor (`tipoMaquinaRules`): cobro / caja. */
function isTipoMaquinaCobroClient(tmaTipo) {
  const x = normTipoMaquinaClient(tmaTipo);
  return x.includes('cobro') || x.includes('caja');
}

/** Solo máquinas cuyo tipo es de cobro (para filtro en Detalle saldo). */
function maquinasTipoCobroList(catalogOptions, { onlyOperative = false } = {}) {
  const maqsBase = catalogOptions?.maquina || [];
  const maqs = onlyOperative ? filterOperativeMachines(maqsBase) : maqsBase;
  const tipos = catalogOptions?.['tipo-maquina'] || [];
  return maqs.filter((m) => {
    const t = tipos.find((t0) => String(t0.TMA_ID) === String(m.TMA_ID));
    return t != null && isTipoMaquinaCobroClient(t.TMA_TIPO);
  });
}

function maquinasOperativasList(catalogOptions) {
  return filterOperativeMachines(catalogOptions?.maquina || []);
}

function maquinasMantenimientoElegiblesList(catalogOptions) {
  return filterMaintenanceEligibleMachines(catalogOptions?.maquina || []);
}

function findMachineById(catalogOptions, maqId) {
  if (maqId == null || String(maqId).trim() === '') return null;
  return (catalogOptions?.maquina || []).find((row) => String(row.MAQ_ID) === String(maqId)) || null;
}

function maintenanceMovementOptionsForMachine(machine) {
  const movement = getMaintenanceMovementForMachine(machine);
  if (!movement) return [];
  if (movement === 'FINALIZACION') return [{ value: 'FINALIZACION', label: 'Finalización' }];
  return [{ value: 'INICIO', label: 'Inicio' }];
}

function maintenanceMovementHelp(machine) {
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

function isMaquinaCobroRow(row, catalogOptions) {
  const tipos = catalogOptions?.['tipo-maquina'] || [];
  const tipo = tipos.find((t) => String(t.TMA_ID) === String(row?.TMA_ID));
  return tipo != null && isTipoMaquinaCobroClient(tipo.TMA_TIPO);
}

function isMachineStatusMaintenanceById(catalogOptions, emaId) {
  if (emaId == null || String(emaId).trim() === '') return false;
  const estados = catalogOptions?.['estado-maquina'] || [];
  const estado = estados.find((row) => String(row.EMA_ID) === String(emaId));
  return estado != null && isMachineStatusMaintenance(estado.EMA_ESTADO);
}

function machineManualStatusOptions(catalogOptions, currentEmaId) {
  const rows = catalogOptions?.['estado-maquina'] || [];
  const manualRows = filterManualMachineStatuses(rows);
  if (!isMachineStatusMaintenanceById(catalogOptions, currentEmaId)) return manualRows;
  const current = rows.find((row) => String(row.EMA_ID) === String(currentEmaId));
  return current ? [current, ...manualRows] : manualRows;
}

/** Texto para opciones del `select` de incidente: solo tipo (sin descripción). */
function labelIncidente(row) {
  const id = row?.INC_ID ?? row?.inc_id;
  if (id == null || id === '') return '—';
  const tipo = String(row?.INC_TIPO ?? '').trim();
  return tipo || String(id);
}

function labelEstadoAlerta(ealId, catalogOptions) {
  const e = (catalogOptions?.['estado-alerta'] || []).find((x) => String(x.EAL_ID) === String(ealId));
  return e?.EAL_ESTADO ? String(e.EAL_ESTADO) : (ealId == null ? '—' : String(ealId));
}

function labelUsuario(usuId, catalogOptions) {
  const u = (catalogOptions?.usuario || []).find((x) => String(x.USU_ID) === String(usuId));
  if (!u) return usuId == null ? '—' : String(usuId);
  const full = [u.USU_PRIMER_NOMBRE, u.USU_PRIMER_APELLIDO].filter(Boolean).join(' ').trim();
  return full || String(usuId);
}

function labelTipoAlerta(talId, catalogOptions) {
  const tal = (catalogOptions?.['tipo-alerta'] || []).find((x) => String(x.TAL_ID) === String(talId));
  return tal?.TAL_TIPO ? String(tal.TAL_TIPO) : (talId == null ? '—' : String(talId));
}

function labelEstadoTicket(etiId, catalogOptions) {
  const e = (catalogOptions?.['estado-ticket'] || []).find((x) => String(x.ETI_ID) === String(etiId));
  return e?.ETI_ESTADO ? String(e.ETI_ESTADO) : (etiId == null ? '—' : String(etiId));
}

function labelTipoVehiculo(row, catalogOptions) {
  const tveId = row?.TVE_ID ?? row?.tve_id;
  if (row?.TVE_TIPO != null && String(row.TVE_TIPO).trim() !== '') return String(row.TVE_TIPO);
  const tipo = (catalogOptions?.['tipo-vehiculo'] || []).find((x) => String(x.TVE_ID) === String(tveId));
  return tipo?.TVE_TIPO ? String(tipo.TVE_TIPO) : (tveId == null ? '—' : String(tveId));
}

function labelEstadoMembresia(emeId, catalogOptions) {
  const estado = (catalogOptions?.['estado-membresia'] || []).find((x) => String(x.EME_ID) === String(emeId));
  return estado?.EME_ESTADO ? String(estado.EME_ESTADO) : (emeId == null ? '—' : String(emeId));
}

function getMembershipStatusBadge(statusValue) {
  const label = String(statusValue ?? '').trim();
  const rawStatus = label.toLowerCase();

  if (!label || label === '—') {
    return { label: label || '—', tone: 'neutral' };
  }
  if (rawStatus.includes('venc')) {
    return { label: 'Vencida', tone: 'danger' };
  }
  if (rawStatus.includes('cancel')) {
    return { label: 'Cancelada', tone: 'caution' };
  }
  if (rawStatus.includes('suspend') || rawStatus.includes('inactiv')) {
    return { label: 'Suspendida', tone: 'warning' };
  }
  if (rawStatus.includes('activ')) {
    return { label: 'Activa', tone: 'success' };
  }
  if (rawStatus.includes('por vencer')) {
    return { label, tone: 'warning' };
  }
  return { label, tone: 'neutral' };
}

function normalizeStatusText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function getMachineStatusBadge(statusValue) {
  const label = String(statusValue ?? '').trim();
  const rawStatus = normalizeStatusText(label);

  if (!label || label === '—') {
    return { label: label || '—', tone: 'neutral' };
  }
  if (rawStatus.includes('fuera') && rawStatus.includes('servicio')) {
    return { label: 'Fuera de servicio', tone: 'danger' };
  }
  if (rawStatus.includes('manten')) {
    return { label: 'Mantenimiento', tone: 'caution' };
  }
  if (rawStatus.includes('inoper') || rawStatus.includes('desactiv') || rawStatus.includes('no disponible')) {
    return { label: 'Inoperativa', tone: 'neutral' };
  }
  if (rawStatus.includes('operativ') || (rawStatus.includes('en') && rawStatus.includes('servicio'))) {
    return { label: 'Operativa', tone: 'success' };
  }
  return { label, tone: 'neutral' };
}

/** ETI_ID del estado «Activo» según catálogo API (coincide con seed PAR_ESTADO_TICKET). */
function pickEtiIdActivo(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  const exact = rows.find(
    (x) => x?.ETI_ESTADO != null && String(x.ETI_ESTADO).trim().toLowerCase() === 'activo',
  );
  if (exact?.ETI_ID != null) return String(exact.ETI_ID);
  const loose = rows.find((x) => String(x?.ETI_ESTADO || '').toLowerCase().includes('activ'));
  return loose?.ETI_ID != null ? String(loose.ETI_ID) : '';
}

function pickEmeIdActiva(estados) {
  const rows = Array.isArray(estados) ? estados : [];
  const exact = rows.find(
    (x) => x?.EME_ESTADO != null && String(x.EME_ESTADO).trim().toLowerCase() === 'activa',
  );
  if (exact?.EME_ID != null) return String(exact.EME_ID);
  const loose = rows.find((x) => String(x?.EME_ESTADO || '').toLowerCase().includes('activ'));
  return loose?.EME_ID != null ? String(loose.EME_ID) : '';
}

function getVehicleMembershipStatus(row, catalogOptions) {
  const hasMembership = row?.MEM_ID != null && String(row.MEM_ID).trim() !== '';
  if (!hasMembership) {
    return { label: 'Sin membresía', tone: 'neutral', hasMembership: false };
  }

  const rawStatus = String(
    row?.EME_ESTADO ?? labelEstadoMembresia(row?.EME_ID, catalogOptions) ?? '',
  )
    .trim()
    .toLowerCase();
  const vencimientoRaw = row?.MEM_FECHA_VENCIMIENTO ?? row?.mem_fecha_vencimiento ?? null;
  const vencimiento = vencimientoRaw ? new Date(vencimientoRaw) : null;
  const hasValidExpiry = vencimiento instanceof Date && !Number.isNaN(vencimiento.getTime());
  const isCancelled = rawStatus.includes('cancel');
  const isSuspended = rawStatus.includes('suspend') || rawStatus.includes('inactiv');

  if (rawStatus.includes('venc')) {
    return { label: 'Vencida', tone: 'danger', hasMembership: true };
  }

  if (isSuspended) {
    return { label: 'Suspendida', tone: 'warning', hasMembership: true };
  }

  if (isCancelled) {
    if (hasValidExpiry) {
      const now = new Date();
      const diffDays = (vencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) {
        return { label: 'Vencida', tone: 'danger', hasMembership: true };
      }
    }
    return { label: 'Cancelada', tone: 'caution', hasMembership: true };
  }

  if (hasValidExpiry) {
    const now = new Date();
    const diffDays = (vencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return { label: 'Vencida', tone: 'danger', hasMembership: true };
    }
    if (!isCancelled && diffDays <= 7) {
      return { label: 'Por vencer', tone: 'warning', hasMembership: true };
    }
  }

  if (rawStatus.includes('activ')) {
    return { label: 'Activa', tone: 'success', hasMembership: true };
  }

  return { ...getMembershipStatusBadge(row?.EME_ESTADO ?? labelEstadoMembresia(row?.EME_ID, catalogOptions) ?? 'Con membresía'), hasMembership: true };
}

/** Abre una ventana de navegador con detalle enriquecido de alerta. */
function openAlertaDetailPopup(row, formatValue) {
  const features =
    'width=540,height=440,left=140,top=90,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
  const name = `alertaDetalle_${row?.ALE_ID ?? Date.now()}`;
  const w = window.open('about:blank', name, features);
  if (!w) {
    window.alert('No se pudo abrir la ventana. Permite ventanas emergentes para este sitio.');
    return;
  }
  try {
    w.opener = null;
  } catch {
    /* ignore */
  }

  const title = `Alerta ${row?.ALE_ID ?? ''}`.trim() || 'Detalle de alerta';
  const bodyRows = Object.entries(row)
    .map(([k, v]) => {
      const display = formatCellForPopup(formatValue ? formatValue(k, v, row) : v);
      let label = getDbColumnLabel(k, CRUD_COLUMN_LABELS);
      if (k === 'MAQ_ID') label = 'Máquina';
      if (k === 'EAL_ID') label = 'Estado alerta';
      if (k === 'TAL_ID') label = 'Tipo alerta';
      if (k === 'ALE_USU_ID_RESOLVIO') label = 'Persona a cargo';
      return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(display)}</dd>`;
    })
    .join('');

  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 18px 18px; font-size: 14px; line-height: 1.55; color: #0f172a; background: linear-gradient(180deg,#f8fafc,#eef2ff); }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 10px 28px rgba(15,23,42,0.08); }
  h1 { font-size: 1.08rem; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
  dl { margin: 0; }
  dt { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-top: 12px; }
  dt:first-of-type { margin-top: 0; }
  dd { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; }
</style></head><body>
<div class="card">
<h1>${escapeHtml(title)}</h1>
<dl>${bodyRows}</dl>
</div>
</body></html>`);
  w.document.close();
}

// ── COMPONENT ─────────────────────────────────────────────────
/**
 * @param {{ filterEntityKeys?: string[]; entityAccessMap?: Record<string, { ops?: { c?: boolean, u?: boolean, d?: boolean } }>, sessionUserId?: string | number | null, sessionIsFullAdmin?: boolean }} props
 * Si `filterEntityKeys` está definido, se ocultan las pestañas ME-MS / MC / PA y solo se listan esas entidades.
 * `entityAccessMap`: sobreescribe permisos por entidad sin alterar la configuración base.
 * `sessionUserId`: USU_ID del admin logueado (bitácora: marca quién resolvió el incidente).
 * `sectionPath`: ruta del módulo en `/admin` (muestra textos de ayuda acordes a cada lista).
 */
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

export default function CrudDemo({
  filterEntityKeys = null,
  entityAccessMap = null,
  sessionUserId = null,
  sessionIsFullAdmin = false,
  sectionPath = '',
}) {
  const TODAY = todayYmd();
  const NOW_LOCAL = nowLocalDatetime();

  const readOnlyFieldStyle = {
    background: '#e5e7eb',
    color: '#4b5563',
    borderColor: '#d1d5db',
    cursor: 'default',
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const applyEntityAccess = useMemo(
    () => (baseEntity) => {
      if (!baseEntity) return baseEntity;
      const override = entityAccessMap?.[baseEntity.key];
      if (!override) return baseEntity;
      return {
        ...baseEntity,
        ...override,
        ops: override.ops ? { ...baseEntity.ops, ...override.ops } : baseEntity.ops,
      };
    },
    [entityAccessMap],
  );
  const filteredEntities = useMemo(
    () => (
      filterEntityKeys?.length
        ? collectEntitiesByKeys(filterEntityKeys).map(applyEntityAccess)
        : null
    ),
    [filterEntityKeys, applyEntityAccess],
  );

  const [section, setSection] = useState('me-ms');
  const [entity, setEntity]   = useState(null);
  const [rows, setRows]        = useState([]);
  const [loading, setLoading]  = useState(false);
  const [form, setForm]        = useState({});
  const [editId, setEditId]    = useState(null);
  const [msg, setMsg]          = useState('');
  const [machineCardsRows, setMachineCardsRows] = useState([]);
  const [machineCardsCatalogs, setMachineCardsCatalogs] = useState({ tipos: [], estados: [] });
  const [machineCardsLoading, setMachineCardsLoading] = useState(false);
  const [machineCreateOpen, setMachineCreateOpen] = useState(false);
  const [machineCreateSaving, setMachineCreateSaving] = useState(false);
  const [machineStatusSavingId, setMachineStatusSavingId] = useState(null);
  const [machineStatusMenuId, setMachineStatusMenuId] = useState(null);
  const [machineCreateForm, setMachineCreateForm] = useState({ MAQ_CODIGO: '', TMA_ID: '', EMA_ID: '' });
  const [bivFilter, setBivFilter] = useState(emptyBivFilter);
  const [alertaFilter, setAlertaFilter] = useState(emptyAlertaFilter);
  const [ticketFilter, setTicketFilter] = useState(emptyTicketFilter);
  const [cobroFilter, setCobroFilter] = useState(emptyCobroFilter);
  const [clienteFilter, setClienteFilter] = useState(emptyClienteFilter);
  const [membresiaFilter, setMembresiaFilter] = useState(emptyMembresiaFilter);
  const [detalleMaqTicketFilter, setDetalleMaqTicketFilter] = useState(emptyDetalleMaqTicketFilter);
  const [detalleMaqTicketTxOptions, setDetalleMaqTicketTxOptions] = useState([]);
  const [detalleSaldoMaqFilter, setDetalleSaldoMaqFilter] = useState(emptyDetalleSaldoMaqFilter);
  const [recargoMaqFilter, setRecargoMaqFilter] = useState(emptyRecargoMaqFilter);
  const [rmmPlacaFilter, setRmmPlacaFilter] = useState(emptyRmmPlacaFilter);
  const [dpmPlacaFilter, setDpmPlacaFilter] = useState(emptyDpmPlacaFilter);
  const [maquinaFilter, setMaquinaFilter] = useState(emptyMaquinaFilter);
  const [vehiculoFilter, setVehiculoFilter] = useState(emptyVehiculoFilter);
  /** Modal MEM-2: vehículo sin cliente al crear membresía */
  const [vehClienteModal, setVehClienteModal] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  /** Catálogos para campos `t: 'select'` (clave = segmento API, p. ej. tipo-vehiculo). */
  const [catalogOptions, setCatalogOptions] = useState({});
  const [monthlyWorkspaceView, setMonthlyWorkspaceView] = useState('cards');
  const [monthlySelectedClient, setMonthlySelectedClient] = useState(null);
  const [monthlySelectedVehicle, setMonthlySelectedVehicle] = useState(null);
  const [expandedClientRowId, setExpandedClientRowId] = useState(null);
  const bivQueryKey = searchParams.toString();
  const sectionEntities = filteredEntities ?? (SECTIONS[section]?.entities ?? []).map(applyEntityAccess);
  const isMonthlyWorkspace = sectionPath === 'clientes-mensuales' && Boolean(filteredEntities?.length);
  const isAdminCardWorkspace = Boolean(filteredEntities?.length);
  const isMachineWorkspace = sectionPath === 'maquinas' && Boolean(filteredEntities?.length);
  const adminSectionTitle = getAdminSectionTitle(sectionPath);
  const isMonthlyClientVehicleView =
    isMonthlyWorkspace && monthlyWorkspaceView === 'clienteVehiculos' && entity?.key === 'vehiculo';
  const isMonthlyVehicleMembershipView =
    isMonthlyWorkspace && monthlyWorkspaceView === 'vehiculoMembresia' && entity?.key === 'membresia';
  const isMonthlyCompactClientTable =
    isMonthlyWorkspace && monthlyWorkspaceView === 'entity' && entity?.key === 'cliente';
  const showAdminEntityCards = isAdminCardWorkspace && monthlyWorkspaceView === 'cards';
  const showMachineCards = isMachineWorkspace && showAdminEntityCards;

  const refreshMachineCards = useCallback(async ({ silent = false, preserveMessage = false } = {}) => {
    if (!silent) setMachineCardsLoading(true);
    if (!preserveMessage) setMsg('');
    try {
      const [resMaq, resTipos, resEstados] = await Promise.all([
        fetch(`${API_BASE}/maquina`, { cache: 'no-store' }),
        fetch(`${API_BASE}/tipo-maquina`, { cache: 'no-store' }),
        fetch(`${API_BASE}/estado-maquina`, { cache: 'no-store' }),
      ]);
      const [maqJson, tiposJson, estadosJson] = await Promise.all([
        parseJsonSafe(resMaq),
        parseJsonSafe(resTipos),
        parseJsonSafe(resEstados),
      ]);
      if (!resMaq.ok) throw new Error(maqJson.error || maqJson.message || resMaq.statusText);
      setMachineCardsRows(Array.isArray(maqJson) ? maqJson : []);
      setMachineCardsCatalogs({
        tipos: resTipos.ok && Array.isArray(tiposJson) ? tiposJson : [],
        estados: resEstados.ok && Array.isArray(estadosJson) ? estadosJson : [],
      });
      return {
        rows: Array.isArray(maqJson) ? maqJson : [],
        tipos: resTipos.ok && Array.isArray(tiposJson) ? tiposJson : [],
        estados: resEstados.ok && Array.isArray(estadosJson) ? estadosJson : [],
      };
    } catch (err) {
      setMachineCardsRows([]);
      setMachineCardsCatalogs({ tipos: [], estados: [] });
      setMsg(userMsg(err.message));
      return null;
    } finally {
      if (!silent) setMachineCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showMachineCards) return;
    refreshMachineCards();
  }, [showMachineCards, refreshMachineCards]);
  const formatAlertaDetailValue = (key, value) => {
    if (key === 'MAQ_ID') return labelMaquina({ MAQ_ID: value }, catalogOptions);
    if (key === 'EAL_ID') return labelEstadoAlerta(value, catalogOptions);
    if (key === 'ALE_USU_ID_RESOLVIO') return labelUsuario(value, catalogOptions);
    if (key === 'TAL_ID') return labelTipoAlerta(value, catalogOptions);
    return value;
  };

  async function refreshCatalogOptionsForEntity(targetEntity = entity) {
    if (!targetEntity) return {};
    const catsBase = [
      ...new Set(
        targetEntity.fields.filter((f) => f.t === 'select' && f.catalog).map((f) => f.catalog),
      ),
    ];
    const cats =
      targetEntity.key === 'alerta'
        ? [...new Set([...catsBase, 'tipo-maquina', 'tipo-alerta'])]
        : targetEntity.key === 'ticket'
            ? [...new Set([...catsBase, 'estado-ticket'])]
            : targetEntity.key === 'detalle-saldo'
              ? [...new Set([...catsBase, 'maquina', 'tipo-maquina'])]
              : targetEntity.key === 'recargo-maquina'
                ? [...new Set([...catsBase, 'tipo-maquina'])]
                : targetEntity.key === 'registro-mantenimiento'
                  ? [...new Set([...catsBase, 'tipo-maquina'])]
                  : catsBase;
    if (!cats.length) return {};
    const updates = {};
    await Promise.all(
      cats.map(async (cat) => {
        try {
          const res = await fetch(`${API_BASE}/${cat}`, { cache: 'no-store' });
          const data = await res.json();
          updates[cat] = Array.isArray(data) ? data : [];
        } catch {
          updates[cat] = [];
        }
      }),
    );
    setCatalogOptions((prev) => ({ ...prev, ...updates }));
    return updates;
  }

  useEffect(() => {
    if (!entity) return;
    let cancelled = false;
    (async () => {
      await refreshCatalogOptionsForEntity(entity);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [entity?.key]);

  useEffect(() => {
    if (entity?.key !== 'bitacora-incidente-vehiculo') return;
    const r = searchParams.get('biv_resuelto');
    setBivFilter({
      placa: searchParams.get('biv_placa') || '',
      resuelto: r === '0' || r === '1' ? r : '',
      desde: (searchParams.get('biv_desde') || '').slice(0, 10),
      hasta: (searchParams.get('biv_hasta') || '').slice(0, 10),
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'alerta') return;
    setAlertaFilter({
      eal: searchParams.get('eal_id') || '',
      tal: searchParams.get('tal_id') || '',
      maq: searchParams.get('maq_id') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'ticket') return;
    setTicketFilter({
      eti: searchParams.get('eti_id') || '',
      q: searchParams.get('q') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'cobro') return;
    setCobroFilter({
      q: searchParams.get('cob_q') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL -> form solo cuando cambia la query

  useEffect(() => {
    if (editId !== '__new__') return;
    if (entity?.ops?.c !== false) return;
    setEditId(null);
    setForm(entity ? emptyForm(entity.fields) : {});
  }, [entity?.key, entity?.ops?.c, editId]);

  useEffect(() => {
    if (entity?.key !== 'cliente') return;
    setClienteFilter({
      q: searchParams.get('cli_q') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'membresia') return;
    setMembresiaFilter({
      q: searchParams.get('mem_q') || '',
      eme: searchParams.get('mem_eme') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'detalle-maquina-ticket') return;
    setDetalleMaqTicketFilter({
      q: searchParams.get('dmt_q') || '',
      desde: searchParams.get('dmt_desde') || '',
      hasta: searchParams.get('dmt_hasta') || '',
      tx: searchParams.get('dmt_tx') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'detalle-saldo') return;
    setDetalleSaldoMaqFilter({
      maq: searchParams.get('ds_maq_id') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'recargo-maquina') return;
    setRecargoMaqFilter({
      maq: searchParams.get('rma_maq_id') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'registro-movimiento-membresia') return;
    setRmmPlacaFilter({
      placa: searchParams.get('rmm_placa') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'detalle-pago-membresia') return;
    setDpmPlacaFilter({
      placa: searchParams.get('dpm_placa') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'maquina') return;
    setMaquinaFilter({
      tma: searchParams.get('maq_tma_id') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

  useEffect(() => {
    if (entity?.key !== 'vehiculo') return;
    setVehiculoFilter({
      q: searchParams.get('veh_q') || '',
      tve: searchParams.get('veh_tve_id') || '',
    });
  }, [entity?.key, bivQueryKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync URL → form solo cuando cambia la query

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


  useEffect(() => {
    if (entity?.key !== 'cliente') {
      setExpandedClientRowId(null);
    }
  }, [entity?.key]);

  useEffect(() => {
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
  }, [catalogOptions?.['estado-membresia'], editId, form?.EME_ID, isMonthlyVehicleMembershipView]);

  useEffect(() => {
    if (entity) load();
  }, [entity, searchParams, sectionPath]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true); setMsg('');
    try {
      let listUrl = `${API_BASE}/${entity.key}`;
      if (entity.key === 'vehiculo' && sectionPath === 'tickets-vehiculos') {
        listUrl += '?esporadico=1';
      }
      if (entity.key === 'vehiculo' && sectionPath === 'clientes-mensuales') {
        listUrl += '?con_membresia_cliente=1';
      }
      if (entity.key === 'detalle-saldo') {
        const dsMaq = searchParams.get('ds_maq_id');
        if (dsMaq == null || String(dsMaq).trim() === '') {
          setRows([]);
          return;
        }
        listUrl = `${API_BASE}/detalle-saldo/maquina/${encodeURIComponent(String(dsMaq).trim())}`;
      }
      if (entity.key === 'recargo-maquina') {
        const rmaMaq = searchParams.get('rma_maq_id');
        if (rmaMaq == null || String(rmaMaq).trim() === '') {
          setRows([]);
          return;
        }
        listUrl = `${API_BASE}/recargo-maquina/maquina/${encodeURIComponent(String(rmaMaq).trim())}`;
      }
      if (entity.key === 'registro-mantenimiento') {
        const remMaq = searchParams.get('rem_maq_id');
        if (remMaq != null && String(remMaq).trim() !== '') {
          listUrl = `${API_BASE}/registro-mantenimiento/maquina/${encodeURIComponent(String(remMaq).trim())}`;
        }
      }
      if (entity.key === 'cliente') {
        const p = new URLSearchParams();
        if (sectionPath === 'clientes-mensuales') p.set('mode', 'mensual');
        if (sectionPath === 'tickets-vehiculos') p.set('mode', 'esporadico');
        const q = (searchParams.get('cli_q') || '').trim();
        if (q) p.set('q', q);
        const qs = p.toString();
        if (qs) listUrl += `?${qs}`;
      }
      if (entity.key === 'registro-movimiento-membresia') {
        const placa = (searchParams.get('rmm_placa') || '').trim();
        if (placa) listUrl += `?placa=${encodeURIComponent(placa)}`;
      }
      if (entity.key === 'detalle-pago-membresia') {
        const placa = (searchParams.get('dpm_placa') || '').trim();
        if (placa) listUrl += `?placa=${encodeURIComponent(placa)}`;
      }
      const res = await fetch(listUrl, { cache: 'no-store' });
      const data = await res.json();
      let list = Array.isArray(data) ? data : [];
      if (entity.key === 'detalle-maquina-ticket') {
        const needsPlacaJoin = list.some((r) => (r.VEH_PLACA == null || String(r.VEH_PLACA).trim() === ''));
        if (needsPlacaJoin) {
          try {
            const tRes = await fetch(`${API_BASE}/ticket`, { cache: 'no-store' });
            const tData = await tRes.json();
            const tickets = Array.isArray(tData) ? tData : [];
            const byTicId = new Map(
              tickets.map((t) => [String(t.TIC_ID ?? ''), String(t.VEH_PLACA ?? '').trim()]),
            );
            list = list.map((r) => ({
              ...r,
              VEH_PLACA: String(r.VEH_PLACA ?? '').trim() || byTicId.get(String(r.TIC_ID ?? '')) || '',
            }));
          } catch {
            // Si falla el enrich, seguimos con la data original.
          }
        }
        const txOptions = [...new Set(list.map((r) => String(r.DMT_TRANSACCION ?? '').trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        setDetalleMaqTicketTxOptions(txOptions);
      }
      if (entity.key === 'alerta') {
        const eal = searchParams.get('eal_id');
        const tal = searchParams.get('tal_id');
        const maq = searchParams.get('maq_id');
        if (eal) list = list.filter((r) => String(r.EAL_ID ?? r.eal_id) === eal);
        if (tal) list = list.filter((r) => String(r.TAL_ID ?? r.tal_id) === tal);
        if (maq) list = list.filter((r) => String(r.MAQ_ID ?? r.maq_id) === maq);
      }
      if (entity.key === 'bitacora-incidente-vehiculo') {
        const placa = (searchParams.get('biv_placa') || '').trim().toUpperCase();
        const resu = searchParams.get('biv_resuelto');
        const desde = searchParams.get('biv_desde');
        const hasta = searchParams.get('biv_hasta');
        if (placa) {
          list = list.filter((r) => String(r.VEH_PLACA ?? r.veh_placa ?? '').toUpperCase().includes(placa));
        }
        if (resu === '0' || resu === '1') {
          const want = resu === '1';
          list = list.filter((r) => {
            const v = r.BIV_RESUELTO ?? r.biv_resuelto;
            const ok = v === 1 || v === true || v === '1';
            return want ? ok : !ok;
          });
        }
        if (desde) {
          const d0 = new Date(desde);
          if (!Number.isNaN(d0.getTime())) {
            list = list.filter((r) => {
              const fh = r.BIV_FECHA_HORA ?? r.biv_fecha_hora;
              if (!fh) return false;
              return new Date(fh) >= d0;
            });
          }
        }
        if (hasta) {
          const d1 = new Date(hasta);
          if (!Number.isNaN(d1.getTime())) {
            d1.setHours(23, 59, 59, 999);
            list = list.filter((r) => {
              const fh = r.BIV_FECHA_HORA ?? r.biv_fecha_hora;
              if (!fh) return false;
              return new Date(fh) <= d1;
            });
          }
        }
      }
      if (entity.key === 'ticket') {
        const eti = searchParams.get('eti_id');
        if (eti) list = list.filter((r) => String(r.ETI_ID ?? r.eti_id) === eti);
        const q = (searchParams.get('q') || '').trim().toUpperCase();
        if (q) {
          list = list.filter((r) => {
            const cod = String(r.TIC_CODIGO ?? '').toUpperCase();
            const placa = String(r.VEH_PLACA ?? '').toUpperCase();
            return cod.includes(q) || placa.includes(q);
          });
        }
      }
      if (entity.key === 'cobro') {
        const q = (searchParams.get('cob_q') || '').trim().toUpperCase();
        if (q) {
          list = list.filter((r) => {
            const nit = String(r.COB_NIT ?? r.cob_nit ?? '').trim().toUpperCase();
            const ticId = String(r.TIC_ID ?? r.tic_id ?? '').trim().toUpperCase();
            return nit.includes(q) || ticId.includes(q);
          });
        }
      }
      if (entity.key === 'membresia') {
        const q = (searchParams.get('mem_q') || '').trim().toUpperCase();
        const eme = (searchParams.get('mem_eme') || '').trim();
        if (eme) list = list.filter((r) => String(r.EME_ID ?? r.eme_id) === eme);
        if (q) {
          list = list.filter((r) => {
            const nombre = [
              r.CLI_PRIMER_NOMBRE,
              r.CLI_SEGUNDO_NOMBRE,
              r.CLI_PRIMER_APELLIDO,
              r.CLI_SEGUNDO_APELLIDO,
            ]
              .map((x) => String(x ?? '').trim())
              .filter(Boolean)
              .join(' ')
              .toUpperCase();
            const cliId = String(r.CLI_ID ?? '').toUpperCase();
            const placa = String(r.VEH_PLACA ?? '').toUpperCase();
            return nombre.includes(q) || cliId.includes(q) || placa.includes(q);
          });
        }
      }
      if (entity.key === 'detalle-maquina-ticket') {
        const q = (searchParams.get('dmt_q') || '').trim().toUpperCase();
        const desde = searchParams.get('dmt_desde') || '';
        const hasta = searchParams.get('dmt_hasta') || '';
        const tx = (searchParams.get('dmt_tx') || '').trim().toUpperCase();
        const maq = (searchParams.get('dmt_maq_id') || '').trim();
        if (maq) {
          list = list.filter((r) => String(r.MAQ_ID ?? r.maq_id) === maq);
        }
        if (tx && !maq) {
          list = list.filter((r) => String(r.DMT_TRANSACCION ?? '').toUpperCase() === tx);
        }
        if (q) {
          list = list.filter((r) => {
            const placa = String(r.VEH_PLACA ?? '').toUpperCase();
            const ticketId = String(r.TIC_ID ?? r.tic_id ?? '').toUpperCase();
            const ticketCodigo = String(r.TIC_CODIGO ?? r.tic_codigo ?? '').toUpperCase();
            return placa.includes(q) || ticketId.includes(q) || ticketCodigo.includes(q);
          });
        }
        if (desde || hasta) {
          const from = desde ? new Date(desde) : null;
          const to = hasta ? new Date(hasta) : null;
          const fromTime = from && !Number.isNaN(from.getTime()) ? from.getTime() : null;
          const toTime = to && !Number.isNaN(to.getTime()) ? to.getTime() : null;
          list = list.filter((r) => {
            const raw = r.DMT_HORA_TRANSACCION ?? r.dmt_hora_transaccion ?? '';
            if (!raw) return false;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return false;
            const time = d.getTime();
            if (fromTime != null && time < fromTime) return false;
            if (toTime != null && time > toTime) return false;
            return true;
          });
        }
      }
      if (entity.key === 'vehiculo') {
        const q = (searchParams.get('veh_q') || '').trim().toUpperCase();
        const tve = (searchParams.get('veh_tve_id') || '').trim();
        if (tve) {
          list = list.filter((r) => String(r.TVE_ID ?? r.tve_id) === tve);
        }
        if (q) {
          list = list.filter((r) => String(r.VEH_PLACA ?? '').toUpperCase().includes(q));
        }
      }
      if (entity.key === 'recargo-maquina') {
        const maq = (searchParams.get('rma_maq_id') || '').trim();
        if (maq) {
          list = list.filter((r) => String(r.MAQ_ID ?? r.maq_id) === maq);
        }
      }
      if (entity.key === 'maquina') {
        const tma = (searchParams.get('maq_tma_id') || '').trim();
        if (tma) {
          list = list.filter((r) => String(r.TMA_ID ?? r.tma_id) === tma);
        }
      }
      setRows(list);
    } catch (e) { setMsg(userMsg(e.message)); setRows([]); }
    finally { setLoading(false); }
  }

  function selectSection(s) {
    if (section === s) return;
    setSection(s);
    setEntity(null);
    setRows([]);
    setEditId(null);
    setMsg('');
  }

  function findMonthlyEntity(key) {
    return sectionEntities.find((item) => item.key === key) || null;
  }

  function resetMonthlyWorkspaceToCards() {
    setMonthlyWorkspaceView('cards');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setEntity(null);
    setRows([]);
    setEditId(null);
    setForm({});
    setMsg('');
  }

  function openMonthlyClientVehicles(row) {
    const vehiculoEntity = findMonthlyEntity('vehiculo');
    if (!vehiculoEntity) return;
    setMonthlySelectedClient(row);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setMonthlyWorkspaceView('clienteVehiculos');
    setRows([]);
    setEntity(vehiculoEntity);
    setEditId(null);
    setForm(emptyForm(vehiculoEntity.fields));
    setMsg('');
  }

  function returnToMonthlyClients() {
    const clienteEntity = findMonthlyEntity('cliente');
    setMonthlyWorkspaceView('entity');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    if (clienteEntity) {
      setRows([]);
      setEntity(clienteEntity);
      setEditId(null);
      setForm(emptyForm(clienteEntity.fields));
    }
    setMsg('');
  }

  function returnToMonthlyClientVehicles() {
    const vehiculoEntity = findMonthlyEntity('vehiculo');
    setMonthlyWorkspaceView('clienteVehiculos');
    setMonthlySelectedVehicle(null);
    if (vehiculoEntity) {
      const nextForm = emptyForm(vehiculoEntity.fields);
      if (monthlySelectedClient?.CLI_ID != null) {
        nextForm.CLI_ID = String(monthlySelectedClient.CLI_ID);
      }
      setRows([]);
      setEntity(vehiculoEntity);
      setEditId(null);
      setForm(nextForm);
    }
    setMsg('');
  }

  function openMonthlyVehicleMemberships(row, { startNew = false } = {}) {
    const membresiaEntity = findMonthlyEntity('membresia');
    if (!membresiaEntity) return;
    const nextForm = emptyForm(membresiaEntity.fields);
    nextForm.MEM_VEH_PLACA = String(row?.VEH_PLACA ?? '');
    const emeIdActiva = pickEmeIdActiva(catalogOptions?.['estado-membresia']);
    if (emeIdActiva) {
      nextForm.EME_ID = emeIdActiva;
    }
    setMonthlySelectedClient((current) => current || (row?.CLI_ID != null ? { CLI_ID: row.CLI_ID } : null));
    setMonthlySelectedVehicle(row);
    setMonthlyWorkspaceView('vehiculoMembresia');
    setRows([]);
    setEntity(membresiaEntity);
    setEditId(startNew ? '__new__' : null);
    setForm(nextForm);
    setMsg('');
  }

  function startNewMonthlyClientVehicle() {
    if (!isMonthlyClientVehicleView || !entity || monthlySelectedClient?.CLI_ID == null) return;
    const nextForm = emptyForm(entity.fields);
    nextForm.CLI_ID = String(monthlySelectedClient.CLI_ID);
    setEditId('__new__');
    setForm(nextForm);
    setMsg('');
  }

  function startNewMonthlyVehicleMembership() {
    if (!isMonthlyVehicleMembershipView || !entity || !monthlySelectedVehicle) return;
    const nextForm = emptyForm(entity.fields);
    nextForm.MEM_VEH_PLACA = String(monthlySelectedVehicle?.VEH_PLACA ?? '');
    const emeIdActiva = pickEmeIdActiva(catalogOptions?.['estado-membresia']);
    if (emeIdActiva) {
      nextForm.EME_ID = emeIdActiva;
    }
    setEditId('__new__');
    setForm(nextForm);
    setMsg('');
  }

  function selectEntity(e) {
    if (e.key === 'detalle-maquina-ticket') {
      const p = new URLSearchParams(searchParams);
      p.delete('dmt_maq_id');
      p.delete('dmt_q');
      p.delete('dmt_desde');
      p.delete('dmt_hasta');
      p.delete('dmt_tx');
      setDetalleMaqTicketFilter(emptyDetalleMaqTicketFilter);
      setSearchParams(p, { replace: true });
    }
    if (e.key === 'detalle-saldo') {
      const p = new URLSearchParams(searchParams);
      p.delete('ds_maq_id');
      setDetalleSaldoMaqFilter(emptyDetalleSaldoMaqFilter);
      setSearchParams(p, { replace: true });
    }
    if (e.key === 'recargo-maquina') {
      const p = new URLSearchParams(searchParams);
      p.delete('rma_maq_id');
      setRecargoMaqFilter(emptyRecargoMaqFilter);
      setSearchParams(p, { replace: true });
    }
    if (e.key === 'registro-mantenimiento') {
      const p = new URLSearchParams(searchParams);
      p.delete('rem_maq_id');
      setSearchParams(p, { replace: true });
    }
    if (entity?.key === e.key) {
      if (isAdminCardWorkspace && monthlyWorkspaceView === 'cards') {
        setMonthlyWorkspaceView('entity');
        setMonthlySelectedClient(null);
        setMonthlySelectedVehicle(null);
        setExpandedClientRowId(null);
      }
      return;
    }
    if (isAdminCardWorkspace) {
      setMonthlyWorkspaceView('entity');
      setMonthlySelectedClient(null);
      setMonthlySelectedVehicle(null);
      setExpandedClientRowId(null);
    }
    setRows([]);
    setEntity(e);
    setEditId(null);
    setForm(emptyForm(e.fields));
    setMsg('');
  }

  function startEdit(row) {
    const updateKeys = Array.from(
      new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
    );
    const fields = updateKeys.length
      ? entity.fields.filter(f => f.k === entity.id || updateKeys.includes(f.k))
      : entity.fields;
    const f = {};
    fields.forEach((fd) => {
      if (entity?.key === 'membresia' && fd.k === 'MEM_VEH_PLACA') {
        const placa = row.VEH_PLACA ?? row.veh_placa;
        f[fd.k] = placa != null ? String(placa) : '';
        return;
      }
      const v = row[fd.k];
      if (fd.t === 'checkbox') f[fd.k] = v == 1 ? 1 : 0;
      else if (fd.t === 'datetime-local' || fd.t === 'date') f[fd.k] = toInput(v, fd.t);
      else if (fd.t === 'select') f[fd.k] = v != null && v !== '' ? String(v) : '';
      else f[fd.k] = v ?? '';
    });
    if (!sessionIsFullAdmin && sessionUserId != null && String(sessionUserId).trim() !== '') {
      if (entity?.key === 'alerta') {
        f.ALE_USU_ID_RESOLVIO = String(sessionUserId);
      }
      if (entity?.key === 'bitacora-incidente-vehiculo') {
        f.USU_ID = String(sessionUserId);
      }
    }
    setForm(f); setEditId(row[entity.id]);
  }

  function cancelEdit() { setEditId(null); setForm(emptyForm(entity.fields)); }

  function applyBivFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    ['biv_placa', 'biv_resuelto', 'biv_desde', 'biv_hasta'].forEach((k) => p.delete(k));
    if (bivFilter.placa.trim()) p.set('biv_placa', bivFilter.placa.trim());
    if (bivFilter.resuelto === '0' || bivFilter.resuelto === '1') p.set('biv_resuelto', bivFilter.resuelto);
    if (bivFilter.desde.trim()) p.set('biv_desde', bivFilter.desde.trim());
    if (bivFilter.hasta.trim()) p.set('biv_hasta', bivFilter.hasta.trim());
    setSearchParams(p, { replace: true });
  }

  function clearBivFilters() {
    const p = new URLSearchParams(searchParams);
    ['biv_placa', 'biv_resuelto', 'biv_desde', 'biv_hasta'].forEach((k) => p.delete(k));
    setSearchParams(p, { replace: true });
    setBivFilter(emptyBivFilter);
  }

  function applyAlertaFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    ['eal_id', 'tal_id', 'maq_id'].forEach((k) => p.delete(k));
    if (alertaFilter.eal) p.set('eal_id', alertaFilter.eal);
    if (alertaFilter.tal) p.set('tal_id', alertaFilter.tal);
    if (alertaFilter.maq) p.set('maq_id', alertaFilter.maq);
    setSearchParams(p, { replace: true });
  }

  function clearAlertaFilters() {
    const p = new URLSearchParams(searchParams);
    ['eal_id', 'tal_id', 'maq_id'].forEach((k) => p.delete(k));
    setSearchParams(p, { replace: true });
    setAlertaFilter(emptyAlertaFilter);
  }

  function applyTicketFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    ['eti_id', 'q'].forEach((k) => p.delete(k));
    if (ticketFilter.eti) p.set('eti_id', ticketFilter.eti);
    const qTrim = ticketFilter.q.trim();
    if (qTrim) p.set('q', qTrim);
    setSearchParams(p, { replace: true });
  }

  function clearTicketFilters() {
    const p = new URLSearchParams(searchParams);
    ['eti_id', 'q'].forEach((k) => p.delete(k));
    setSearchParams(p, { replace: true });
    setTicketFilter(emptyTicketFilter);
  }

  function applyCobroFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('cob_q');
    const qTrim = cobroFilter.q.trim();
    if (qTrim) p.set('cob_q', qTrim);
    setSearchParams(p, { replace: true });
  }

  function clearCobroFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('cob_q');
    setSearchParams(p, { replace: true });
    setCobroFilter(emptyCobroFilter);
  }

  function applyClienteFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('cli_q');
    const qTrim = clienteFilter.q.trim();
    if (qTrim) p.set('cli_q', qTrim);
    setSearchParams(p, { replace: true });
  }

  function clearClienteFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('cli_q');
    setSearchParams(p, { replace: true });
    setClienteFilter(emptyClienteFilter);
  }

  function applyMembresiaFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('mem_q');
    p.delete('mem_eme');
    const qTrim = membresiaFilter.q.trim();
    if (qTrim) p.set('mem_q', qTrim);
    if (membresiaFilter.eme) p.set('mem_eme', membresiaFilter.eme);
    setSearchParams(p, { replace: true });
  }

  function clearMembresiaFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('mem_q');
    p.delete('mem_eme');
    setSearchParams(p, { replace: true });
    setMembresiaFilter(emptyMembresiaFilter);
  }

  function applyDetalleMaqTicketFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    const qTrim = detalleMaqTicketFilter.q.trim();
    const desdeTrim = detalleMaqTicketFilter.desde.trim();
    const hastaTrim = detalleMaqTicketFilter.hasta.trim();
    const isMachineScoped = Boolean((p.get('dmt_maq_id') || '').trim());
    if (qTrim) p.set('dmt_q', qTrim);
    if (desdeTrim) p.set('dmt_desde', desdeTrim);
    if (hastaTrim) p.set('dmt_hasta', hastaTrim);
    if (!isMachineScoped && detalleMaqTicketFilter.tx) p.set('dmt_tx', detalleMaqTicketFilter.tx);
    setSearchParams(p, { replace: true });
  }

  function clearDetalleMaqTicketFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    setSearchParams(p, { replace: true });
    setDetalleMaqTicketFilter(emptyDetalleMaqTicketFilter);
  }

  function applyDetalleSaldoMaqFilter(e) {
    e.preventDefault();
    const id = String(detalleSaldoMaqFilter.maq ?? '').trim();
    if (!id) {
      setMsg('Selecciona una máquina de cobro.');
      return;
    }
    setMsg('');
    const p = new URLSearchParams(searchParams);
    p.delete('ds_maq_id');
    p.set('ds_maq_id', id);
    setSearchParams(p, { replace: true });
  }

  function clearDetalleSaldoMaqFilter() {
    const p = new URLSearchParams(searchParams);
    p.delete('ds_maq_id');
    setSearchParams(p, { replace: true });
    setDetalleSaldoMaqFilter(emptyDetalleSaldoMaqFilter);
  }

  function applyRecargoMaqFilter(e) {
    e.preventDefault();
    const id = String(recargoMaqFilter.maq ?? '').trim();
    if (!id) {
      setMsg('Selecciona una máquina de cobro.');
      return;
    }
    setMsg('');
    const p = new URLSearchParams(searchParams);
    p.delete('rma_maq_id');
    p.set('rma_maq_id', id);
    setSearchParams(p, { replace: true });
  }

  function clearRecargoMaqFilter() {
    const p = new URLSearchParams(searchParams);
    p.delete('rma_maq_id');
    setSearchParams(p, { replace: true });
    setRecargoMaqFilter(emptyRecargoMaqFilter);
  }

  function applyRmmPlacaFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('rmm_placa');
    const placaTrim = rmmPlacaFilter.placa.trim();
    if (placaTrim) p.set('rmm_placa', placaTrim);
    setSearchParams(p, { replace: true });
  }

  function clearRmmPlacaFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('rmm_placa');
    setSearchParams(p, { replace: true });
    setRmmPlacaFilter(emptyRmmPlacaFilter);
  }

  function applyDpmPlacaFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('dpm_placa');
    const placaTrim = dpmPlacaFilter.placa.trim();
    if (placaTrim) p.set('dpm_placa', placaTrim);
    setSearchParams(p, { replace: true });
  }

  function clearDpmPlacaFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('dpm_placa');
    setSearchParams(p, { replace: true });
    setDpmPlacaFilter(emptyDpmPlacaFilter);
  }

  function applyMaquinaFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('maq_tma_id');
    if (maquinaFilter.tma) p.set('maq_tma_id', maquinaFilter.tma);
    setSearchParams(p, { replace: true });
  }

  function clearMaquinaFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('maq_tma_id');
    setSearchParams(p, { replace: true });
    setMaquinaFilter(emptyMaquinaFilter);
  }

  function applyVehiculoFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    p.delete('veh_q');
    p.delete('veh_tve_id');
    const qTrim = vehiculoFilter.q.trim();
    if (qTrim) p.set('veh_q', qTrim);
    if (vehiculoFilter.tve) p.set('veh_tve_id', vehiculoFilter.tve);
    setSearchParams(p, { replace: true });
  }

  function clearVehiculoFilters() {
    const p = new URLSearchParams(searchParams);
    p.delete('veh_q');
    p.delete('veh_tve_id');
    setSearchParams(p, { replace: true });
    setVehiculoFilter(emptyVehiculoFilter);
  }

  function getMachineCardInfo(row) {
    const tipoId = row?.TMA_ID ?? row?.tma_id;
    const estadoId = row?.EMA_ID ?? row?.ema_id;
    const tipoRow = machineCardsCatalogs.tipos.find((item) => String(item.TMA_ID) === String(tipoId));
    const estadoRow = machineCardsCatalogs.estados.find((item) => String(item.EMA_ID) === String(estadoId));
    const tipo = String(row?.TMA_TIPO ?? tipoRow?.TMA_TIPO ?? 'Maquina').trim();
    const estado = String(row?.EMA_ESTADO ?? estadoRow?.EMA_ESTADO ?? 'Sin estado').trim();
    const tipoNorm = normTipoMaquinaClient(tipo);
    const isCobro = isTipoMaquinaCobroClient(tipo);
    const isEntrada = tipoNorm.includes('entrada');
    const isSalida = tipoNorm.includes('salida');
    const role = isCobro
      ? 'Cobro'
      : isEntrada
        ? 'Entrada'
        : isSalida
          ? 'Salida'
          : tipo;
    const variant = isCobro ? 'cash' : isSalida ? 'exit' : 'entry';
    return { tipo, estado, role, isCobro, variant };
  }

  function openNewMachineForm() {
    const inoperativaId = pickInoperativeMachineStatusId(machineCardsCatalogs.estados);
    setMachineCreateForm({
      MAQ_CODIGO: '',
      TMA_ID: '',
      EMA_ID: inoperativaId ? String(inoperativaId) : '',
    });
    setMachineCreateOpen(true);
    setMsg('');
  }

  function closeNewMachineForm() {
    setMachineCreateOpen(false);
    setMachineCreateSaving(false);
    setMachineCreateForm({ MAQ_CODIGO: '', TMA_ID: '', EMA_ID: '' });
  }

  async function submitNewMachine(e) {
    e.preventDefault();
    if (machineCreateSaving) return;
    const codigo = String(machineCreateForm.MAQ_CODIGO ?? '').trim();
    const tmaId = String(machineCreateForm.TMA_ID ?? '').trim();
    const emaId = String(machineCreateForm.EMA_ID ?? '').trim() || pickInoperativeMachineStatusId(machineCardsCatalogs.estados);
    if (!codigo) {
      setMsg('Indica el código de la máquina.');
      return;
    }
    if (!tmaId) {
      setMsg('Selecciona el tipo de máquina.');
      return;
    }
    if (!emaId) {
      setMsg('No se encontró el estado inicial Inoperativa.');
      return;
    }
    setMachineCreateSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/maquina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MAQ_CODIGO: codigo,
          TMA_ID: Number(tmaId) || tmaId,
          EMA_ID: Number(emaId) || emaId,
        }),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      closeNewMachineForm();
      await refreshMachineCards({ silent: true, preserveMessage: true });
      setMsg('Máquina creada.');
    } catch (err) {
      setMsg(userMsg(err.message));
    } finally {
      setMachineCreateSaving(false);
    }
  }

  async function updateMachineCardStatus(row, nextEmaId) {
    const maqId = row?.MAQ_ID ?? row?.maq_id;
    const currentEmaId = row?.EMA_ID ?? row?.ema_id;
    const nextId = String(nextEmaId ?? '').trim();
    if (maqId == null || String(maqId).trim() === '' || !nextId || String(currentEmaId ?? '') === nextId) return;
    setMachineStatusSavingId(String(maqId));
    setMachineStatusMenuId(null);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/maquina/${encodeURIComponent(String(maqId))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ EMA_ID: Number(nextId) || nextId }),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setCatalogOptions((prev) => {
        const current = Array.isArray(prev.maquina) ? prev.maquina : [];
        if (!current.length) return prev;
        return {
          ...prev,
          maquina: current.map((item) => (
            String(item.MAQ_ID ?? item.maq_id) === String(maqId) ? { ...item, ...json } : item
          )),
        };
      });
      await refreshMachineCards({ silent: true, preserveMessage: true });
      setMsg('Estado de máquina actualizado.');
    } catch (err) {
      setMsg(userMsg(err.message));
    } finally {
      setMachineStatusSavingId(null);
    }
  }

  function openMachineTransactions(row) {
    const detalleEntity = findMonthlyEntity('detalle-maquina-ticket');
    const maqId = row?.MAQ_ID ?? row?.maq_id;
    if (!detalleEntity || maqId == null || String(maqId).trim() === '') return;
    setMonthlyWorkspaceView('entity');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setRows([]);
    setEntity(detalleEntity);
    setEditId(null);
    setForm(emptyForm(detalleEntity.fields));
    setMsg('');
    setDetalleMaqTicketFilter(emptyDetalleMaqTicketFilter);
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    p.delete('ds_maq_id');
    p.delete('rma_maq_id');
    p.delete('rem_maq_id');
    p.set('dmt_maq_id', String(maqId).trim());
    setSearchParams(p, { replace: true });
  }

  function openMachineBalance(row) {
    const saldoEntity = findMonthlyEntity('detalle-saldo');
    const maqId = row?.MAQ_ID ?? row?.maq_id;
    if (!saldoEntity || maqId == null || String(maqId).trim() === '') return;
    setMonthlyWorkspaceView('entity');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setRows([]);
    setEntity(saldoEntity);
    setEditId(null);
    setForm(emptyForm(saldoEntity.fields));
    setMsg('');
    setDetalleSaldoMaqFilter({ maq: String(maqId).trim() });
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_maq_id');
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    p.delete('rma_maq_id');
    p.delete('rem_maq_id');
    p.set('ds_maq_id', String(maqId).trim());
    setSearchParams(p, { replace: true });
  }

  function openMachineRecharges(row) {
    const recargaEntity = findMonthlyEntity('recargo-maquina');
    const maqId = row?.MAQ_ID ?? row?.maq_id;
    if (!recargaEntity || maqId == null || String(maqId).trim() === '') return;
    setMonthlyWorkspaceView('entity');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setRows([]);
    setEntity(recargaEntity);
    setEditId(null);
    setForm(emptyForm(recargaEntity.fields));
    setMsg('');
    setRecargoMaqFilter({ maq: String(maqId).trim() });
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_maq_id');
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    p.delete('ds_maq_id');
    p.delete('rem_maq_id');
    p.set('rma_maq_id', String(maqId).trim());
    setSearchParams(p, { replace: true });
  }

  function openMachineMaintenance(row) {
    const mantenimientoEntity = findMonthlyEntity('registro-mantenimiento');
    const maqId = row?.MAQ_ID ?? row?.maq_id;
    if (!mantenimientoEntity || maqId == null || String(maqId).trim() === '') return;
    const nextForm = {
      ...emptyForm(mantenimientoEntity.fields),
      MAQ_ID: String(maqId).trim(),
      REM_MANTENIMIENTO_FECHA: toDateTimeLocalInput(new Date()),
    };
    setMonthlyWorkspaceView('entity');
    setMonthlySelectedClient(null);
    setMonthlySelectedVehicle(null);
    setExpandedClientRowId(null);
    setRows([]);
    setEntity(mantenimientoEntity);
    setEditId('__new__');
    setForm(nextForm);
    setMsg('');
    const p = new URLSearchParams(searchParams);
    p.delete('dmt_maq_id');
    p.delete('dmt_q');
    p.delete('dmt_desde');
    p.delete('dmt_hasta');
    p.delete('dmt_tx');
    p.delete('ds_maq_id');
    p.delete('rma_maq_id');
    p.set('rem_maq_id', String(maqId).trim());
    setSearchParams(p, { replace: true });
  }

  async function quickRecargarDetalleSaldo(row) {
    const maqId = row?.MAQ_ID;
    const sdiId = row?.SDI_ID;
    if (maqId == null || sdiId == null) {
      setMsg('No se pudo identificar máquina o denominación para recargar.');
      return;
    }
    const tipoSaldo = String(row?.SDI_TIPO ?? `SDI ${sdiId}`).trim();
    const input = window.prompt(`¿Cuántos billetes deseas agregar para ${tipoSaldo}?`, '0');
    if (input == null) return;
    const qty = Number(String(input).trim());
    if (!Number.isFinite(qty) || qty <= 0) {
      setMsg('Ingresa una cantidad válida mayor a 0.');
      return;
    }
    const cantidad = Math.floor(qty);
    if (cantidad <= 0) {
      setMsg('La cantidad debe ser un número entero mayor a 0.');
      return;
    }
    try {
      setMsg('');
      const descripcion = `Se recarga la máquina con ${cantidad} billetes de ${tipoSaldo}`;
      const payload = {
        MAQ_ID: maqId,
        RMA_MANTENIMIENTO_FECHA: new Date().toISOString(),
        RMA_DESCRIPCION: descripcion,
        RECARGA_DETALLE_SALDO: [
          { SDI_ID: sdiId, DSA_CANTIDAD: cantidad },
        ],
      };
      const res = await fetch(`${API_BASE}/recargo-maquina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json?.error || json?.message || res.statusText);
      setMsg('Recarga aplicada y registrada en Recargo Máquina.');
      await load();
    } catch (e) {
      setMsg(userMsg(e.message));
    }
  }

  async function save(e) {
    e.preventDefault(); setMsg('');
    const isEdit = editId != null && editId !== '__new__';
    if (!isEdit && entity?.ops?.c === false) {
      setMsg(`No se permite crear registros en ${entity?.label || 'esta entidad'}.`);
      cancelEdit();
      return;
    }
    const fieldsToUse =
      isEdit && (entity.updateFields || entity.readOnlyOnUpdate)
        ? (() => {
            const updateKeys = Array.from(
              new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
            );
            return entity.fields.filter(f => f.k === entity.id || updateKeys.includes(f.k));
          })()
        : entity.fields.filter((f) =>
          !(isEdit && f.createOnly)
          && !(editId === '__new__' && shouldHideFieldOnCreate(entity?.key, f.k))
          && !shouldHideFieldForCurrentForm(entity?.key, f.k, form, editId === '__new__')
        );
    const payload = preparePayload(fieldsToUse, form);
    if (entity.key === 'registro-mantenimiento') {
      if (isEdit) {
        payload.REM_DESCRIPCION = String(form.REM_DESCRIPCION ?? '').trim() || null;
      } else {
        const machine = findMachineById(catalogOptions, form?.MAQ_ID);
        if (!machine) {
          setMsg('Selecciona una máquina válida para registrar el mantenimiento.');
          return;
        }
        const expectedMovement = getMaintenanceMovementForMachine(machine);
        if (!expectedMovement) {
          const estado = String(machine.EMA_ESTADO ?? 'Sin estado').trim();
          setMsg(`La máquina seleccionada está ${estado} y no admite movimientos de mantenimiento.`);
          return;
        }
        const mov = String(form.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase();
        if (!mov) {
          setMsg('Selecciona una máquina para definir automáticamente el movimiento.');
          return;
        }
        if (!['INICIO', 'FINALIZACION'].includes(mov)) {
          setMsg('El movimiento de mantenimiento no es válido.');
          return;
        }
        if (mov !== expectedMovement) {
          const estado = String(machine.EMA_ESTADO ?? 'Sin estado').trim();
          setMsg(`La máquina está ${estado}, por lo que el movimiento debe ser ${expectedMovement === 'INICIO' ? 'Inicio' : 'Finalización'}.`);
          return;
        }
        payload.REM_TIPO_MOVIMIENTO = mov;
        if (mov === 'FINALIZACION') {
          const estadoFinal = String(form.REM_ESTADO_RESULTANTE_EMA_ID ?? '').trim();
          if (!estadoFinal) {
            setMsg('Selecciona el estado final de la máquina para cerrar el mantenimiento.');
            return;
          }
          payload.REM_ESTADO_RESULTANTE_EMA_ID = Number(estadoFinal) || estadoFinal;
        } else {
          payload.REM_ESTADO_RESULTANTE_EMA_ID = null;
        }
      }
    }
    if (entity.key === 'maquina') {
      if (isMachineStatusMaintenanceById(catalogOptions, form?.EMA_ID)) {
        setMsg('El estado Mantenimiento solo debe asignarse desde Reg. Mantenimiento.');
        return;
      }
    }
    if (entity.key === 'membresia') {
      if (isEdit) {
        const espId = String(form.ESP_ID ?? '').trim();
        if (!espId) {
          setMsg('Selecciona el espacio asignado.');
          return;
        }
        payload.ESP_ID = Number(espId) || espId;
        payload.ESP_UBICACION = String(form.ESP_UBICACION ?? '').trim() || null;
        delete payload.MEM_ID;
      } else {
        const placa = String(
          isMonthlyVehicleMembershipView
            ? (monthlySelectedVehicle?.VEH_PLACA ?? form.MEM_VEH_PLACA ?? '')
            : (form.MEM_VEH_PLACA ?? ''),
        ).trim();
        if (!placa) {
          setMsg('Indica la placa del vehículo.');
          return;
        }
        let vehiculoPlaca = null;
        let vehId;
        try {
          vehiculoPlaca = await resolveVehiculoByPlaca(placa);
          vehId = vehiculoPlaca?.VEH_ID ?? vehiculoPlaca?.veh_id ?? null;
        } catch (err) {
          setMsg('Error al buscar el vehículo: ' + err.message);
          return;
        }
        if (vehId == null || String(vehId).trim() === '') {
          setMsg('No existe un vehículo registrado con esa placa.');
          return;
        }
        if (
          isMonthlyVehicleMembershipView &&
          monthlySelectedClient?.CLI_ID != null &&
          String(vehiculoPlaca?.CLI_ID ?? vehiculoPlaca?.cli_id ?? '') !== String(monthlySelectedClient.CLI_ID)
        ) {
          setMsg('La placa indicada no pertenece al cliente seleccionado.');
          return;
        }
        if (
          isMonthlyVehicleMembershipView &&
          monthlySelectedVehicle?.VEH_ID != null &&
          String(vehId ?? '') !== String(monthlySelectedVehicle.VEH_ID)
        ) {
          setMsg('La membresía debe activarse sobre el vehículo seleccionado.');
          return;
        }
        payload.VEH_ID = Number(vehId) || vehId;
        const tmeId = String(form.TME_ID ?? '').trim();
        const inicio = String(form.MEM_FECHA_INICIO ?? '').trim();
        const tipos = catalogOptions?.['tipo-membresia'] || [];
        const tipo = tipos.find((x) => String(x.TME_ID) === tmeId);
        const vencEsperado = calcMembresiaVencimientoInput(inicio, Number(tipo?.TME_DURACION));
        if (!vencEsperado) {
          setMsg('No se pudo calcular la fecha de vencimiento según la duración del tipo de membresía.');
          return;
        }
        payload.MEM_FECHA_VENCIMIENTO = new Date(vencEsperado).toISOString();
      }
    }
    if (entity.key === 'bitacora-incidente-vehiculo' && !isEdit) {
      const placa = String(form.VEH_ID ?? '').trim();
      if (!placa) {
        setMsg('Indica la placa del vehículo.');
        return;
      }
      let vehId;
      try {
        vehId = await resolveVehiculoIdByPlaca(placa);
      } catch (err) {
        setMsg('Error al buscar el vehículo: ' + err.message);
        return;
      }
      if (vehId == null || String(vehId).trim() === '') {
        setMsg('No existe un vehículo registrado con esa placa.');
        return;
      }
      payload.VEH_ID = Number(vehId) || vehId;
    }
    if (entity.key === 'alerta' && isEdit) {
      const hasFechaAtencion = !!payload.ALE_FECHA_ATENCION;
      if (!hasFechaAtencion) {
        if (payload.ALE_USU_ID_RESOLVIO != null || String(payload.ALE_DESCRIPCION_SOLUCION || '').trim()) {
          setMsg('Primero define la fecha de atención para asignar Persona a cargo o Desc. Solución.');
          return;
        }
        payload.ALE_USU_ID_RESOLVIO = null;
        payload.ALE_DESCRIPCION_SOLUCION = null;
      } else if (!sessionIsFullAdmin && sessionUserId != null && String(sessionUserId).trim() !== '') {
        payload.ALE_USU_ID_RESOLVIO = sessionUserId;
      }
    }
    if (!isEdit && entity?.key === 'alerta') delete payload.ALE_ID;
    if (!isEdit && entity?.key === 'ticket') {
      const placa = String(form.VEH_ID ?? '').trim();
      if (!placa) {
        setMsg('Indica la placa del vehículo.');
        return;
      }
      let vehId;
      try {
        vehId = await resolveOrCreateVehiculoIdByPlacaForTicket(placa);
      } catch (err) {
        setMsg('Error al resolver/crear el vehículo por placa: ' + err.message);
        return;
      }
      payload.VEH_ID = Number(vehId) || vehId;
      delete payload.TIC_ID;
      delete payload.TIC_CODIGO;
      delete payload.TIC_FECHA_HORA_SALIDA;
    }
    if (
      entity.key === 'ticket'
      && isEdit
      && sessionUserId != null
      && String(sessionUserId).trim() !== ''
    ) {
      payload.USU_ID_BITACORA_EXTRAVIADO = sessionUserId;
    }
    if (
      entity.key === 'bitacora-incidente-vehiculo' &&
      isEdit &&
      sessionUserId != null &&
      String(sessionUserId).trim() !== ''
    ) {
      const tieneFechaResolucion =
        payload.BIV_FECHA_RESOLUCION != null &&
        String(payload.BIV_FECHA_RESOLUCION).trim() !== '';
      payload.BIV_RESUELTO = tieneFechaResolucion ? 1 : 0;
      if (tieneFechaResolucion && !sessionIsFullAdmin) {
        payload.USU_ID = sessionUserId;
      } else if (tieneFechaResolucion && (payload.USU_ID == null || String(payload.USU_ID).trim() === '')) {
        payload.USU_ID = sessionUserId;
      }
    }
    if (entity.key === 'vehiculo' && sectionPath === 'clientes-mensuales') {
      if (isMonthlyClientVehicleView && monthlySelectedClient?.CLI_ID != null) {
        payload.CLI_ID = Number(monthlySelectedClient.CLI_ID) || monthlySelectedClient.CLI_ID;
      }
      const cli = payload.CLI_ID;
      if (cli == null || String(cli).trim() === '') {
        setMsg(
          'Indica el CLI_ID del cliente. En Clientes mensuales el vehículo debe quedar vinculado a un cliente para listarse en esta sección.',
        );
        return;
      }
    }
    if (entity.key === 'vehiculo') {
      const cliRaw = payload.CLI_ID;
      if (cliRaw == null || String(cliRaw).trim() === '') {
        payload.CLI_ID = null;
      } else {
        const cliIdNum = Number(String(cliRaw).trim());
        if (!Number.isFinite(cliIdNum) || cliIdNum <= 0) {
          setMsg('Cliente ID debe ser un número válido.');
          return;
        }
        payload.CLI_ID = cliIdNum;
      }
    }
    if (
      entity.key === 'usuario' &&
      isEdit &&
      isCurrentSessionUser(editId, sessionUserId) &&
      Number(payload.USU_ACTIVO ?? form?.USU_ACTIVO ?? 1) !== 1
    ) {
      setMsg('No puedes desactivar la cuenta con la que tienes la sesión actual.');
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/${entity.key}${isEdit ? '/' + editId : ''}`,
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      const json = await parseJsonSafe(res);
      if (!res.ok) {
        if (
          entity?.key === 'membresia' &&
          json.code === 'VEH_SIN_CLIENTE' &&
          json.VEH_ID != null
        ) {
          setVehClienteModal({ VEH_ID: json.VEH_ID });
        }
        throw new Error(json.error || json.message || res.statusText);
      }
      let okMsg = isEdit ? 'Actualizado.' : 'Creado.';
      if (
        entity.key === 'membresia'
        && isMonthlyVehicleMembershipView
        && !isEdit
      ) {
        okMsg = 'Membresía activada para el vehículo seleccionado.';
      }
      if (
        entity.key === 'vehiculo'
        && sectionPath === 'tickets-vehiculos'
        && isEdit
        && payload.CLI_ID != null
      ) {
        okMsg = 'Vehículo actualizado y vinculado a cliente. La sección donde aparece depende de si el cliente es esporádico o mensual.';
      }
      if (json.warning) okMsg += ' — ' + json.warning;
      setMsg(okMsg);
      if (entity.key === 'registro-mantenimiento') {
        await refreshCatalogOptionsForEntity(entity);
      }
      cancelEdit();
      await load();
    } catch (err) { setMsg(userMsg(err.message)); }
  }

  async function assignClienteAVehiculoModal() {
    const vehId = vehClienteModal?.VEH_ID;
    if (vehId == null) return;
    const cliRaw = window.prompt('Ingrese el CLI_ID del cliente a vincular a este vehículo:');
    if (cliRaw == null) return;
    const cliId = Number(String(cliRaw).trim());
    if (!cliId || Number.isNaN(cliId)) {
      setMsg('Error: CLI_ID no válido');
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/vehiculo/${vehId}`);
      const v = await parseJsonSafe(r);
      if (!r.ok) throw new Error(v.error || v.message || 'No se pudo cargar el vehículo');
      const res = await fetch(`${API_BASE}/vehiculo/${vehId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, CLI_ID: cliId }),
      });
      const j = await parseJsonSafe(res);
      if (!res.ok) throw new Error(j.error || j.message || res.statusText);
      setVehClienteModal(null);
      setMsg('Cliente asignado al vehículo. Puede guardar la membresía de nuevo.');
    } catch (e) {
      setMsg(userMsg(e.message));
    }
  }

  async function del(id) {
    try {
      const res = await fetch(`${API_BASE}/${entity.key}/${id}`, { method: 'DELETE' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg('Registro eliminado correctamente.');
      load();
    } catch (err) {
      const txt = userMsg(err.message || '');
      if (/ORA-20001|ORA-02292|siendo usado/i.test(String(err.message || ''))) {
        setMsg('No se puede eliminar porque este registro está siendo usado por otro.');
      } else {
        setMsg(txt);
      }
    }
  }

  function requestDelete(id) {
    setConfirmDialog({
      title: `Eliminar ${entity.label}`,
      message: '¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, eliminar',
      onConfirm: () => {
        setConfirmDialog(null);
        del(id);
      },
    });
  }

  async function deactivateCliente(row) {
    return setClienteActivo(row, false);
  }

  async function activateCliente(row) {
    return setClienteActivo(row, true);
  }

  async function setClienteActivo(row, shouldActivate) {
    try {
      const payload = { ...row, CLI_ACTIVO: shouldActivate ? 1 : 0 };
      const res = await fetch(`${API_BASE}/cliente/${row.CLI_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg(shouldActivate ? 'Cliente activado.' : 'Cliente desactivado.');
      load();
    } catch (err) {
      setMsg(userMsg(err.message));
    }
  }

  async function deactivateUsuario(row) {
    try {
      if (isCurrentSessionUser(row?.USU_ID, sessionUserId)) {
        setMsg('No puedes desactivar la cuenta con la que tienes la sesión actual.');
        return;
      }
      const payload = { ...row, USU_ACTIVO: 0 };
      const res = await fetch(`${API_BASE}/usuario/${row.USU_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg('Usuario desactivado.');
      load();
    } catch (err) {
      setMsg(userMsg(err.message));
    }
  }

  function downloadTag(row) {
    const id = row?.MEM_ID ?? row?.[entity.id];
    if (!id) return;
    window.open(`${API_BASE}/membresia/${id}/tag.pdf`, '_blank');
  }

  function downloadTicketEntradaPdf(row) {
    const id = row?.TIC_ID ?? row?.[entity.id];
    if (!id) return;
    window.open(`${API_BASE}/ticket/${id}/entrada.pdf`, '_blank');
  }

  function downloadTicketComprobantePdf(row) {
    const id = row?.TIC_ID ?? row?.[entity.id];
    if (!id) return;
    window.open(`${API_BASE}/ticket/${id}/comprobante.pdf`, '_blank');
  }

  const isNewRecord = editId === '__new__';
  const formFields = entity
    ? !isNewRecord && editId && (entity.updateFields || entity.readOnlyOnUpdate)
        ? (() => {
            const updateKeys = Array.from(
              new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
            );
            return entity.fields.filter(f => f.k === entity.id || updateKeys.includes(f.k));
          })()
        : entity.fields.filter((f) => !(editId && !isNewRecord && f.createOnly))
    : [];

  const visibleFormFields =
    isNewRecord
      ? formFields.filter((f) => {
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
        })
      : formFields.filter((f) => {
          if (isMonthlyClientVehicleView && entity?.key === 'vehiculo' && f.k === 'CLI_ID') {
            return false;
          }
          if (isMonthlyVehicleMembershipView && entity?.key === 'membresia' && f.k === 'MEM_VEH_PLACA') {
            return false;
          }
          return !shouldHideFieldForCurrentForm(entity?.key, f.k, form, isNewRecord);
        });

  const listContextHint = useMemo(() => {
    if (!sectionPath || !entity?.key) return null;
    return getAdminListContextHelpModel(sectionPath, entity.key);
  }, [sectionPath, entity?.key]);
  const monthlySelectedClientName = clienteNombreCompleto(monthlySelectedClient) || 'Cliente seleccionado';
  const monthlySelectedVehiclePlate = String(monthlySelectedVehicle?.VEH_PLACA ?? '').trim() || 'Vehículo seleccionado';
  const monthlySelectedVehicleType = labelTipoVehiculo(monthlySelectedVehicle, catalogOptions);
  const monthlySelectedVehicleStatus = getVehicleMembershipStatus(monthlySelectedVehicle, catalogOptions)?.label || '—';
  const displayRows = useMemo(() => {
    if (isMonthlyClientVehicleView && monthlySelectedClient?.CLI_ID != null) {
      return rows.filter((row) => String(row.CLI_ID ?? '') === String(monthlySelectedClient.CLI_ID));
    }
    if (isMonthlyVehicleMembershipView) {
      const selectedVehId = monthlySelectedVehicle?.VEH_ID;
      const selectedVehPlaca = normPlacaVehiculo(monthlySelectedVehicle?.VEH_PLACA ?? '');
      return rows.filter((row) => {
        const sameVehId =
          selectedVehId != null
          && String(row.VEH_ID ?? row.veh_id ?? '') === String(selectedVehId);
        const samePlaca =
          selectedVehPlaca !== ''
          && normPlacaVehiculo(row.VEH_PLACA ?? row.veh_placa ?? '') === selectedVehPlaca;
        return sameVehId || samePlaca;
      });
    }
    return rows;
  }, [
    isMonthlyClientVehicleView,
    isMonthlyVehicleMembershipView,
    monthlySelectedClient?.CLI_ID,
    monthlySelectedVehicle?.VEH_ID,
    monthlySelectedVehicle?.VEH_PLACA,
    rows,
  ]);
  const scopedRemMaqId = entity?.key === 'registro-mantenimiento'
    ? String(searchParams.get('rem_maq_id') || '').trim()
    : '';
  const displayColumns = useMemo(() => {
    if (!entity?.key || displayRows.length === 0) return [];
    return Object.keys(displayRows[0]).filter((columnKey) => !shouldHideTableColumn(entity.key, columnKey, {
      compactMonthlyClientTable: isMonthlyCompactClientTable,
      isMonthlyClientVehicleView,
      isMonthlyVehicleMembershipView,
      isScopedMachineMaintenanceView: Boolean(scopedRemMaqId),
    }));
  }, [
    displayRows,
    entity?.key,
    isMonthlyClientVehicleView,
    isMonthlyCompactClientTable,
    isMonthlyVehicleMembershipView,
    scopedRemMaqId,
  ]);
  const showTableActions =
    !!entity
    && (entity.ops.u || entity.ops.d || entity.key === 'membresia' || entity.key === 'ticket' || entity.key === 'detalle-saldo');
  const scopedDmtMaqId = entity?.key === 'detalle-maquina-ticket'
    ? String(searchParams.get('dmt_maq_id') || '').trim()
    : '';
  const scopedMachineActionMaqId = entity?.key === 'detalle-saldo'
    ? String(searchParams.get('ds_maq_id') || '').trim()
    : entity?.key === 'recargo-maquina'
      ? String(searchParams.get('rma_maq_id') || '').trim()
      : entity?.key === 'registro-mantenimiento'
        ? String(searchParams.get('rem_maq_id') || '').trim()
        : scopedDmtMaqId;
  const scopedMachineAction = scopedMachineActionMaqId
    ? findMachineById(catalogOptions, scopedMachineActionMaqId)
      || machineCardsRows.find((row) => String(row.MAQ_ID ?? row.maq_id) === scopedMachineActionMaqId)
    : null;
  const scopedMachineActionLabel = scopedMachineActionMaqId
    ? String(scopedMachineAction?.MAQ_CODIGO ?? scopedMachineAction?.maq_codigo ?? '').trim()
      || labelMaquina({ MAQ_ID: scopedMachineActionMaqId }, catalogOptions)
    : '';

  return (
    <div className="crudx-shell">

      {/* Tabs (demo completo; oculto en módulos del panel admin) */}
      {!filteredEntities && (
        <div className="crudx-tabs">
          {Object.entries(SECTIONS).map(([k, s]) => (
            <button
              key={k}
              onClick={() => selectSection(k)}
              className={`crudx-tab-btn${section === k ? ' crudx-tab-btn--active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="crudx-main">
        {isAdminCardWorkspace && monthlyWorkspaceView !== 'cards' ? (
          <div className="crudx-monthly-nav">
            <div className="crudx-monthly-nav__text">
              <span className="crudx-monthly-nav__eyebrow">{adminSectionTitle}</span>
              <strong>
                {scopedDmtMaqId
                  ? `Transacciones de ${scopedMachineActionLabel || `MAQ_ID ${scopedDmtMaqId}`}`
                : entity?.key === 'detalle-saldo' && scopedMachineActionMaqId
                  ? `Saldo de ${scopedMachineActionLabel || `MAQ_ID ${scopedMachineActionMaqId}`}`
                : entity?.key === 'recargo-maquina' && scopedMachineActionMaqId
                  ? `Recargas de ${scopedMachineActionLabel || `MAQ_ID ${scopedMachineActionMaqId}`}`
                : entity?.key === 'registro-mantenimiento' && scopedMachineActionMaqId
                  ? `Mantenimiento de ${scopedMachineActionLabel || `MAQ_ID ${scopedMachineActionMaqId}`}`
                : isMonthlyVehicleMembershipView
                  ? `Membresías de ${monthlySelectedVehiclePlate}`
                  : isMonthlyClientVehicleView
                    ? `Vehículos de ${monthlySelectedClientName}`
                  : entity?.label || 'Seccion'}
              </strong>
            </div>
            <div className="crudx-monthly-nav__actions">
              {isMonthlyVehicleMembershipView ? (
                <button type="button" className="crudx-btn-secondary" onClick={returnToMonthlyClientVehicles}>
                  <BtnContent icon={IconBack}>Volver a vehículos</BtnContent>
                </button>
              ) : null}
              {isMonthlyClientVehicleView ? (
                <button type="button" className="crudx-btn-secondary" onClick={returnToMonthlyClients}>
                  <BtnContent icon={IconBack}>Volver a clientes</BtnContent>
                </button>
              ) : null}
              <button type="button" className="crudx-btn-secondary" onClick={resetMonthlyWorkspaceToCards}>
                <BtnContent icon={IconBack}>Volver a módulos</BtnContent>
              </button>
            </div>
          </div>
        ) : null}

        {showMachineCards ? (
          <>
            <div className="crudx-machine-cardbar">
              <div>
                <span>Máquinas registradas</span>
                <strong>{machineCardsRows.length} equipos</strong>
              </div>
              <button type="button" className="crudx-entity-card__action crudx-entity-card__action--primary" onClick={openNewMachineForm}>
                <BtnContent icon={IconPlus}>Nueva máquina</BtnContent>
              </button>
            </div>
            {msg ? (
              <div className={`crudx-machine-toast ${isCrudErrorMessage(msg) ? 'crudx-machine-toast--error' : 'crudx-machine-toast--ok'}`}>
                <span className="crudx-machine-toast__icon" aria-hidden="true">
                  {isCrudErrorMessage(msg) ? '!' : '✓'}
                </span>
                <div>
                  <strong>{isCrudErrorMessage(msg) ? 'No se pudo completar' : 'Listo'}</strong>
                  <p>{isCrudErrorMessage(msg) ? userMsg(msg) : msg}</p>
                </div>
              </div>
            ) : null}
            {machineCreateOpen ? (
              <form className="crudx-machine-create" onSubmit={submitNewMachine}>
                <div className="crudx-machine-create__head">
                  <div>
                    <span>Nueva máquina</span>
                    <strong>Alta directa en tarjetas</strong>
                  </div>
                  <button type="button" className="crudx-btn-secondary crudx-btn-xs" onClick={closeNewMachineForm}>
                    Cerrar
                  </button>
                </div>
                <div className="crudx-machine-create__grid">
                  <label className="reporte-inc-field">
                    <span>Código</span>
                    <input
                      value={machineCreateForm.MAQ_CODIGO}
                      onChange={(event) => setMachineCreateForm((prev) => ({
                        ...prev,
                        MAQ_CODIGO: sanitizeFieldValue('MAQ_CODIGO', event.target.value),
                      }))}
                      placeholder={getFieldPlaceholder('MAQ_CODIGO')}
                      required
                    />
                  </label>
                  <label className="reporte-inc-field">
                    <span>Tipo de máquina</span>
                    <select
                      value={machineCreateForm.TMA_ID}
                      onChange={(event) => setMachineCreateForm((prev) => ({ ...prev, TMA_ID: event.target.value }))}
                      required
                    >
                      <option value="">Selecciona tipo</option>
                      {machineCardsCatalogs.tipos.map((tipo) => (
                        <option key={tipo.TMA_ID} value={String(tipo.TMA_ID)}>
                          {tipo.TMA_TIPO}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="reporte-inc-field">
                    <span>Estado inicial</span>
                    <select value={machineCreateForm.EMA_ID} disabled>
                      <option value={machineCreateForm.EMA_ID}>
                        {
                          machineCardsCatalogs.estados.find((estado) => String(estado.EMA_ID) === String(machineCreateForm.EMA_ID))?.EMA_ESTADO
                          || 'Inoperativa'
                        }
                      </option>
                    </select>
                  </label>
                </div>
                <div className="crudx-machine-create__actions">
                  <button type="submit" className="admin-btn-primary" disabled={machineCreateSaving}>
                    {machineCreateSaving ? 'Creando...' : 'Crear máquina'}
                  </button>
                  <button type="button" className="admin-btn-ghost" onClick={closeNewMachineForm}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}
            <div className="crudx-machine-carddeck" aria-label="Maquinas registradas">
              {machineCardsLoading ? (
                <p className="crudx-empty crudx-empty--carddeck">Cargando maquinas...</p>
              ) : null}
              {!machineCardsLoading && machineCardsRows.length === 0 ? (
                <p className="crudx-empty crudx-empty--carddeck">No hay maquinas registradas.</p>
              ) : null}
              {!machineCardsLoading && machineCardsRows.length > 0 ? (
                [
                  { variant: 'entry', label: 'Entrada' },
                  { variant: 'cash', label: 'Cobro' },
                  { variant: 'exit', label: 'Salida' },
                ].map(({ variant, label }) => {
                  const colRows = machineCardsRows
                    .filter((row) => getMachineCardInfo(row).variant === variant)
                    .sort((a, b) => String(a.MAQ_CODIGO ?? a.maq_codigo ?? '').localeCompare(String(b.MAQ_CODIGO ?? b.maq_codigo ?? ''), 'es'));
                  return (
                    <section key={variant} className={`crudx-machine-row crudx-machine-row--${variant}`}>
                      <div className="crudx-machine-row__header">
                        <span className={`crudx-machine-row__title crudx-machine-row__title--${variant}`}>{label}</span>
                        <span className="crudx-machine-row__count">{colRows.length} máquina{colRows.length === 1 ? '' : 's'}</span>
                      </div>
                      {colRows.length === 0 ? (
                        <p className="crudx-empty crudx-empty--col">Sin máquinas de este tipo.</p>
                      ) : (
                        <div className="crudx-machine-row__track" aria-label={`Máquinas de ${label}`}>
                          {colRows.map((row) => {
                        const info = getMachineCardInfo(row);
                        const machineStatusBadge = getMachineStatusBadge(info.estado);
                        const maqId = row.MAQ_ID ?? row.maq_id;
                        const codigo = String(row.MAQ_CODIGO ?? row.maq_codigo ?? `Maquina ${maqId}`).trim();
                        const currentEmaId = row.EMA_ID ?? row.ema_id;
                        const currentStatusRow = machineCardsCatalogs.estados.find((estado) => (
                          String(estado.EMA_ID ?? estado.ema_id) === String(currentEmaId ?? '')
                        ));
                        const manualStatusOptionsBase = filterManualMachineStatuses(machineCardsCatalogs.estados);
                        const manualStatusOptions = currentStatusRow
                          && !manualStatusOptionsBase.some((estado) => String(estado.EMA_ID ?? estado.ema_id) === String(currentEmaId ?? ''))
                          ? [currentStatusRow, ...manualStatusOptionsBase]
                          : manualStatusOptionsBase;
                        const statusSaving = String(machineStatusSavingId ?? '') === String(maqId ?? '');
                        const statusLocked = isMachineStatusMaintenance(info.estado);
                        const statusMenuOpen = String(machineStatusMenuId ?? '') === String(maqId ?? '');
                        return (
                          <article
                            key={String(maqId)}
                            className={`crudx-machine-card crudx-machine-card--${info.variant} ${getMachineStatusStripeClass(machineStatusBadge.tone)}`}
                          >
                            <div className="crudx-machine-card__head">
                              <span className="crudx-machine-card__eyebrow">{info.role}</span>
                              <span className="crudx-machine-card__icon" aria-hidden="true">
                                {getEntityIcon('maquina')}
                              </span>
                            </div>
                            <div>
                              <div className="crudx-machine-card__titleline">
                                <h3>{codigo}</h3>
                                <span>ID {maqId}</span>
                              </div>
                              <p>{info.tipo}</p>
                            </div>
                            <div className="crudx-machine-card__meta">
                              <div className="crudx-machine-status-menu">
                                <button
                                  type="button"
                                  className={`crudx-machine-status-trigger crudx-machine-status-trigger--${machineStatusBadge.tone}`}
                                  onClick={() => {
                                    if (statusSaving || statusLocked) return;
                                    setMachineStatusMenuId((current) => (
                                      String(current ?? '') === String(maqId ?? '') ? null : String(maqId ?? '')
                                    ));
                                  }}
                                  disabled={statusSaving || statusLocked}
                                  aria-haspopup="listbox"
                                  aria-expanded={statusMenuOpen}
                                  aria-label={`Cambiar estado de ${codigo}`}
                                  title={statusLocked ? 'Finaliza el mantenimiento desde la acción Mantenimiento' : 'Cambiar estado de la máquina'}
                                >
                                  <span className="crudx-machine-card__status-visual">
                                    <span
                                      className={`crudx-machine-card__status-dot${machineStatusBadge.tone === 'success' ? ' crudx-machine-card__status-dot--pulse' : ''}`}
                                      aria-hidden="true"
                                    />
                                    <span>{statusSaving ? 'Actualizando...' : machineStatusBadge.label}</span>
                                  </span>
                                  <span className="crudx-machine-status-trigger__chevron" aria-hidden="true" />
                                </button>
                                {statusMenuOpen ? (
                                  <div className="crudx-machine-status-options" role="listbox" aria-label={`Estados disponibles para ${codigo}`}>
                                    {manualStatusOptions.map((estado) => {
                                      const value = String(estado.EMA_ID ?? estado.ema_id ?? '');
                                      if (!value) return null;
                                      const optionLabel = String(estado.EMA_ESTADO ?? estado.ema_estado ?? value);
                                      const optionBadge = getMachineStatusBadge(optionLabel);
                                      const isSelected = value === String(currentEmaId ?? '');
                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          role="option"
                                          aria-selected={isSelected}
                                          className={`crudx-machine-status-option${isSelected ? ' crudx-machine-status-option--selected' : ''}`}
                                          onClick={() => updateMachineCardStatus(row, value)}
                                        >
                                          <span className={`crudx-machine-status-option__dot crudx-machine-status-option__dot--${optionBadge.tone}`} />
                                          <span>{optionBadge.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="crudx-machine-card__actions" aria-label={`Acciones de ${codigo}`}>
                              <button
                                type="button"
                                className="crudx-machine-action"
                                onClick={() => openMachineTransactions(row)}
                              >
                                <BtnContent icon={IconTransaction}>Transacciones</BtnContent>
                              </button>
                              <button
                                type="button"
                                className="crudx-machine-action"
                                onClick={() => openMachineMaintenance(row)}
                              >
                                <BtnContent icon={IconMaintenance}>Mantenimiento</BtnContent>
                              </button>
                              {info.isCobro ? (
                                <>
                                  <button
                                    type="button"
                                    className="crudx-machine-action"
                                    onClick={() => openMachineRecharges(row)}
                                  >
                                    <BtnContent icon={IconRecharge}>Recargas</BtnContent>
                                  </button>
                                  <button
                                    type="button"
                                    className="crudx-machine-action crudx-machine-action--primary"
                                    onClick={() => openMachineBalance(row)}
                                  >
                                    <BtnContent icon={IconBalance}>Saldo</BtnContent>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </article>
                        );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })
              ) : null}
            </div>
            <div className="crudx-machine-support">
              <div className="crudx-machine-support__head">
                <span>Administracion de apoyo</span>
              </div>
              <div className="crudx-entity-carddeck crudx-machine-support-carddeck" aria-label="Tarjetas de apoyo de maquinas">
                {sectionEntities.filter((item) => item.key !== 'maquina').map((e) => {
                  const cardMeta = getEntityCardMeta(e.key);
                  const cardTraits = getEntityCardTraits(e);
                  const cardSummary = getAdminListContextHint(sectionPath, e.key);
                  return (
                    <article key={e.key} className={`crudx-entity-card crudx-entity-card--${cardMeta.tone}`}>
                      <div className="crudx-entity-card__glow" aria-hidden="true" />
                      <div className="crudx-entity-card__head">
                        <span className="crudx-entity-card__eyebrow">
                          <span className="crudx-entity-card__badge-inline">{cardMeta.badge}</span>
                          {' · '}
                          {cardMeta.eyebrow.toUpperCase()}
                        </span>
                        <span className="crudx-entity-card__icon" aria-hidden="true">
                          {getEntityIcon(e.key)}
                        </span>
                      </div>
                      <div className="crudx-entity-card__title">{e.label}</div>
                      <p className="crudx-entity-card__summary">{cardSummary}</p>
                      <div className="crudx-entity-card__traits" aria-label={`Acciones disponibles en ${e.label}`}>
                        {cardTraits.map((trait) => (
                          <span key={trait} className="crudx-entity-card__trait">{trait}</span>
                        ))}
                      </div>
                      <div className="crudx-entity-card__actions">
                        <button
                          type="button"
                          className="crudx-entity-card__action crudx-entity-card__action--primary"
                          onClick={() => selectEntity(e)}
                        >
                          Abrir →
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        ) : showAdminEntityCards ? (
          <div className="crudx-entity-carddeck" aria-label={`Secciones de ${adminSectionTitle}`}>
            {sectionEntities.map((e) => {
              const cardMeta = getEntityCardMeta(e.key);
              const cardTraits = getEntityCardTraits(e);
              const cardSummary = getAdminListContextHint(sectionPath, e.key);
              const isActiveCard = entity?.key === e.key;

              return (
                <article
                  key={e.key}
                  className={`crudx-entity-card crudx-entity-card--${cardMeta.tone}${isActiveCard ? ' crudx-entity-card--active' : ''}`}
                >
                  <div className="crudx-entity-card__glow" aria-hidden="true" />
                  <div className="crudx-entity-card__head">
                    <span className="crudx-entity-card__eyebrow">
                      <span className="crudx-entity-card__badge-inline">{cardMeta.badge}</span>
                      {' · '}
                      {cardMeta.eyebrow.toUpperCase()}
                    </span>
                    <span className="crudx-entity-card__icon" aria-hidden="true">
                      {getEntityIcon(e.key)}
                    </span>
                  </div>

                  <div className="crudx-entity-card__title">{e.label}</div>
                  <p className="crudx-entity-card__summary">{cardSummary}</p>

                  <div className="crudx-entity-card__traits" aria-label={`Acciones disponibles en ${e.label}`}>
                    {cardTraits.map((trait) => (
                      <span key={trait} className="crudx-entity-card__trait">
                        {trait}
                      </span>
                    ))}
                  </div>

                  <div className="crudx-entity-card__actions">
                    <button
                      type="button"
                      className="crudx-entity-card__action crudx-entity-card__action--primary"
                      onClick={() => selectEntity(e)}
                    >
                      Abrir →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !isAdminCardWorkspace ? (
          <div className="crudx-entity-chips">
            {sectionEntities.map((e) => (
              <button
                key={e.key}
                onClick={() => selectEntity(e)}
                className={`crudx-chip${entity?.key === e.key ? ' crudx-chip--active' : ''}`}
              >
                {e.label}
              </button>
            ))}
          </div>
        ) : null}

          {!entity && !showMachineCards && (
            <p className={`crudx-empty${showAdminEntityCards ? ' crudx-empty--carddeck' : ''}`}>
              {showAdminEntityCards
                ? 'Elige una tarjeta para abrir la seccion que quieras trabajar.'
                : 'Selecciona una entidad'}
            </p>
          )}

          {entity && (!isAdminCardWorkspace || monthlyWorkspaceView !== 'cards') && (
            <>
              <div className="crudx-toolbar">
                <div className="crudx-toolbar__title">
                  <strong>
                    {isMonthlyVehicleMembershipView
                      ? 'Membresías del vehículo'
                      : isMonthlyClientVehicleView
                        ? 'Vehículos del cliente'
                        : entity.label}
                  </strong>
                  {listContextHint ? (
                    <HelpHint
                      label={`Mostrar ayuda sobre ${entity.label}`}
                      title={`Guia de ${entity.label}`}
                    >
                      {renderAdminListContextHint(listContextHint)}
                    </HelpHint>
                  ) : null}
                </div>
                {!loading && displayRows.length > 0 ? (
                  <span className="crudx-msg" style={{ fontWeight: 500, color: '#475569' }}>
                    {displayRows.length} registro{displayRows.length === 1 ? '' : 's'}
                  </span>
                ) : null}
                {entity.ops.c && !editId && (
                  <button
                    onClick={
                      isMonthlyVehicleMembershipView
                        ? startNewMonthlyVehicleMembership
                        : isMonthlyClientVehicleView
                          ? startNewMonthlyClientVehicle
                          : () => {
                              const nextForm = emptyForm(entity.fields);
                              const remMaqId = entity.key === 'registro-mantenimiento'
                                ? String(searchParams.get('rem_maq_id') || '').trim()
                                : '';
                              if (remMaqId) {
                                nextForm.MAQ_ID = remMaqId;
                                nextForm.REM_MANTENIMIENTO_FECHA = toDateTimeLocalInput(new Date());
                              }
                              setEditId('__new__');
                              setForm(nextForm);
                            }
                    }
                    className="crudx-btn-secondary">
                    + Nuevo
                  </button>
                )}
                {msg && (
                  <span
                    className={
                      isCrudErrorMessage(msg) ? 'crudx-msg crudx-msg--error' : 'crudx-msg crudx-msg--ok'
                    }
                  >
                    {isCrudErrorMessage(msg) ? userMsg(msg) : msg}
                  </span>
                )}
              </div>

              {entity?.key === 'registro-mantenimiento' && scopedMachineActionMaqId ? (
                <div className="crudx-scoped-filter-note">
                  <span>Máquina</span>
                  <strong>{scopedMachineActionLabel || `MAQ_ID ${scopedMachineActionMaqId}`} · ID {scopedMachineActionMaqId}</strong>
                </div>
              ) : null}

              {isMonthlyClientVehicleView ? (
                <section className="crudx-monthly-client-head" aria-label="Cliente seleccionado">
                  <div>
                    <span className="crudx-monthly-client-head__eyebrow">Cliente seleccionado</span>
                    <h2>{monthlySelectedClientName}</h2>
                  </div>
                  <div className="crudx-monthly-client-head__meta">
                    <span>CLI_ID: {monthlySelectedClient?.CLI_ID ?? '-'}</span>
                    <span>DPI: {monthlySelectedClient?.CLI_DPI || '-'}</span>
                    <span>Correo: {monthlySelectedClient?.CLI_CORREO || '-'}</span>
                  </div>
                </section>
              ) : isMonthlyVehicleMembershipView ? (
                <section className="crudx-monthly-client-head" aria-label="Vehículo seleccionado">
                  <div>
                    <span className="crudx-monthly-client-head__eyebrow">Vehículo seleccionado</span>
                    <h2>{monthlySelectedVehiclePlate}</h2>
                  </div>
                  <div className="crudx-monthly-client-head__meta">
                    <span>Cliente: {monthlySelectedClientName}</span>
                    <span>Tipo: {monthlySelectedVehicleType || '—'}</span>
                    <span>Modelo: {monthlySelectedVehicle?.VEH_MODELO || '—'}</span>
                    <span>Color: {monthlySelectedVehicle?.VEH_COLOR || '—'}</span>
                    <span>Membresía: {monthlySelectedVehicleStatus && monthlySelectedVehicleStatus !== '—' ? monthlySelectedVehicleStatus : 'Pendiente de activar'}</span>
                  </div>
                </section>
              ) : null}

              {entity.key === 'bitacora-incidente-vehiculo' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyBivFilters}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Placa</span>
                    <input
                      className="admin-search-input crudx-admin-filter-input-compact"
                      type="search"
                      value={bivFilter.placa}
                      onChange={(e) => setBivFilter((f) => ({ ...f, placa: sanitizeSearchValue('placa', e.target.value) }))}
                      placeholder={getSearchPlaceholder('placa')}
                      aria-label="Filtrar por placa"
                    />
                  </label>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Estado</span>
                    <select
                      className="admin-search-select"
                      value={bivFilter.resuelto}
                      onChange={(e) => setBivFilter((f) => ({ ...f, resuelto: e.target.value }))}
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
                      value={bivFilter.desde}
                      max={TODAY}
                      onChange={(e) => setBivFilter((f) => ({ ...f, desde: clampDateYmd(e.target.value) }))}
                      aria-label="Fecha desde"
                    />
                  </label>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Hasta</span>
                    <input
                      className="admin-search-input"
                      type="date"
                      value={bivFilter.hasta}
                      max={TODAY}
                      onChange={(e) => setBivFilter((f) => ({ ...f, hasta: clampDateYmd(e.target.value) }))}
                      aria-label="Fecha hasta"
                    />
                  </label>
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      <BtnContent icon={IconSearch}>Buscar</BtnContent>
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearBivFilters}
                      disabled={loading}
                    >
                      <BtnContent icon={IconClear}>Limpiar</BtnContent>
                    </button>
                  </div>
                </form>
              ) : entity.key === 'alerta' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyAlertaFilters}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Estado</span>
                    <select
                      className="admin-search-select"
                      value={alertaFilter.eal}
                      onChange={(e) => setAlertaFilter((f) => ({ ...f, eal: e.target.value }))}
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
                      value={alertaFilter.tal}
                      onChange={(e) => setAlertaFilter((f) => ({ ...f, tal: e.target.value }))}
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
                      value={alertaFilter.maq}
                      onChange={(e) => setAlertaFilter((f) => ({ ...f, maq: e.target.value }))}
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
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      <BtnContent icon={IconSearch}>Buscar</BtnContent>
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearAlertaFilters}
                      disabled={loading}
                    >
                      <BtnContent icon={IconClear}>Limpiar</BtnContent>
                    </button>
                  </div>
                </form>
              ) : entity.key === 'detalle-saldo' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyDetalleSaldoMaqFilter}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Máquina de cobro</span>
                    <select
                      className="admin-search-select"
                      value={detalleSaldoMaqFilter.maq}
                      onChange={(e) => setDetalleSaldoMaqFilter((f) => ({ ...f, maq: e.target.value }))}
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
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      <BtnContent icon={IconSearch}>Buscar</BtnContent>
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearDetalleSaldoMaqFilter}
                      disabled={loading}
                    >
                      <BtnContent icon={IconClear}>Limpiar</BtnContent>
                    </button>
                  </div>
                </form>
              ) : entity.key === 'maquina' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyMaquinaFilters}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Tipo de máquina</span>
                    <select
                      className="admin-search-select"
                      value={maquinaFilter.tma}
                      onChange={(e) => setMaquinaFilter((f) => ({ ...f, tma: e.target.value }))}
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
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      <BtnContent icon={IconSearch}>Buscar</BtnContent>
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearMaquinaFilters}
                      disabled={loading}
                    >
                      <BtnContent icon={IconClear}>Limpiar</BtnContent>
                    </button>
                  </div>
                </form>
              ) : entity.key === 'recargo-maquina' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyRecargoMaqFilter}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Máquina de cobro</span>
                    <select
                      className="admin-search-select"
                      value={recargoMaqFilter.maq}
                      onChange={(e) => setRecargoMaqFilter((f) => ({ ...f, maq: e.target.value }))}
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
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      <BtnContent icon={IconSearch}>Buscar</BtnContent>
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearRecargoMaqFilter}
                      disabled={loading}
                    >
                      <BtnContent icon={IconClear}>Limpiar</BtnContent>
                    </button>
                  </div>
                </form>
              ) : entity.key === 'vehiculo' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyVehiculoFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={vehiculoFilter.q}
                        onChange={(e) => setVehiculoFilter((f) => ({ ...f, q: sanitizeSearchValue('placa', e.target.value) }))}
                        placeholder={getSearchPlaceholder('placa')}
                        autoComplete="off"
                        aria-label="Filtrar vehículos por placa"
                      />
                    </div>
                    <label className="crudx-ticket-search-estado">
                      <span className="crudx-ticket-search-estado-label">Tipo de vehículo</span>
                      <select
                        className="admin-search-select"
                        value={vehiculoFilter.tve}
                        onChange={(e) => setVehiculoFilter((f) => ({ ...f, tve: e.target.value }))}
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
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearVehiculoFilters}
                        disabled={loading}
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'ticket' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyTicketFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={ticketFilter.q}
                        onChange={(e) => setTicketFilter((f) => ({ ...f, q: sanitizeSearchValue('ticket', e.target.value) }))}
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
                        value={ticketFilter.eti}
                        onChange={(e) => setTicketFilter((f) => ({ ...f, eti: e.target.value }))}
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
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearTicketFilters}
                        disabled={loading}
                        title="Quitar búsqueda y filtros de la lista"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'cobro' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyCobroFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={cobroFilter.q}
                        onChange={(e) => setCobroFilter((f) => ({ ...f, q: sanitizeSearchValue('cobro', e.target.value) }))}
                        placeholder={getSearchPlaceholder('cobro')}
                        autoComplete="off"
                        aria-label="Buscar cobro por ticket ID o NIT / CF"
                      />
                    </div>
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearCobroFilters}
                        disabled={loading}
                        title="Quitar búsqueda de cobros"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'cliente' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyClienteFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={clienteFilter.q}
                        onChange={(e) => setClienteFilter((f) => ({ ...f, q: sanitizeSearchValue('cliente', e.target.value) }))}
                        placeholder={getSearchPlaceholder('cliente')}
                        autoComplete="off"
                        aria-label="Buscar cliente por nombre, apellido, nombre completo o DPI"
                      />
                    </div>
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearClienteFilters}
                        disabled={loading}
                        title="Quitar búsqueda de clientes"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'membresia' && !isMonthlyVehicleMembershipView ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyMembresiaFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={membresiaFilter.q}
                        onChange={(e) => setMembresiaFilter((f) => ({ ...f, q: sanitizeSearchValue('general', e.target.value) }))}
                        placeholder={getSearchPlaceholder('membresia')}
                        autoComplete="off"
                        aria-label="Filtrar membresía por cliente o placa"
                      />
                    </div>
                    <label className="crudx-ticket-search-estado">
                      <span className="crudx-ticket-search-estado-label">Estado membresía</span>
                      <select
                        className="admin-search-select"
                        value={membresiaFilter.eme}
                        onChange={(e) => setMembresiaFilter((f) => ({ ...f, eme: e.target.value }))}
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
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearMembresiaFilters}
                        disabled={loading}
                        title="Quitar filtros de membresías"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'detalle-pago-membresia' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyDpmPlacaFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={dpmPlacaFilter.placa}
                        onChange={(e) => setDpmPlacaFilter((f) => ({ ...f, placa: sanitizeSearchValue('placa', e.target.value) }))}
                        placeholder={getSearchPlaceholder('placa')}
                        autoComplete="off"
                        aria-label="Filtrar detalle de pago membresía por placa; deja vacío para ver todos"
                      />
                    </div>
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearDpmPlacaFilters}
                        disabled={loading}
                        title="Quitar filtro de placa"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'detalle-maquina-ticket' ? (
                <div className="crudx-ticket-search-block">
                  {scopedDmtMaqId ? (
                    <div className="crudx-scoped-filter-note">
                      <span>Máquina</span>
                      <strong>{scopedMachineActionLabel || `MAQ_ID ${scopedDmtMaqId}`}</strong>
                    </div>
                  ) : null}
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyDetalleMaqTicketFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={detalleMaqTicketFilter.q}
                        onChange={(e) => setDetalleMaqTicketFilter((f) => ({ ...f, q: sanitizeSearchValue('ticket', e.target.value) }))}
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
                        value={detalleMaqTicketFilter.desde}
                        max={NOW_LOCAL}
                        onChange={(e) => setDetalleMaqTicketFilter((f) => ({ ...f, desde: e.target.value > NOW_LOCAL ? NOW_LOCAL : e.target.value }))}
                        autoComplete="off"
                        aria-label="Fecha y hora inicial"
                      />
                    </label>
                    <label className="crudx-ticket-search-estado">
                      <span className="crudx-ticket-search-estado-label">Hasta</span>
                      <input
                        className="admin-search-input"
                        type="datetime-local"
                        value={detalleMaqTicketFilter.hasta}
                        max={NOW_LOCAL}
                        onChange={(e) => setDetalleMaqTicketFilter((f) => ({ ...f, hasta: e.target.value > NOW_LOCAL ? NOW_LOCAL : e.target.value }))}
                        autoComplete="off"
                        aria-label="Fecha y hora final"
                      />
                    </label>
                    {!scopedDmtMaqId ? (
                      <label className="crudx-ticket-search-estado">
                        <span className="crudx-ticket-search-estado-label">Transacción</span>
                        <select
                          className="admin-search-select"
                          value={detalleMaqTicketFilter.tx}
                          onChange={(e) => setDetalleMaqTicketFilter((f) => ({ ...f, tx: e.target.value }))}
                          aria-label="Filtrar detalle máquina-ticket por transacción"
                        >
                          <option value="">Todas</option>
                          {detalleMaqTicketTxOptions.map((tx) => (
                            <option key={tx} value={tx}>{tx}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearDetalleMaqTicketFilters}
                        disabled={loading}
                        title="Quitar filtros de Det. Máq/Ticket"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : entity.key === 'registro-movimiento-membresia' ? (
                <div className="crudx-ticket-search-block">
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyRmmPlacaFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={rmmPlacaFilter.placa}
                        onChange={(e) => setRmmPlacaFilter((f) => ({ ...f, placa: sanitizeSearchValue('placa', e.target.value) }))}
                        placeholder="Ej. P123ABC (opcional)"
                        autoComplete="off"
                        aria-label="Filtrar movimientos de membresía por placa; deja vacío para ver todos"
                      />
                    </div>
                    <div className="admin-search-actions">
                      <button type="submit" className="admin-btn-search" disabled={loading}>
                        <BtnContent icon={IconSearch}>Buscar</BtnContent>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearRmmPlacaFilters}
                        disabled={loading}
                        title="Quitar filtro de placa"
                      >
                        <BtnContent icon={IconClear}>Limpiar</BtnContent>
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Form */}
              {editId && (!isNewRecord || entity?.ops?.c !== false) && (
                <form onSubmit={save} className="crudx-form-panel">
                  <div className="crudx-form-head crudx-form-head--with-close">
                    <div>
                      <strong>
                        {isNewRecord ? `Nuevo: ${entity.label}` : `Editar: ${entity.label}`}
                      </strong>
                      {!isNewRecord ? (
                        <div className="crudx-form-note" style={{ marginTop: 6, marginBottom: 0 }}>
                          {getDbColumnLabel(entity.id, CRUD_COLUMN_LABELS)}:{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>{editId}</span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="crudx-form-close"
                      onClick={cancelEdit}
                      aria-label="Cerrar panel de edición"
                      title="Cerrar"
                    >
                      ✕
                    </button>
                  </div>
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
                        : getDbColumnLabel(f.k, CRUD_COLUMN_LABELS);
                      const lbl = lblBase;
                      const readOnlyOnUpdate = !isNewRecord && !!entity?.readOnlyOnUpdate?.includes(f.k);
                      const readOnlyOnCreate = isNewRecord && !!(entity?.readOnlyOnCreate || []).includes(f.k);
                      const lockByAlertBusinessRule =
                        entity?.key === 'alerta' &&
                        !isNewRecord &&
                        (f.k === 'ALE_USU_ID_RESOLVIO' || f.k === 'ALE_DESCRIPCION_SOLUCION') &&
                        !form?.ALE_FECHA_ATENCION;
                      const lockResolverUserByRole =
                        !sessionIsFullAdmin &&
                        !isNewRecord &&
                        (
                          (entity?.key === 'alerta' && f.k === 'ALE_USU_ID_RESOLVIO') ||
                          (entity?.key === 'bitacora-incidente-vehiculo' && f.k === 'USU_ID')
                        );
                      const lockOwnSessionActivationToggle =
                        entity?.key === 'usuario' &&
                        f.k === 'USU_ACTIVO' &&
                        !isNewRecord &&
                        isCurrentSessionUser(editId, sessionUserId);
                      const lockMachineStatusByMaintenanceFlow =
                        entity?.key === 'maquina' &&
                        f.k === 'EMA_ID' &&
                        isMachineStatusMaintenanceById(catalogOptions, form?.EMA_ID);
                      const lockScopedMaintenanceMachine =
                        entity?.key === 'registro-mantenimiento' &&
                        f.k === 'MAQ_ID' &&
                        Boolean((searchParams.get('rem_maq_id') || '').trim());
                      const fieldDisabled =
                        (f.k === entity.id && editId !== '__new__') ||
                        (isNewRecord && f.k === entity?.id) ||
                        readOnlyOnUpdate ||
                        readOnlyOnCreate ||
                        (entity?.key === 'cobro' && isNewRecord && ['COB_HORAS_TOTALES', 'COB_MONTO_TOTAL', 'COB_VUELTO', 'COB_FECHA_HORA', 'TAR_ID'].includes(f.k)) ||
                        lockByAlertBusinessRule ||
                        lockResolverUserByRole ||
                        lockOwnSessionActivationToggle ||
                        lockMachineStatusByMaintenanceFlow ||
                        lockScopedMaintenanceMachine;
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
                              const scopedMaqId = String(searchParams.get('rem_maq_id') || '').trim();
                              const scopedMaq = scopedMaqId ? findMachineById(catalogOptions, scopedMaqId) : null;
                              if (scopedMaq && !eligible.some((item) => String(item.MAQ_ID) === scopedMaqId)) {
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
                        entity?.key === 'registro-mantenimiento' &&
                        f.k === 'REM_TIPO_MOVIMIENTO' &&
                        (
                          String(form?.MAQ_ID ?? '').trim() === '' ||
                          (Array.isArray(selectOptions) && selectOptions.length <= 1)
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
                                style={effectiveFieldDisabled ? readOnlyFieldStyle : undefined}
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
                                style={fieldDisabled ? readOnlyFieldStyle : undefined}
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
                                style={fieldDisabled ? readOnlyFieldStyle : undefined}
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
                  <div className="crudx-form-actions">
                    <button type="submit" className="crudx-btn-primary">Guardar</button>
                    <button type="button" onClick={cancelEdit} className="crudx-btn-secondary">Cancelar</button>
                  </div>
                </form>
              )}

              {/* Table */}
              {loading ? (
                <div className="ops-loader-wrap">
                  <span className="ops-loader" aria-hidden="true" />
                  <span>Cargando registros...</span>
                </div>
              ) : entity?.key === 'detalle-saldo' && !(searchParams.get('ds_maq_id') || '').trim() ? (
                <p className="crudx-empty" role="status">
                  Elige una máquina de cobro arriba y pulsa "Aplicar filtros" para cargar el detalle de saldo.
                </p>
              ) : entity?.key === 'recargo-maquina' && !(searchParams.get('rma_maq_id') || '').trim() ? (
                <p className="crudx-empty" role="status">
                  Elige una maquina de cobro arriba y pulsa "Buscar" para consultar el historial.
                </p>
              ) : displayRows.length === 0 ? (
                <p className="crudx-empty" role="status">
                  {isMonthlyVehicleMembershipView
                    ? 'Este vehículo todavía no tiene membresías registradas.'
                    : entity?.key === 'detalle-saldo'
                    ? 'No hay registros de detalle de saldo para la máquina seleccionada.'
                    : entity?.key === 'recargo-maquina'
                      ? 'No hay registros de detalle saldo para la maquina seleccionada.'
                    : entity?.key === 'registro-movimiento-membresia'
                      ? (searchParams.get('rmm_placa') || '').trim()
                        ? 'No hay movimientos de membresía para la placa indicada.'
                        : 'No hay movimientos de membresía registrados.'
                      : entity?.key === 'detalle-pago-membresia'
                        ? (searchParams.get('dpm_placa') || '').trim()
                          ? 'No hay detalles de pago de membresía para la placa indicada.'
                          : 'No hay detalles de pago de membresía registrados.'
                        : 'Sin registros en esta entidad.'}
                </p>
              ) : (
                <div
                  className="crudx-table-scroll"
                  title="Si hay muchas filas, usa el scroll dentro de este cuadro para verlas todas."
                >
                  <table className="crudx-table">
                    <thead>
                      <tr>
                        {Object.keys(displayRows[0])
                          .filter((c) => !(entity?.key === 'ticket' && ['TIC_CODIGO', 'VEH_ID', 'MOD_ID', 'COL_ID', 'MAR_ID', 'TVE_ID', 'ETI_ID'].includes(c)))
                          .filter((c) => !(entity?.key === 'alerta' && c === 'TAL_ID'))
                          .filter((c) => !(entity?.key === 'detalle-saldo' && c === 'SDI_ID'))
                          .filter((c) => !(entity?.key === 'detalle-saldo' && c === 'MAQ_ID'))
                          .filter((c) => !(entity?.key === 'detalle-saldo' && c === 'MAQ_CODIGO'))
                          .filter((c) => !(entity?.key === 'registro-mantenimiento' && c === 'REM_ESTADO_RESULTANTE_EMA_ID'))
                          .filter((c) => !(entity?.key === 'registro-mantenimiento' && scopedRemMaqId && ['MAQ_ID', 'MAQ_CODIGO'].includes(c)))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'EME_ESTADO'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'TME_TIPO'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'ESP_CODIGO'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'CLI_PRIMER_NOMBRE'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'CLI_SEGUNDO_NOMBRE'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'CLI_PRIMER_APELLIDO'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'CLI_SEGUNDO_APELLIDO'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'VEH_ID'))
                          .filter((c) => !(entity?.key === 'membresia' && c === 'VEH_MODELO'))
                          .filter((c) => !(entity?.key === 'vehiculo' && c === 'TVE_ID'))
                          .filter((c) => !(entity?.key === 'vehiculo' && c === 'EME_ID'))
                          .filter((c) => !(isMonthlyClientVehicleView && entity?.key === 'vehiculo' && ['COL_ID', 'MAR_ID', 'MEM_ID'].includes(c)))
                          .filter((c) => !(isMonthlyCompactClientTable && MONTHLY_CLIENT_COMPACT_HIDDEN_COLUMNS.has(c)))
                          .filter((c) => !(isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'CLI_ID'))
                          .filter((c) => !(isMonthlyVehicleMembershipView && entity?.key === 'membresia' && ['CLI_ID', 'VEH_PLACA'].includes(c)))
                          .filter(
                            (c) =>
                              !(
                                entity?.key === 'detalle-pago-membresia'
                                && (c === 'DPM_MES_CANCELADO' || c === 'dpm_mes_cancelado')
                              ),
                          )
                          .filter(
                            (c) =>
                              !(
                                entity?.key === 'detalle-pago-membresia'
                                && (
                                  c === 'CLI_PRIMER_NOMBRE'
                                  || c === 'CLI_SEGUNDO_NOMBRE'
                                  || c === 'CLI_PRIMER_APELLIDO'
                                  || c === 'CLI_SEGUNDO_APELLIDO'
                                )
                              ),
                          )
                          .filter(
                            (c) =>
                              !(
                                entity?.key === 'bitacora-incidente-vehiculo'
                                && (
                                  c === 'VEH_ID'
                                  || c === 'VEH_MODELO'
                                  || c === 'BIV_RESUELTO'
                                  || c === 'USU_PRIMER_NOMBRE'
                                  || c === 'USU_PRIMER_APELLIDO'
                                  || c === 'INC_ID'
                                  || c === 'CLI_ID'
                                  || c === 'CLI_PRIMER_NOMBRE'
                                  || c === 'CLI_PRIMER_APELLIDO'
                                  || c === 'CLI_CORREO'
                                )
                              ),
                          )
                          .map((c) => (
                          <th key={c}>
                            {entity?.key === 'alerta' && c === 'EAL_ID'
                              ? 'Estado alerta'
                              : entity?.key === 'alerta' && c === 'MAQ_ID'
                                ? 'Máquina'
                                : entity?.key === 'alerta' && c === 'TAL_ID'
                                  ? 'Tipo alerta'
                                : entity?.key === 'alerta' && c === 'ALE_USU_ID_RESOLVIO'
                                  ? 'Persona a cargo'
                                  : entity?.key === 'membresia' && c === 'EME_ID'
                                    ? 'Estado membresía'
                                    : entity?.key === 'membresia' && c === 'TME_ID'
                                      ? 'Tipo membresía'
                                  : entity?.key === 'membresia' && c === 'CLI_ID'
                                        ? 'Cliente'
                                        : entity?.key === 'membresia' && c === 'ESP_ID'
                                          ? 'Espacio'
                                  : isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'VEH_MODELO'
                                    ? 'Modelo'
                                    : isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'VEH_COLOR'
                                      ? 'Color'
                                      : isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'EME_ESTADO'
                                        ? 'Estado'
                                  : entity?.key === 'cliente' && c === 'CLI_ACTIVO'
                                    ? 'Estado'
                                  : entity?.key === 'bitacora-incidente-vehiculo' && c === 'USU_ID'
                                    ? 'Usuario'
                                    : entity?.key === 'registro-mantenimiento' && c === 'REM_MANTENIMIENTO_FECHA'
                                      ? 'Fecha'
                                    : entity?.key === 'registro-mantenimiento' && c === 'REM_TIPO_MOVIMIENTO'
                                      ? 'Movimiento'
                                    : entity?.key === 'registro-mantenimiento' && c === 'REM_ESTADO_RESULTANTE'
                                      ? 'Estado resultante'
                                    : entity?.key === 'registro-movimiento-membresia' && c === 'VEH_PLACA'
                                      ? 'Placa'
                                      : entity?.key === 'registro-movimiento-membresia' && c === 'MEM_ID'
                                        ? 'Membresía'
                                        : entity?.key === 'detalle-pago-membresia' && c === 'VEH_PLACA'
                                          ? 'Placa'
                                          : entity?.key === 'detalle-pago-membresia' && c === 'MEM_ID'
                                            ? 'Membresía'
                                          : entity?.key === 'detalle-pago-membresia' && c === 'PAG_FECHA_HORA'
                                            ? 'Fecha pago'
                                            : entity?.key === 'detalle-pago-membresia' && c === 'PAG_ID'
                                              ? 'Pago'
                                              : getDbColumnLabel(c, CRUD_COLUMN_LABELS)}
                          </th>
                        ))}
                        {(entity.ops.u || entity.ops.d || entity.key === 'membresia' || entity.key === 'ticket' || entity.key === 'detalle-saldo') && (
                          <th>Acc.</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, i) => {
                        const rowKey = row?.[entity.id] ?? i;
                        const isExpandedClientDetail =
                          isMonthlyCompactClientTable
                          && String(expandedClientRowId ?? '') === String(row?.CLI_ID ?? '');
                        const vehicleMembershipStatus =
                          isMonthlyClientVehicleView && entity.key === 'vehiculo'
                            ? getVehicleMembershipStatus(row, catalogOptions)
                            : null;
                        return (
                        <Fragment key={rowKey}>
                          <tr>
                          {Object.entries(row)
                            .filter(([c]) => !(entity?.key === 'ticket' && ['TIC_CODIGO', 'VEH_ID', 'MOD_ID', 'COL_ID', 'MAR_ID', 'TVE_ID', 'ETI_ID'].includes(c)))
                            .filter(([c]) => !(entity?.key === 'alerta' && c === 'TAL_ID'))
                            .filter(([c]) => !(entity?.key === 'detalle-saldo' && c === 'SDI_ID'))
                            .filter(([c]) => !(entity?.key === 'detalle-saldo' && c === 'MAQ_ID'))
                            .filter(([c]) => !(entity?.key === 'detalle-saldo' && c === 'MAQ_CODIGO'))
                            .filter(([c]) => !(entity?.key === 'registro-mantenimiento' && c === 'REM_ESTADO_RESULTANTE_EMA_ID'))
                            .filter(([c]) => !(entity?.key === 'registro-mantenimiento' && scopedRemMaqId && ['MAQ_ID', 'MAQ_CODIGO'].includes(c)))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'EME_ESTADO'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'TME_TIPO'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'ESP_CODIGO'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'CLI_PRIMER_NOMBRE'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'CLI_SEGUNDO_NOMBRE'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'CLI_PRIMER_APELLIDO'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'CLI_SEGUNDO_APELLIDO'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'VEH_ID'))
                            .filter(([c]) => !(entity?.key === 'membresia' && c === 'VEH_MODELO'))
                            .filter(([c]) => !(entity?.key === 'vehiculo' && c === 'TVE_ID'))
                            .filter(([c]) => !(entity?.key === 'vehiculo' && c === 'EME_ID'))
                            .filter(([c]) => !(isMonthlyClientVehicleView && entity?.key === 'vehiculo' && ['COL_ID', 'MAR_ID', 'MEM_ID'].includes(c)))
                            .filter(([c]) => !(isMonthlyCompactClientTable && MONTHLY_CLIENT_COMPACT_HIDDEN_COLUMNS.has(c)))
                            .filter(([c]) => !(isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'CLI_ID'))
                            .filter(([c]) => !(isMonthlyVehicleMembershipView && entity?.key === 'membresia' && ['CLI_ID', 'VEH_PLACA'].includes(c)))
                            .filter(
                              ([c]) =>
                                !(
                                  entity?.key === 'detalle-pago-membresia'
                                  && (c === 'DPM_MES_CANCELADO' || c === 'dpm_mes_cancelado')
                                ),
                            )
                            .filter(
                              ([c]) =>
                                !(
                                  entity?.key === 'detalle-pago-membresia'
                                  && (
                                    c === 'CLI_PRIMER_NOMBRE'
                                    || c === 'CLI_SEGUNDO_NOMBRE'
                                    || c === 'CLI_PRIMER_APELLIDO'
                                    || c === 'CLI_SEGUNDO_APELLIDO'
                                  )
                                ),
                            )
                            .filter(
                              ([c]) =>
                                !(
                                  entity?.key === 'bitacora-incidente-vehiculo'
                                  && (
                                    c === 'VEH_ID'
                                    || c === 'VEH_MODELO'
                                    || c === 'BIV_RESUELTO'
                                    || c === 'USU_PRIMER_NOMBRE'
                                    || c === 'USU_PRIMER_APELLIDO'
                                    || c === 'INC_ID'
                                    || c === 'CLI_ID'
                                    || c === 'CLI_PRIMER_NOMBRE'
                                    || c === 'CLI_PRIMER_APELLIDO'
                                    || c === 'CLI_CORREO'
                                  )
                                ),
                            )
                            .map(([c, v]) => {
                            if (entity?.key === 'alerta' && c === 'ALE_DESCRIPCION') {
                              const text = v == null ? '—' : String(v);
                              const hasTip = text !== '—' && text.length > 0;
                              return (
                                <td key={c} className="crudx-cell-alert-desc">
                                  <div className="crudx-cell-alert-desc-wrap">
                                    <span className="crudx-cell-alert-desc-text" title={hasTip ? text : undefined}>
                                      {text}
                                    </span>
                                    <button
                                      type="button"
                                      className="crudx-btn-secondary crudx-btn-xs"
                                      onClick={() => openAlertaDetailPopup(row, formatAlertaDetailValue)}
                                      aria-label="Abrir detalle completo de la alerta en una ventana pequeña"
                                      title="Ver todos los campos (sin truncar) en ventana pequeña"
                                    >
                                      Detalle
                                    </button>
                                  </div>
                                </td>
                              );
                            }
                            if (entity?.key === 'alerta' && c === 'ALE_MOTIVO') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelTipoAlerta(row?.TAL_ID, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'alerta' && c === 'EAL_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelEstadoAlerta(v, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'alerta' && c === 'MAQ_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelMaquina({ MAQ_ID: v }, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'alerta' && c === 'ALE_USU_ID_RESOLVIO') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelUsuario(v, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'alerta' && c === 'TAL_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelTipoAlerta(v, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'bitacora-incidente-vehiculo' && c === 'USU_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {labelUsuario(v, catalogOptions)}
                                </td>
                              );
                            }
                            if (entity?.key === 'registro-mantenimiento' && c === 'REM_DESCRIPCION') {
                              const desc = String(v ?? '').trim();
                              return (
                                <td key={c} className="crudx-cell-maint-desc">
                                  {desc || '—'}
                                </td>
                              );
                            }
                            if (entity?.key === 'registro-mantenimiento' && c === 'REM_TIPO_MOVIMIENTO') {
                              const movement = String(v ?? '').trim().toUpperCase();
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {movement === 'FINALIZACION' ? 'Finalización' : movement === 'INICIO' ? 'Inicio' : (v == null ? '—' : String(v))}
                                </td>
                              );
                            }
                            if (entity?.key === 'registro-mantenimiento' && c === 'REM_ESTADO_RESULTANTE') {
                              const movement = String(row?.REM_TIPO_MOVIMIENTO ?? '').trim().toUpperCase();
                              const statusLabel = movement === 'INICIO'
                                ? 'Mantenimiento'
                                : String(v ?? '').trim();
                              const machineStatusBadge = getMachineStatusBadge(statusLabel || '—');
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span className={`crudx-status-pill crudx-status-pill--${machineStatusBadge.tone}`}>
                                    {machineStatusBadge.label}
                                  </span>
                                </td>
                              );
                            }
                            if (entity?.key === 'membresia' && c === 'EME_ID') {
                              const membershipBadge = getMembershipStatusBadge(
                                row?.EME_ESTADO == null || String(row.EME_ESTADO).trim() === ''
                                  ? (v == null ? '—' : String(v))
                                  : String(row.EME_ESTADO),
                              );
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span className={`crudx-status-pill crudx-status-pill--${membershipBadge.tone}`}>
                                    {membershipBadge.label}
                                  </span>
                                </td>
                              );
                            }
                            if (entity?.key === 'estado-membresia' && c === 'EME_ESTADO') {
                              const membershipBadge = getMembershipStatusBadge(v == null ? '—' : String(v));
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span className={`crudx-status-pill crudx-status-pill--${membershipBadge.tone}`}>
                                    {membershipBadge.label}
                                  </span>
                                </td>
                              );
                            }
                            if (entity?.key === 'estado-maquina' && c === 'EMA_ESTADO') {
                              const machineStatusBadge = getMachineStatusBadge(v == null ? '—' : String(v));
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span className={`crudx-status-pill crudx-status-pill--${machineStatusBadge.tone}`}>
                                    {machineStatusBadge.label}
                                  </span>
                                </td>
                              );
                            }
                            if (entity?.key === 'membresia' && c === 'TME_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {row?.TME_TIPO == null || String(row.TME_TIPO).trim() === ''
                                    ? (v == null ? '—' : String(v))
                                    : String(row.TME_TIPO)}
                                </td>
                              );
                            }
                            if (entity?.key === 'membresia' && c === 'CLI_ID') {
                              const nombreCliente = [
                                row?.CLI_PRIMER_NOMBRE,
                                row?.CLI_SEGUNDO_NOMBRE,
                                row?.CLI_PRIMER_APELLIDO,
                                row?.CLI_SEGUNDO_APELLIDO,
                              ]
                                .map((x) => String(x ?? '').trim())
                                .filter(Boolean)
                                .join(' ');
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {nombreCliente || (v == null ? '—' : String(v))}
                                </td>
                              );
                            }
                            if (entity?.key === 'membresia' && c === 'ESP_ID') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {row?.ESP_CODIGO == null || String(row.ESP_CODIGO).trim() === ''
                                    ? (v == null ? '—' : String(v))
                                    : String(row.ESP_CODIGO)}
                                </td>
                              );
                            }
                            if (entity?.key === 'cliente' && c === 'CLI_ACTIVO') {
                              const isActiveClient = Number(v ?? row?.CLI_ACTIVO ?? 0) === 1;
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span className={`crudx-status-pill crudx-status-pill--${isActiveClient ? 'success' : 'danger'}`}>
                                    {isActiveClient ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                              );
                            }
                            if (isMonthlyClientVehicleView && entity?.key === 'vehiculo' && c === 'EME_ESTADO') {
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  <span
                                    className={`crudx-status-pill crudx-status-pill--${vehicleMembershipStatus?.tone || 'neutral'}`}
                                  >
                                    {vehicleMembershipStatus?.label || 'Sin membresía'}
                                  </span>
                                </td>
                              );
                            }
                            if (entity?.key === 'detalle-pago-membresia' && c === 'MEM_ID') {
                              const nombreCliente = [
                                row?.CLI_PRIMER_NOMBRE,
                                row?.CLI_SEGUNDO_NOMBRE,
                                row?.CLI_PRIMER_APELLIDO,
                                row?.CLI_SEGUNDO_APELLIDO,
                              ]
                                .map((x) => String(x ?? '').trim())
                                .filter(Boolean)
                                .join(' ');
                              return (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {nombreCliente || (v == null ? '—' : String(v))}
                                </td>
                              );
                            }
                            return (
                              <td key={c} className="crudx-cell-ellipsis">
                                {v == null ? '—'
                                  : c === 'USU_PASSWORD' ? '••••'
                                  : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('es-GT')
                                  : String(v)}
                              </td>
                            );
                          })}
                          {(entity.ops.u || entity.ops.d || entity.key === 'membresia' || entity.key === 'ticket' || entity.key === 'detalle-saldo') && (
                            <td className="crudx-actions-cell">
                              {entity.ops.u && entity.key !== 'maquina' && (
                                <button onClick={() => startEdit(row)} className="crudx-btn-secondary crudx-btn-xs">
                                  <BtnContent icon={IconEdit}>
                                  {entity.key === 'alerta'
                                    ? (labelEstadoAlerta(row?.EAL_ID, catalogOptions).trim().toLowerCase() === 'atendida'
                                      ? 'Editar'
                                      : 'Resolver')
                                    : entity.key === 'bitacora-incidente-vehiculo'
                                      ? ((Number(row?.BIV_RESUELTO ?? 0) === 1 || row?.BIV_RESUELTO === true || row?.BIV_RESUELTO === '1')
                                        ? 'Editar'
                                        : 'Resolver')
                                    : 'Editar'}
                                  </BtnContent>
                                </button>
                              )}
                              {entity.ops.d && (
                                <button onClick={() => requestDelete(row[entity.id])} className="crudx-btn-danger crudx-btn-xs">
                                  <BtnContent icon={IconTrash}>Eliminar</BtnContent>
                                </button>
                              )}
                              {isMonthlyWorkspace && monthlyWorkspaceView === 'entity' && entity.key === 'cliente' && (
                                <button
                                  type="button"
                                  onClick={() => openMonthlyClientVehicles(row)}
                                  className="crudx-btn-secondary crudx-btn-xs"
                                >
                                  Vehículos
                                </button>
                              )}
                              {isMonthlyCompactClientTable && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedClientRowId((current) => (
                                    String(current ?? '') === String(row?.CLI_ID ?? '') ? null : row?.CLI_ID
                                  ))}
                                  className="crudx-btn-secondary crudx-btn-xs"
                                >
                                  {isExpandedClientDetail ? 'Ocultar ficha' : 'Ver ficha'}
                                </button>
                              )}
                              {entity.key === 'ticket' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => downloadTicketEntradaPdf(row)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Descargar ticket
                                  </button>
                                  {row?.COB_ID != null && String(row.COB_ID).trim() !== '' ? (
                                    <button
                                      type="button"
                                      onClick={() => downloadTicketComprobantePdf(row)}
                                      className="crudx-btn-secondary crudx-btn-xs"
                                    >
                                      Comprobante PDF
                                    </button>
                                  ) : null}
                                </>
                              )}
                              {isMonthlyClientVehicleView && entity.key === 'vehiculo' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openMonthlyVehicleMemberships(row, {
                                      startNew: false,
                                    })}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Ver membresía
                                  </button>
                                </>
                              )}
                              {entity.key === 'cliente' && (
                                Number(row.CLI_ACTIVO ?? 1) === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => deactivateCliente(row)}
                                    className="crudx-btn-danger crudx-btn-xs"
                                  >
                                    Desactivar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => activateCliente(row)}
                                    className="crudx-btn-success crudx-btn-xs"
                                  >
                                    Activar
                                  </button>
                                )
                              )}
                              {entity.key === 'usuario' && Number(row.USU_ACTIVO ?? 1) === 1 && !isCurrentSessionUser(row.USU_ID, sessionUserId) && (
                                <button
                                  type="button"
                                  onClick={() => deactivateUsuario(row)}
                                  className="crudx-btn-danger crudx-btn-xs"
                                >
                                  Desactivar
                                </button>
                              )}
                              {entity.key === 'membresia' && (
                                <button
                                  onClick={() => downloadTag(row)}
                                  className="crudx-btn-secondary crudx-btn-xs"
                                >
                                  Descargar Tag
                                </button>
                              )}
                              {entity.key === 'detalle-saldo' && (
                                <button
                                  type="button"
                                  onClick={() => quickRecargarDetalleSaldo(row)}
                                  className="crudx-btn-secondary crudx-btn-xs"
                                >
                                  Recargar
                                </button>
                              )}
                              {entity.key === 'maquina' && (
                                <>
                                  <button
                                    onClick={() => openMachineTransactions(row)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Transacciones
                                  </button>
                                  <button
                                    onClick={() => openMachineMaintenance(row)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Mantenimiento
                                  </button>
                                  {isMaquinaCobroRow(row, catalogOptions) && (
                                    <>
                                      <button
                                        onClick={() => openMachineRecharges(row)}
                                        className="crudx-btn-secondary crudx-btn-xs"
                                      >
                                        Recargas
                                      </button>
                                      <button
                                        onClick={() => openMachineBalance(row)}
                                        className="crudx-btn-secondary crudx-btn-xs"
                                      >
                                        Saldo
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                          )}
                          </tr>
                          {isExpandedClientDetail ? (
                            <tr className="crudx-client-detail-row">
                              <td colSpan={displayColumns.length + (showTableActions ? 1 : 0)}>
                                <div className="crudx-client-detail-card">
                                  <div className="crudx-client-detail-card__grid">
                                    {clienteCompactDetailItems(row).map((item) => (
                                      <div key={item.label} className="crudx-client-detail-card__item">
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
      </div>

      {confirmDialog ? (
        <div
          className="crudx-modal-backdrop ops-entry-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crud-confirm-title"
          onClick={() => setConfirmDialog(null)}
        >
          <div className="crudx-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="crud-confirm-title">{confirmDialog.title}</h2>
            <p>{confirmDialog.message}</p>
            <div className="crudx-confirm-modal__actions">
              <button type="button" className="crudx-btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancelar
              </button>
              <button type="button" className="crudx-btn-danger" onClick={confirmDialog.onConfirm}>
                <BtnContent icon={IconTrash}>{confirmDialog.confirmLabel || 'Confirmar'}</BtnContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vehClienteModal != null ? (
        <div
          className="crudx-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="veh-cli-modal-title"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '20px 22px',
              maxWidth: 420,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h2 id="veh-cli-modal-title" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>
              Vehículo sin cliente
            </h2>
            <p style={{ margin: '0 0 14px', lineHeight: 1.45, color: '#334155' }}>
              Asigne un cliente al vehículo (VEH_ID {vehClienteModal.VEH_ID}) antes de crear la membresía, o cancele y
              edite el vehículo en la entidad Vehículo.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="crudx-btn-secondary" onClick={() => setVehClienteModal(null)}>
                Cancelar
              </button>
              <button type="button" className="crudx-btn-primary" onClick={assignClienteAVehiculoModal}>
                Asignar cliente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
