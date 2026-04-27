import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { buildLabelMapFromCrudFields, getDbColumnLabel } from '../utils/dbColumnLabel.js';

// ── CONFIG ────────────────────────────────────────────────────
// ops: c=create, u=update, d=delete
// updateFields: si existe, el formulario de edición solo muestra esos campos
const SECTIONS = {
  'me-ms': {
    label: 'ME-MS — Entrada/Salida',
    entities: [
      { key: 'estado-ticket', label: 'Estado Ticket', id: 'ETI_ID',
        fields: [{ k:'ETI_ID',l:'ID',req:true },{ k:'ETI_ESTADO',l:'Estado',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'tarifa', label: 'Tarifa', id: 'TAR_ID',
        fields: [{ k:'TAR_ID',l:'ID',req:true },{ k:'TAR_TIPO',l:'Tipo',req:true },{ k:'TAR_PRECIO',l:'Precio',t:'number',req:true },{ k:'TAR_TIEMPO_GRACIA',l:'Tiempo Gracia (min)',t:'number',req:true }],
        ops:{c:true,u:true,d:true} },
      { key: 'ticket', label: 'Ticket', id: 'TIC_ID',
        fields: [
          { k:'TIC_ID',l:'ID',req:true },
          { k:'TIC_CODIGO',l:'Código',req:true },
          { k:'VEH_ID',l:'VEH_ID',req:true },
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
        ops:{c:true,u:true,d:false},
        updateFields:['TIC_FECHA_HORA_SALIDA','ETI_ID'],
        readOnlyOnCreate:['ETI_ID'],
      },
      { key: 'tipo-cobro', label: 'Tipo Cobro', id: 'TCO_ID',
        fields: [{ k:'TCO_ID',l:'ID',req:true },{ k:'TCO_TIPO',l:'Tipo',req:true },{ k:'TCO_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'cobro', label: 'Cobro', id: 'COB_ID',
        fields: [{ k:'COB_ID',l:'ID',req:true },{ k:'TIC_ID',l:'TIC_ID',req:true,t:'number' },{ k:'COB_NIT',l:'NIT / CF' },{ k:'COB_HORAS_TOTALES',l:'Horas',t:'number',req:true },{ k:'TCO_ID',l:'TCO_ID',req:true,t:'number' },{ k:'COB_MONTO_TOTAL',l:'Monto Total',t:'number',req:true },{ k:'COB_MONTO_RECIBIDO',l:'Monto Recibido',t:'number' },{ k:'COB_VUELTO',l:'Vuelto',t:'number' },{ k:'COB_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true },{ k:'COB_PROCESADO_MAQUINA',l:'Proc. Máq.',t:'checkbox' },{ k:'TAR_ID',l:'TAR_ID',req:true,t:'number' }],
        ops:{c:true,u:true,d:false}, updateFields:['COB_PROCESADO_MAQUINA'] },
      { key: 'detalle-maquina-ticket', label: 'Det. Máq./Ticket', id: 'DMT_ID',
        fields: [{ k:'DMT_ID',l:'ID',req:true },{ k:'DMT_TRANSACCION',l:'Transacción' },{ k:'TIC_ID',l:'TIC_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true },{ k:'DMT_HORA_TRANSACCION',l:'Hora',t:'datetime-local' }],
        ops:{c:false,u:false,d:false} },
    ],
  },
  'mc': {
    label: 'MC — Máquina Cobro',
    entities: [
      { key: 'estado-maquina', label: 'Estado Máquina', id: 'EMA_ID',
        fields: [{ k:'EMA_ID',l:'ID',req:true },{ k:'EMA_ESTADO',l:'Estado',req:true },{ k:'EMA_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'tipo-maquina', label: 'Tipo Máquina', id: 'TMA_ID',
        fields: [{ k:'TMA_ID',l:'ID',req:true },{ k:'TMA_TIPO',l:'Tipo',req:true },{ k:'TMA_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'saldo-disponible', label: 'Saldo Disponible', id: 'SDI_ID',
        fields: [{ k:'SDI_ID',l:'ID',req:true },{ k:'SDI_TIPO',l:'Tipo (billete/moneda)',req:true },{ k:'SDI_VALOR',l:'Valor',t:'number' }],
        ops:{c:true,u:true,d:false} },
      { key: 'detalle-saldo', label: 'Detalle Saldo', id: 'DSA_ID',
        fields: [{ k:'DSA_ID',l:'ID',req:true },{ k:'DSA_CANTIDAD',l:'Cantidad',t:'number' },{ k:'DSA_SUBTOTAL',l:'Subtotal',t:'number' },{ k:'DSA_UMBRAL_MINIMO',l:'Umbral mínimo',t:'number' },{ k:'SDI_ID',l:'SDI_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true }],
        ops:{c:false,u:true,d:false}, updateFields:['DSA_UMBRAL_MINIMO'] },
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
        ops:{c:true,u:true,d:false} },
      { key: 'recargo-maquina', label: 'Recargo Máquina', id: 'RMA_ID',
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
          },
          { k:'RMA_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },
          { k:'RMA_DESCRIPCION',l:'Descripción' },
          { k:'RECARGA_DETALLE_SALDO',l:'Detalle billetes' },
        ],
        ops:{c:true,u:false,d:false} },
      { key: 'registro-mantenimiento', label: 'Reg. Mantenimiento', id: 'REM_ID',
        fields: [
          { k:'REM_ID',l:'ID',req:true },
          { k:'MAQ_ID',l:'Máquina',req:true,t:'select',catalog:'maquina',valueKey:'MAQ_ID',labelKey:'MAQ_CODIGO' },
          { k:'REM_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },
          { k:'REM_DESCRIPCION',l:'Descripción' },
        ],
        ops:{c:true,u:false,d:false} },
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
    label: 'PA — Parqueo General',
    entities: [
      { key: 'rol', label: 'Rol', id: 'ROL_ID',
        fields: [{ k:'ROL_ID',l:'ID',req:true },{ k:'ROL_TIPO',l:'Tipo',req:true },{ k:'ROL_DESCRIPCION',l:'Descripción' }],
        ops:{c:false,u:true,d:true}, updateFields:['ROL_DESCRIPCION'] },
      { key: 'usuario', label: 'Usuario', id: 'USU_ID',
        fields: [{ k:'USU_ID',l:'ID',req:true },{ k:'USU_PRIMER_NOMBRE',l:'Primer Nombre',req:true },{ k:'USU_SEGUNDO_NOMBRE',l:'Segundo Nombre' },{ k:'USU_PRIMER_APELLIDO',l:'Primer Apellido',req:true },{ k:'USU_SEGUNDO_APELLIDO',l:'Segundo Apellido' },{ k:'USU_CORREO',l:'Correo',req:true },{ k:'USU_PASSWORD',l:'Contraseña',t:'password',req:true,createOnly:true },{ k:'USU_TELEFONO',l:'Teléfono' },{ k:'ROL_ID',l:'ROL_ID',req:true },{ k:'USU_ACTIVO',l:'Activo',t:'checkbox' }],
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
        fields: [{ k:'TVE_ID',l:'ID',req:true },{ k:'TVE_TIPO',l:'Tipo',req:true },{ k:'TVE_MARCA',l:'Marca' },{ k:'TVE_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'vehiculo', label: 'Vehículo', id: 'VEH_ID',
        fields: [
          { k:'VEH_ID',l:'ID',req:true },
          { k:'VEH_PLACA',l:'Placa',req:true },
          { k:'VEH_MODELO',l:'Modelo' },
          { k:'VEH_COLOR',l:'Color' },
          { k:'TVE_ID',l:'Tipo de vehículo',req:true,t:'select',catalog:'tipo-vehiculo',valueKey:'TVE_ID',labelKey:'TVE_TIPO' },
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
          {
            k:'MEM_VEH_PLACA',
            l:'Placa del vehículo',
            req:true,
            omitFromApi:true,
            placeholder:'Ej. P-123ABC',
          },
        ],
        ops:{c:true,u:true,d:false},
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
          { k:'BIV_RESUELTO',l:'Resuelto',t:'checkbox' },
          { k:'BIV_FECHA_RESOLUCION',l:'Fecha Resolución',t:'datetime-local' },
          { k:'USU_ID',l:'Usuario',t:'select',catalog:'usuario',valueKey:'USU_ID',labelKey:'USU_PRIMER_NOMBRE' },
        ],
        ops:{c:true,u:true,d:false}, updateFields:['BIV_RESUELTO','BIV_FECHA_RESOLUCION'] },
      { key: 'tipo-pago', label: 'Tipo de Pago', id: 'TPA_ID',
        fields: [{ k:'TPA_ID',l:'ID',req:true },{ k:'TPA_TIPO',l:'Tipo',req:true },{ k:'TPA_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'pago', label: 'Pago', id: 'PAG_ID',
        fields: [{ k:'PAG_ID',l:'ID',req:true },{ k:'TPA_ID',l:'TPA_ID',req:true },{ k:'PAG_MONTO_TOTAL',l:'Monto Total',t:'number',req:true },{ k:'PAG_MONTO_RECIBIDO',l:'Monto Recibido',t:'number' },{ k:'PAG_VUELTO',l:'Vuelto',t:'number' },{ k:'PAG_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'detalle-pago-membresia', label: 'Det. Pago Membresía', id: 'DPM_ID',
        fields: [{ k:'DPM_ID',l:'ID',req:true },{ k:'MEM_ID',l:'MEM_ID',req:true },{ k:'PAG_ID',l:'PAG_ID',req:true },{ k:'DPM_MES_CANCELADO',l:'Mes Cancelado',t:'number',req:true }],
        ops:{c:true,u:false,d:false} },
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

/** Mapa columna API → etiqueta de formulario (SECTIONS), con fallback en `getDbColumnLabel`. */
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

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

/** Tono de alerta en toolbar: errores de API y restricciones (p. ej. FK al eliminar). */
function isCrudErrorMessage(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^Error(:|\s)/i.test(t)) return true;
  if (/^No se puede\b/i.test(t)) return true;
  if (/^No existe\b/i.test(t)) return true;
  return false;
}

/** Texto corto y claro bajo el título de cada lista del panel admin (`sectionPath` + entidad). */
function getAdminListContextHint(sectionPath, entityKey) {
  if (!sectionPath || !entityKey) return null;

  const HINTS = {
    'clientes-mensuales': {
      cliente:
        'Clientes dados de alta para el esquema mensual. Desde aquí actualizas datos de contacto y dirección.',
      membresia:
        'Contratos mensuales: unen un vehículo con un espacio fijo y el tipo de plan elegido.',
      vehiculo:
        'Solo se muestran vehículos de clientes que ya tienen al menos una membresía (tu flota mensual).',
      'tipo-vehiculo': 'Catálogo de categorías de vehículo (sedán, SUV, etc.) que asignas a cada placa.',
      'tipo-membresia': 'Planes disponibles: duración, precio y nombre comercial para nuevas membresías.',
      'estado-membresia': 'Estados posibles del contrato (activa, vencida, suspendida…).',
      'registro-movimiento-membresia':
        'Movimientos de entrada y salida registrados contra cada membresía.',
    },
    'tickets-vehiculos': {
      'estado-ticket':
        'Define en qué etapa va cada ticket (por ejemplo activo o ya pagado).',
      ticket:
        'Tickets de visitantes sin plan mensual. Consejo: en la barra del navegador puedes añadir ?q= y escribir parte del código o de la placa para acotar la lista.',
      vehiculo:
        'Vehículos de visita o factura puntual: ves placas sin cliente, o con cliente pero sin ninguna membresía (típico tras pagar con NIT en caja).',
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
      maquina: 'Equipos de cabina: entrada, cobro o salida, con su código interno y estado.',
      'tipo-maquina': 'Clasifica cada equipo según su función en el parqueo.',
      'estado-maquina': 'Indica si la máquina está en servicio, en revisión o fuera de línea.',
      'detalle-maquina-ticket':
        'Auditoría de qué máquina atendió cada movimiento del ticket.',
      'saldo-disponible':
        'Billetes o monedas que la caja de una máquina puede recibir o devolver.',
      'detalle-saldo':
        'Cantidad física por cada denominación dentro de una máquina de cobro. La tabla solo aparece después de elegir máquina y aplicar el filtro.',
      'recargo-maquina': 'Registro de recargas de efectivo hechas en caja.',
      'registro-mantenimiento': 'Intervenciones técnicas o preventivas sobre cada equipo.',
    },
    tarifas: {
      tarifa: 'Precio por tiempo, tipo de tarifa y minutos de gracia que aplican al cobrar estacionamiento.',
      'tipo-cobro': 'Catálogo reutilizable al registrar un cobro (nombre y descripción).',
      'tipo-pago': 'Medios de pago para otros procesos del sistema (membresías, mensualidades, etc.).',
    },
    'bitacora-incidentes': {
      'bitacora-incidente-vehiculo':
        'Seguimiento de novedades por vehículo. Arriba puedes filtrar por incidente, fechas o si ya quedó resuelto.',
      incidente: 'Tipos de suceso que luego enlazas en la bitácora (choque, avería, etc.).',
    },
    alertas: {
      'tipo-alerta': 'Motivos por los que el sistema genera alertas (saldo bajo, asistencia, etc.).',
      'estado-alerta': 'Etapas de atención de una alerta (pendiente, en curso, cerrada…).',
      alerta: 'Listado de alertas generadas; revisa prioridad y máquina asociada.',
    },
  };

  const specific = HINTS[sectionPath]?.[entityKey];
  if (specific) return specific;
  return 'Consulta o edita los registros de esta lista. Usa «+ Nuevo» para altas y «Editar» en cada fila cuando aplique.';
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
function maquinasTipoCobroList(catalogOptions) {
  const maqs = catalogOptions?.maquina || [];
  const tipos = catalogOptions?.['tipo-maquina'] || [];
  return maqs.filter((m) => {
    const t = tipos.find((t0) => String(t0.TMA_ID) === String(m.TMA_ID));
    return t != null && isTipoMaquinaCobroClient(t.TMA_TIPO);
  });
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
 * @param {{ filterEntityKeys?: string[]; sessionUserId?: string | number | null }} props
 * Si `filterEntityKeys` está definido, se ocultan las pestañas ME-MS / MC / PA y solo se listan esas entidades.
 * `sessionUserId`: USU_ID del admin logueado (bitácora: marca quién resolvió el incidente).
 * `sectionPath`: ruta del módulo en `/admin` (muestra textos de ayuda acordes a cada lista).
 */
const emptyBivFilter = { inc: '', resuelto: '', desde: '', hasta: '' };
const emptyAlertaFilter = { eal: '', tal: '', maq: '' };
const emptyTicketFilter = { eti: '', q: '' };
const emptyDetalleSaldoMaqFilter = { maq: '' };

export default function CrudDemo({ filterEntityKeys = null, sessionUserId = null, sectionPath = '' }) {
  const readOnlyFieldStyle = {
    background: '#e5e7eb',
    color: '#4b5563',
    borderColor: '#d1d5db',
    cursor: 'default',
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const filteredEntities = useMemo(
    () => (filterEntityKeys?.length ? collectEntitiesByKeys(filterEntityKeys) : null),
    [filterEntityKeys],
  );

  const [section, setSection] = useState('me-ms');
  const [entity, setEntity]   = useState(null);
  const [rows, setRows]        = useState([]);
  const [loading, setLoading]  = useState(false);
  const [form, setForm]        = useState({});
  const [editId, setEditId]    = useState(null);
  const [msg, setMsg]          = useState('');
  const [editRowSnapshot, setEditRowSnapshot] = useState(null);
  const [machineView, setMachineView] = useState({ maqId: null, title: '', rows: [] });
  const [bivFilter, setBivFilter] = useState(emptyBivFilter);
  const [alertaFilter, setAlertaFilter] = useState(emptyAlertaFilter);
  const [ticketFilter, setTicketFilter] = useState(emptyTicketFilter);
  const [detalleSaldoMaqFilter, setDetalleSaldoMaqFilter] = useState(emptyDetalleSaldoMaqFilter);
  /** Modal MEM-2: vehículo sin cliente al crear membresía */
  const [vehClienteModal, setVehClienteModal] = useState(null);
  /** Catálogos para campos `t: 'select'` (clave = segmento API, p. ej. tipo-vehiculo). */
  const [catalogOptions, setCatalogOptions] = useState({});
  const bivQueryKey = searchParams.toString();
  const formatAlertaDetailValue = (key, value, row) => {
    if (key === 'MAQ_ID') return labelMaquina({ MAQ_ID: value }, catalogOptions);
    if (key === 'EAL_ID') return labelEstadoAlerta(value, catalogOptions);
    if (key === 'ALE_USU_ID_RESOLVIO') return labelUsuario(value, catalogOptions);
    if (key === 'TAL_ID') return labelTipoAlerta(value, catalogOptions);
    return value;
  };

  useEffect(() => {
    if (!entity) return;
    const catsBase = [
      ...new Set(
        entity.fields.filter((f) => f.t === 'select' && f.catalog).map((f) => f.catalog),
      ),
    ];
    const cats =
      entity.key === 'alerta'
        ? [...new Set([...catsBase, 'tipo-maquina', 'tipo-alerta'])]
        : entity.key === 'ticket'
            ? [...new Set([...catsBase, 'estado-ticket'])]
            : entity.key === 'detalle-saldo'
              ? [...new Set([...catsBase, 'maquina', 'tipo-maquina'])]
              : entity.key === 'recargo-maquina'
                ? [...new Set([...catsBase, 'tipo-maquina'])]
                : catsBase;
    if (!cats.length) return;
    let cancelled = false;
    (async () => {
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
      if (!cancelled) {
        setCatalogOptions((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity?.key]);

  useEffect(() => {
    if (entity?.key !== 'bitacora-incidente-vehiculo') return;
    const r = searchParams.get('biv_resuelto');
    setBivFilter({
      inc: searchParams.get('inc_id') || '',
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
    if (entity?.key !== 'detalle-saldo') return;
    setDetalleSaldoMaqFilter({
      maq: searchParams.get('ds_maq_id') || '',
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
      const res = await fetch(listUrl, { cache: 'no-store' });
      const data = await res.json();
      let list = Array.isArray(data) ? data : [];
      if (entity.key === 'alerta') {
        const eal = searchParams.get('eal_id');
        const tal = searchParams.get('tal_id');
        const maq = searchParams.get('maq_id');
        if (eal) list = list.filter((r) => String(r.EAL_ID ?? r.eal_id) === eal);
        if (tal) list = list.filter((r) => String(r.TAL_ID ?? r.tal_id) === tal);
        if (maq) list = list.filter((r) => String(r.MAQ_ID ?? r.maq_id) === maq);
      }
      if (entity.key === 'bitacora-incidente-vehiculo') {
        const inc = searchParams.get('inc_id');
        const resu = searchParams.get('biv_resuelto');
        const desde = searchParams.get('biv_desde');
        const hasta = searchParams.get('biv_hasta');
        if (inc) list = list.filter((r) => String(r.INC_ID ?? r.inc_id) === inc);
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
      if (entity.key === 'vehiculo') {
        const q = (searchParams.get('q') || '').trim().toUpperCase();
        if (q) {
          list = list.filter((r) => String(r.VEH_PLACA ?? '').toUpperCase().includes(q));
        }
      }
      setRows(list);
    } catch (e) { setMsg('Error: ' + e.message); setRows([]); }
    finally { setLoading(false); }
  }

  function selectSection(s) {
    if (section === s) return;
    setSection(s);
    setEntity(null);
    setRows([]);
    setEditId(null);
    setMsg('');
    setMachineView({ maqId: null, title: '', rows: [] });
  }

  function selectEntity(e) {
    if (entity?.key === e.key) return;
    setRows([]);
    setMachineView({ maqId: null, title: '', rows: [] });
    setEntity(e);
    setEditId(null);
    setForm(emptyForm(e.fields));
    setEditRowSnapshot(null);
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
    setForm(f); setEditId(row[entity.id]); setEditRowSnapshot(row);
  }

  function cancelEdit() { setEditId(null); setForm(emptyForm(entity.fields)); setEditRowSnapshot(null); }

  function applyBivFilters(e) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    ['inc_id', 'biv_resuelto', 'biv_desde', 'biv_hasta'].forEach((k) => p.delete(k));
    if (bivFilter.inc.trim()) p.set('inc_id', bivFilter.inc.trim());
    if (bivFilter.resuelto === '0' || bivFilter.resuelto === '1') p.set('biv_resuelto', bivFilter.resuelto);
    if (bivFilter.desde.trim()) p.set('biv_desde', bivFilter.desde.trim());
    if (bivFilter.hasta.trim()) p.set('biv_hasta', bivFilter.hasta.trim());
    setSearchParams(p, { replace: true });
  }

  function clearBivFilters() {
    const p = new URLSearchParams(searchParams);
    ['inc_id', 'biv_resuelto', 'biv_desde', 'biv_hasta'].forEach((k) => p.delete(k));
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

  async function showMachineData(maqId, endpoint, title) {
    try {
      setMsg('');
      const res = await fetch(`${API_BASE}${endpoint}`);
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMachineView({
        maqId,
        title,
        rows: Array.isArray(json) ? json : [],
      });
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  }

  async function save(e) {
    e.preventDefault(); setMsg('');
    const isEdit = editId != null && editId !== '__new__';
    const fieldsToUse =
      isEdit && (entity.updateFields || entity.readOnlyOnUpdate)
        ? (() => {
            const updateKeys = Array.from(
              new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
            );
            return entity.fields.filter(f => f.k === entity.id || updateKeys.includes(f.k));
          })()
        : entity.fields.filter(f => !(isEdit && f.createOnly));
    const payload = preparePayload(fieldsToUse, form);
    if (entity.key === 'membresia') {
      const placa = String(form.MEM_VEH_PLACA ?? '').trim();
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
      }
    }
    if (!isEdit && entity?.key === 'alerta') delete payload.ALE_ID;
    if (!isEdit && entity?.key === 'ticket') {
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
      const resuelto = Number(payload.BIV_RESUELTO) === 1 || payload.BIV_RESUELTO === true;
      if (resuelto) payload.USU_ID = sessionUserId;
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
      if (json.warning) okMsg += ' — ' + json.warning;
      setMsg(okMsg);
      cancelEdit(); load();
    } catch (err) { setMsg('Error: ' + err.message); }
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
      setMsg('Error: ' + e.message);
    }
  }

  async function del(id) {
    const pkLabel = getDbColumnLabel(entity.id, CRUD_COLUMN_LABELS);
    if (!confirm(`¿Eliminar ${entity.label} (${pkLabel}: ${id})?`)) return;
    try {
      const res = await fetch(`${API_BASE}/${entity.key}/${id}`, { method: 'DELETE' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg('Eliminado.'); load();
    } catch (err) {
      const txt = String(err.message || '');
      if (/ORA-20001|ORA-02292/i.test(txt)) {
        setMsg('No se puede eliminar porque este registro está siendo usado por otro.');
      } else {
        setMsg('Error: ' + txt);
      }
    }
  }

  async function deactivateCliente(row) {
    try {
      const payload = { ...row, CLI_ACTIVO: 0 };
      const res = await fetch(`${API_BASE}/cliente/${row.CLI_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg('Cliente desactivado.');
      load();
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  }

  async function deactivateUsuario(row) {
    try {
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
      setMsg('Error: ' + err.message);
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

  const sectionEntities = filteredEntities ?? (SECTIONS[section]?.entities ?? []);
  const isNewRecord = editId === '__new__';
  const formFields = entity
    ? !isNewRecord && editId && (entity.updateFields || entity.readOnlyOnUpdate)
        ? (() => {
            const updateKeys = Array.from(
              new Set([...(entity.updateFields || []), ...(entity.readOnlyOnUpdate || [])]),
            );
            return entity.fields.filter(f => f.k === entity.id || updateKeys.includes(f.k));
          })()
        : entity.fields.filter(f => !(editId && !isNewRecord && f.createOnly))
    : [];

  const visibleFormFields =
    entity?.key === 'ticket' && isNewRecord
      ? formFields.filter((f) => !['TIC_ID', 'TIC_CODIGO', 'TIC_FECHA_HORA_SALIDA'].includes(f.k))
      : formFields;

  const listContextHint = useMemo(() => {
    if (!sectionPath || !entity?.key) return null;
    return getAdminListContextHint(sectionPath, entity.key);
  }, [sectionPath, entity?.key]);

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
        <div className="crudx-entity-chips">
          {sectionEntities.map(e => (
            <button
              key={e.key}
              onClick={() => selectEntity(e)}
              className={`crudx-chip${entity?.key === e.key ? ' crudx-chip--active' : ''}`}
            >
              {e.label}
            </button>
          ))}
        </div>
          {!entity && <p className="crudx-empty">Selecciona una entidad</p>}

          {entity && (
            <>
              <div className="crudx-toolbar">
                <strong>{entity.label}</strong>
                {!loading && rows.length > 0 ? (
                  <span className="crudx-msg" style={{ fontWeight: 500, color: '#475569' }}>
                    {rows.length} registro{rows.length === 1 ? '' : 's'}
                  </span>
                ) : null}
                {entity.ops.c && !editId && (
                  <button onClick={() => { setEditId('__new__'); setForm(emptyForm(entity.fields)); }}
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
                    {msg}
                  </span>
                )}
              </div>

              {listContextHint ? (
                <p
                  className={`crudx-context-hint${['alerta', 'tipo-alerta', 'estado-alerta', 'ticket', 'detalle-saldo'].includes(entity.key) ? ' crudx-context-hint--full' : ''}`}
                  role="note"
                >
                  {listContextHint}
                </p>
              ) : null}

              {entity.key === 'bitacora-incidente-vehiculo' ? (
                <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyBivFilters}>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Incidente</span>
                    <input
                      className="admin-search-input crudx-admin-filter-input-compact"
                      type="text"
                      inputMode="numeric"
                      value={bivFilter.inc}
                      onChange={(e) => setBivFilter((f) => ({ ...f, inc: e.target.value }))}
                      placeholder="Ej. 1"
                      aria-label="Incidente por ID"
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
                      onChange={(e) => setBivFilter((f) => ({ ...f, desde: e.target.value }))}
                      aria-label="Fecha desde"
                    />
                  </label>
                  <label className="crudx-ticket-search-estado">
                    <span className="crudx-ticket-search-estado-label">Hasta</span>
                    <input
                      className="admin-search-input"
                      type="date"
                      value={bivFilter.hasta}
                      onChange={(e) => setBivFilter((f) => ({ ...f, hasta: e.target.value }))}
                      aria-label="Fecha hasta"
                    />
                  </label>
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      Buscar
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearBivFilters}
                      disabled={loading}
                    >
                      Limpiar
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
                      Buscar
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearAlertaFilters}
                      disabled={loading}
                    >
                      Limpiar
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
                        Seleccione una máquina…
                      </option>
                      {maquinasTipoCobroList(catalogOptions).map((x) => (
                        <option key={x.MAQ_ID} value={String(x.MAQ_ID)}>
                          {labelMaquina(x, catalogOptions)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-search-actions">
                    <button type="submit" className="admin-btn-search" disabled={loading}>
                      Buscar
                    </button>
                    <button
                      type="button"
                      className="admin-btn-search-clear"
                      onClick={clearDetalleSaldoMaqFilter}
                      disabled={loading}
                    >
                      Limpiar
                    </button>
                  </div>
                </form>
              ) : entity.key === 'ticket' ? (
                <div className="crudx-ticket-search-block">
                  <div className="admin-panel-head admin-panel-head--row">
                    <div className="admin-panel-head-text">
                      <h2>{entity.label}</h2>
                      <p className="admin-panel-sub">
                        Busca por código de ticket o placa del vehículo. Filtra por estado del ticket si lo necesitas.
                      </p>
                    </div>
                  </div>
                  <form className="admin-search-form crudx-ticket-search-form" onSubmit={applyTicketFilters}>
                    <div className="admin-search-input-wrap">
                      <input
                        className="admin-search-input"
                        type="search"
                        value={ticketFilter.q}
                        onChange={(e) => setTicketFilter((f) => ({ ...f, q: e.target.value }))}
                        placeholder="🔍 Código o placa"
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
                        Buscar
                      </button>
                      <button
                        type="button"
                        className="admin-btn-search-clear"
                        onClick={clearTicketFilters}
                        disabled={loading}
                        title="Quitar búsqueda y filtros de la lista"
                      >
                        Limpiar
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Form */}
              {editId && (
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
                    {entity.key === 'ticket' && isNewRecord ? (
                      <p className="crudx-form-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
                        El código del ticket se genera solo. La salida se registra al editar el ticket. Al crear,
                        el estado queda en Activo y no es editable.
                      </p>
                    ) : null}
                    {visibleFormFields.map((f) => {
                      const fieldId = `crud-${entity.key}-${String(f.k).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                      const lbl = `${getDbColumnLabel(f.k, CRUD_COLUMN_LABELS)}${f.req ? ' *' : ''}`;
                      const readOnlyOnUpdate = !isNewRecord && !!entity?.readOnlyOnUpdate?.includes(f.k);
                      const readOnlyOnCreate = isNewRecord && !!(entity?.readOnlyOnCreate || []).includes(f.k);
                      const lockByAlertBusinessRule =
                        entity?.key === 'alerta' &&
                        !isNewRecord &&
                        (f.k === 'ALE_USU_ID_RESOLVIO' || f.k === 'ALE_DESCRIPCION_SOLUCION') &&
                        !form?.ALE_FECHA_ATENCION;
                      const fieldDisabled =
                        (f.k === entity.id && editId !== '__new__') ||
                        (isNewRecord && f.k === entity?.id) ||
                        readOnlyOnUpdate ||
                        readOnlyOnCreate ||
                        lockByAlertBusinessRule;
                      return (
                        <div
                          key={f.k}
                          className={`crudx-field${
                            f.t === 'checkbox'
                              ? ' crudx-field--checkbox'
                              : f.t === 'select'
                                ? ' crudx-field--select'
                                : ''
                          }`}
                        >
                          {f.t === 'checkbox' ? (
                            <label htmlFor={fieldId} className="crudx-checkbox-inline">
                              <input
                                id={fieldId}
                                type="checkbox"
                                checked={!!form[f.k]}
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
                                disabled={fieldDisabled}
                                style={fieldDisabled ? readOnlyFieldStyle : undefined}
                                onChange={(ev) => setForm((p) => ({ ...p, [f.k]: ev.target.value }))}
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
                                {(f.catalog === 'maquina' && f.maquinaSoloCobro
                                  ? maquinasTipoCobroList(catalogOptions)
                                  : (catalogOptions[f.catalog] || [])
                                ).map((row) => {
                                  const val =
                                    row[f.valueKey] != null ? String(row[f.valueKey]) : '';
                                  if (val === '') return null;
                                  const lab = f.catalog === 'usuario'
                                    ? [row.USU_PRIMER_NOMBRE, row.USU_PRIMER_APELLIDO].filter(Boolean).join(' ') || val
                                    : f.catalog === 'maquina'
                                      ? labelMaquina(row, catalogOptions)
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
                              {f.help ? (
                                <p
                                  className="crudx-form-note"
                                  style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.4 }}
                                >
                                  {f.help}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <label htmlFor={fieldId}>{lbl}</label>
                              <input
                                id={fieldId}
                                type={f.t === 'password' && editId !== '__new__' ? 'text' : (f.t || 'text')}
                                value={form[f.k] ?? ''}
                                placeholder={
                                  isNewRecord && f.k === entity?.id
                                    ? 'Se genera automáticamente al guardar'
                                    : f.placeholder || undefined
                                }
                                required={!!f.req && !(isNewRecord && f.k === entity?.id)}
                                disabled={fieldDisabled}
                                style={fieldDisabled ? readOnlyFieldStyle : undefined}
                                onChange={(ev) => setForm((p) => ({ ...p, [f.k]: ev.target.value }))}
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
                  Elige una máquina de cobro arriba y pulsa «Aplicar filtros» para cargar el detalle de saldo.
                </p>
              ) : rows.length === 0 ? (
                <p className="crudx-empty" role="status">
                  {entity?.key === 'detalle-saldo'
                    ? 'No hay registros de detalle de saldo para la máquina seleccionada.'
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
                        {Object.keys(rows[0])
                          .filter((c) => !(entity?.key === 'alerta' && c === 'TAL_ID'))
                          .filter(
                            (c) =>
                              !(
                                entity?.key === 'bitacora-incidente-vehiculo'
                                && (c === 'USU_PRIMER_NOMBRE' || c === 'USU_PRIMER_APELLIDO' || c === 'INC_ID')
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
                                  : entity?.key === 'bitacora-incidente-vehiculo' && c === 'USU_ID'
                                    ? 'Usuario'
                                    : getDbColumnLabel(c, CRUD_COLUMN_LABELS)}
                          </th>
                        ))}
                        {(entity.ops.u || entity.ops.d || entity.key === 'membresia' || entity.key === 'ticket') && (
                          <th>Acc.</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          {Object.entries(row)
                            .filter(([c]) => !(entity?.key === 'alerta' && c === 'TAL_ID'))
                            .filter(
                              ([c]) =>
                                !(
                                  entity?.key === 'bitacora-incidente-vehiculo'
                                  && (c === 'USU_PRIMER_NOMBRE' || c === 'USU_PRIMER_APELLIDO' || c === 'INC_ID')
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
                            return (
                              <td key={c} className="crudx-cell-ellipsis">
                                {v == null ? '—'
                                  : c === 'USU_PASSWORD' ? '••••'
                                  : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('es-GT')
                                  : String(v)}
                              </td>
                            );
                          })}
                          {(entity.ops.u || entity.ops.d || entity.key === 'membresia' || entity.key === 'ticket') && (
                            <td className="crudx-actions-cell">
                              {entity.ops.u && (
                                <button onClick={() => startEdit(row)} className="crudx-btn-secondary crudx-btn-xs">
                                  {entity.key === 'alerta'
                                    ? (labelEstadoAlerta(row?.EAL_ID, catalogOptions).trim().toLowerCase() === 'atendida'
                                      ? 'Editar'
                                      : 'Resolver')
                                    : 'Editar'}
                                </button>
                              )}
                              {entity.ops.d && <button onClick={() => del(row[entity.id])} className="crudx-btn-danger crudx-btn-xs">Eliminar</button>}
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
                              {entity.key === 'cliente' && Number(row.CLI_ACTIVO ?? 1) === 1 && (
                                <button
                                  type="button"
                                  onClick={() => deactivateCliente(row)}
                                  className="crudx-btn-danger crudx-btn-xs"
                                >
                                  Desactivar
                                </button>
                              )}
                              {entity.key === 'usuario' && Number(row.USU_ACTIVO ?? 1) === 1 && (
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
                              {entity.key === 'maquina' && (
                                <>
                                  <button
                                    onClick={() => showMachineData(row.MAQ_ID, `/maquina/${row.MAQ_ID}/transacciones`, `Transacciones (MAQ_ID ${row.MAQ_ID})`)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Transacciones
                                  </button>
                                  <button
                                    onClick={() => showMachineData(row.MAQ_ID, `/registro-mantenimiento/maquina/${row.MAQ_ID}`, `Mantenimientos (MAQ_ID ${row.MAQ_ID})`)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Mantenimientos
                                  </button>
                                  <button
                                    onClick={() => showMachineData(row.MAQ_ID, `/recargo-maquina/maquina/${row.MAQ_ID}`, `Recargas (MAQ_ID ${row.MAQ_ID})`)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Recargas
                                  </button>
                                  <button
                                    onClick={() => showMachineData(row.MAQ_ID, `/detalle-saldo/maquina/${row.MAQ_ID}`, `Saldo y umbral (MAQ_ID ${row.MAQ_ID})`)}
                                    className="crudx-btn-secondary crudx-btn-xs"
                                  >
                                    Saldo
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {entity?.key === 'maquina' && machineView.maqId != null && (
                <div style={{ marginTop: 12 }} className="crudx-machine-box">
                  <div className="crudx-machine-head">
                    <strong>{machineView.title}</strong>
                    <button className="crudx-btn-secondary crudx-btn-xs" onClick={() => setMachineView({ maqId: null, title: '', rows: [] })}>Cerrar</button>
                  </div>
                  {machineView.rows.length === 0 ? (
                    <p className="crudx-empty">Sin registros para esta máquina.</p>
                  ) : (
                    <div className="crudx-table-scroll">
                      <table className="crudx-table">
                        <thead>
                          <tr>
                            {Object.keys(machineView.rows[0]).map((c) => (
                              <th key={c}>{getDbColumnLabel(c, CRUD_COLUMN_LABELS)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {machineView.rows.map((r, i) => (
                            <tr key={i}>
                              {Object.entries(r).map(([c, v]) => (
                                <td key={c} className="crudx-cell-ellipsis">
                                  {v == null ? '—'
                                    : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('es-GT')
                                    : String(v)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </div>

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
