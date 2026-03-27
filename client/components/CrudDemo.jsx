import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config.js';

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
        fields: [{ k:'TAR_ID',l:'ID' },{ k:'TAR_TIPO',l:'Tipo',req:true },{ k:'TAR_PRECIO',l:'Precio',t:'number',req:true },{ k:'TAR_TIEMPO_GRACIA',l:'Tiempo Gracia (min)',t:'number',req:true }],
        ops:{c:true,u:true,d:true} },
      { key: 'ticket', label: 'Ticket', id: 'TIC_ID',
        fields: [{ k:'TIC_ID',l:'ID',req:true },{ k:'TIC_CODIGO',l:'Código',req:true },{ k:'VEH_ID',l:'VEH_ID',req:true },{ k:'TIC_FECHA_HORA_ENTRADA',l:'Entrada',t:'datetime-local',req:true },{ k:'TIC_FECHA_HORA_SALIDA',l:'Salida',t:'datetime-local' },{ k:'ETI_ID',l:'ETI_ID',req:true },{ k:'COB_ID',l:'COB_ID' }],
        ops:{c:true,u:true,d:false}, updateFields:['TIC_FECHA_HORA_SALIDA','ETI_ID','COB_ID'] },
      { key: 'tipo-cobro', label: 'Tipo Cobro', id: 'TCO_ID',
        fields: [{ k:'TCO_ID',l:'ID' },{ k:'TCO_TIPO',l:'Tipo',req:true },{ k:'TCO_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'cobro', label: 'Cobro', id: 'COB_ID',
        fields: [{ k:'COB_ID',l:'ID',req:true },{ k:'COB_HORAS_TOTALES',l:'Horas',t:'number',req:true },{ k:'TCO_ID',l:'TCO_ID',req:true },{ k:'COB_MONTO_TOTAL',l:'Monto Total',t:'number',req:true },{ k:'COB_MONTO_RECIBIDO',l:'Monto Recibido',t:'number' },{ k:'COB_VUELTO',l:'Vuelto',t:'number' },{ k:'COB_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true },{ k:'COB_PROCESADO_MAQUINA',l:'Proc. Máq.',t:'checkbox' },{ k:'TAR_ID',l:'TAR_ID',req:true }],
        ops:{c:true,u:true,d:false} },
      { key: 'detalle-maquina-ticket', label: 'Det. Máq./Ticket', id: 'DMT_ID',
        fields: [{ k:'DMT_ID',l:'ID',req:true },{ k:'DMT_TRANSACCION',l:'Transacción' },{ k:'TIC_ID',l:'TIC_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true },{ k:'DMT_HORA_TRANSACCION',l:'Hora',t:'datetime-local' }],
        ops:{c:true,u:false,d:false} },
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
        fields: [{ k:'SDI_ID',l:'ID',req:true },{ k:'SDI_TIPO',l:'Tipo' },{ k:'SDI_VALOR',l:'Valor',t:'number' }],
        ops:{c:true,u:true,d:false} },
      { key: 'detalle-saldo', label: 'Detalle Saldo', id: 'DSA_ID',
        fields: [{ k:'DSA_ID',l:'ID' },{ k:'DSA_CANTIDAD',l:'Cantidad',t:'number' },{ k:'DSA_SUBTOTAL',l:'Subtotal',t:'number' },{ k:'DSA_UMBRAL_MINIMO',l:'Umbral mínimo',t:'number' },{ k:'SDI_ID',l:'SDI_ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID',req:true }],
        ops:{c:true,u:true,d:false}, updateFields:['DSA_UMBRAL_MINIMO'] },
      { key: 'maquina', label: 'Máquina', id: 'MAQ_ID',
        fields: [{ k:'MAQ_ID',l:'ID' },{ k:'MAQ_CODIGO',l:'Código',req:true },{ k:'TMA_ID',l:'TMA_ID',req:true },{ k:'EMA_ID',l:'EMA_ID',req:true },{ k:'MAQ_FECHA_ULTIMA_RECARGA',l:'Última Recarga',t:'datetime-local' }],
        ops:{c:true,u:true,d:false} },
      { key: 'recargo-maquina', label: 'Recargo Máquina', id: 'RMA_ID',
        fields: [{ k:'RMA_ID',l:'ID' },{ k:'MAQ_ID',l:'MAQ_ID',req:true },{ k:'RMA_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },{ k:'RMA_DESCRIPCION',l:'Descripción' },{ k:'RECARGA_DETALLE_SALDO',l:'Detalle billetes JSON' }],
        ops:{c:true,u:false,d:false} },
      { key: 'registro-mantenimiento', label: 'Reg. Mantenimiento', id: 'REM_ID',
        fields: [{ k:'REM_ID',l:'ID' },{ k:'MAQ_ID',l:'MAQ_ID',req:true },{ k:'REM_MANTENIMIENTO_FECHA',l:'Fecha',t:'datetime-local' },{ k:'REM_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:false,d:false} },
      { key: 'tipo-alerta', label: 'Tipo Alerta', id: 'TAL_ID',
        fields: [{ k:'TAL_ID',l:'ID',req:true },{ k:'TAL_TIPO',l:'Tipo',req:true },{ k:'TAL_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'estado-alerta', label: 'Estado Alerta', id: 'EAL_ID',
        fields: [{ k:'EAL_ID',l:'ID',req:true },{ k:'EAL_ESTADO',l:'Estado',req:true },{ k:'EAL_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:false,d:false} },
      { key: 'alerta', label: 'Alerta', id: 'ALE_ID',
        fields: [{ k:'ALE_ID',l:'ID',req:true },{ k:'MAQ_ID',l:'MAQ_ID' },{ k:'ALE_MOTIVO',l:'Motivo' },{ k:'ALE_DESCRIPCION',l:'Descripción' },{ k:'ALE_FECHA_HORA_GENERACION',l:'Generación',t:'datetime-local',req:true },{ k:'EAL_ID',l:'EAL_ID',req:true },{ k:'TAL_ID',l:'TAL_ID',req:true },{ k:'ALE_FECHA_ATENCION',l:'Atención',t:'datetime-local' }],
        ops:{c:true,u:true,d:false}, updateFields:['EAL_ID','ALE_FECHA_ATENCION'] },
    ],
  },
  'pa': {
    label: 'PA — Parqueo General',
    entities: [
      { key: 'rol', label: 'Rol', id: 'ROL_ID',
        fields: [{ k:'ROL_ID',l:'ID',req:true },{ k:'ROL_TIPO',l:'Tipo',req:true },{ k:'ROL_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true}, updateFields:['ROL_DESCRIPCION'] },
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
        fields: [{ k:'CLI_ID',l:'ID' },{ k:'CLI_PRIMER_NOMBRE',l:'Primer Nombre',req:true },{ k:'CLI_SEGUNDO_NOMBRE',l:'Segundo Nombre' },{ k:'CLI_PRIMER_APELLIDO',l:'Primer Apellido',req:true },{ k:'CLI_SEGUNDO_APELLIDO',l:'Segundo Apellido' },{ k:'CLI_DPI',l:'DPI',req:true },{ k:'CLI_NIT',l:'NIT' },{ k:'CLI_CORREO',l:'Correo' },{ k:'CLI_TELEFONO',l:'Teléfono' },{ k:'CLI_ZONA',l:'Zona' },{ k:'CLI_CALLE',l:'Calle' },{ k:'CLI_NUMERO',l:'Número' },{ k:'CLI_COLONIA',l:'Colonia' },{ k:'CLI_CIUDAD',l:'Ciudad' },{ k:'CLI_CODIGO_POSTAL',l:'Cód. Postal' },{ k:'CLI_ACTIVO',l:'Activo',t:'checkbox' }],
        ops:{c:true,u:true,d:false} },
      { key: 'tipo-vehiculo', label: 'Tipo Vehículo', id: 'TVE_ID',
        fields: [{ k:'TVE_ID',l:'ID',req:true },{ k:'TVE_TIPO',l:'Tipo',req:true },{ k:'TVE_MARCA',l:'Marca' },{ k:'TVE_DESCRIPCION',l:'Descripción' }],
        ops:{c:true,u:true,d:true} },
      { key: 'vehiculo', label: 'Vehículo', id: 'VEH_ID',
        fields: [{ k:'VEH_ID',l:'ID',req:true },{ k:'VEH_PLACA',l:'Placa',req:true },{ k:'VEH_MODELO',l:'Modelo' },{ k:'VEH_COLOR',l:'Color' },{ k:'TVE_ID',l:'TVE_ID',req:true },{ k:'CLI_ID',l:'CLI_ID' }],
        ops:{c:true,u:true,d:false} },
      { key: 'estado-membresia', label: 'Estado Membresía', id: 'EME_ID',
        fields: [{ k:'EME_ID',l:'ID',req:true },{ k:'EME_ESTADO',l:'Estado',req:true }],
        ops:{c:true,u:false,d:false} },
      { key: 'tipo-membresia', label: 'Tipo Membresía', id: 'TME_ID',
        fields: [{ k:'TME_ID',l:'ID',req:true },{ k:'TME_TIPO',l:'Tipo',req:true },{ k:'TME_DESCRIPCION',l:'Descripción' },{ k:'TME_DURACION',l:'Duración (días)',t:'number',req:true },{ k:'TME_PRECIO',l:'Precio',t:'number',req:true }],
        ops:{c:true,u:true,d:true} },
      { key: 'membresia', label: 'Membresía', id: 'MEM_ID',
        fields: [{ k:'MEM_ID',l:'ID',req:true },{ k:'TME_ID',l:'TME_ID',req:true },{ k:'MEM_FECHA_INICIO',l:'Inicio',t:'datetime-local',req:true,createOnly:true },{ k:'EME_ID',l:'EME_ID' },{ k:'MEM_FECHA_VENCIMIENTO',l:'Vencimiento',t:'datetime-local',req:true },{ k:'MEM_FECHA_ULTIMO_CAMBIO_ESTADO',l:'Último Cambio',t:'datetime-local' },{ k:'VEH_ID',l:'VEH_ID',req:true },{ k:'ESP_ID',l:'ESP_ID',req:true }],
        ops:{c:true,u:true,d:false} },
      { key: 'registro-movimiento-membresia', label: 'Reg. Mov. Membresía', id: 'RMM_ID',
        fields: [{ k:'RMM_ID',l:'ID',req:true },{ k:'RMM_FECHA_HORA_ENTRADA',l:'Entrada',t:'datetime-local' },{ k:'RMM_FECHA_HORA_SALIDA',l:'Salida',t:'datetime-local' },{ k:'MEM_ID',l:'MEM_ID',req:true }],
        ops:{c:true,u:false,d:false} },
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
        fields: [{ k:'BIV_ID',l:'ID',req:true },{ k:'BIV_DESCRIPCION',l:'Descripción' },{ k:'BIV_FECHA_HORA',l:'Fecha/Hora',t:'datetime-local',req:true },{ k:'VEH_ID',l:'VEH_ID',req:true },{ k:'INC_ID',l:'INC_ID',req:true },{ k:'BIV_RESUELTO',l:'Resuelto',t:'checkbox' },{ k:'BIV_FECHA_RESOLUCION',l:'Fecha Resolución',t:'datetime-local' },{ k:'USU_ID',l:'USU_ID' }],
        ops:{c:true,u:true,d:false}, updateFields:['BIV_RESUELTO','BIV_FECHA_RESOLUCION','USU_ID'] },
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

// ── HELPERS ───────────────────────────────────────────────────
function toInput(v, t) {
  if (!v) return '';
  try { const d = new Date(v); if (isNaN(d)) return ''; return t === 'date' ? d.toISOString().slice(0,10) : d.toISOString().slice(0,16); } catch { return ''; }
}
function emptyForm(fields) {
  return Object.fromEntries(fields.map(f => [f.k, f.t === 'checkbox' ? 0 : '']));
}
function preparePayload(fields, form) {
  const out = {};
  fields.forEach(f => {
    const v = form[f.k];
    if (f.t === 'checkbox') out[f.k] = v ? 1 : 0;
    else if (f.t === 'number') out[f.k] = v !== '' && v != null ? Number(v) : null;
    else if (f.t === 'datetime-local' || f.t === 'date') out[f.k] = v ? new Date(v).toISOString() : null;
    else out[f.k] = v || null;
  });
  return out;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

// ── COMPONENT ─────────────────────────────────────────────────
/**
 * @param {{ filterEntityKeys?: string[] }} props
 * Si `filterEntityKeys` está definido, se ocultan las pestañas ME-MS / MC / PA y solo se listan esas entidades.
 */
export default function CrudDemo({ filterEntityKeys = null }) {
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
  const [machineView, setMachineView] = useState({ maqId: null, title: '', rows: [] });

  useEffect(() => {
    if (entity) load();
  }, [entity]); // eslint-disable-line react-hooks/exhaustive-deps -- recargar solo al cambiar entidad

  async function load() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/${entity.key}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { setMsg('Error: ' + e.message); setRows([]); }
    finally { setLoading(false); }
  }

  function selectSection(s) {
    setSection(s); setEntity(null); setRows([]); setEditId(null); setMsg('');
  }

  function selectEntity(e) {
    setEntity(e); setEditId(null); setForm(emptyForm(e.fields)); setMsg('');
  }

  function startEdit(row) {
    const fields = entity.updateFields
      ? entity.fields.filter(f => f.k === entity.id || entity.updateFields.includes(f.k))
      : entity.fields;
    const f = {};
    fields.forEach(fd => {
      const v = row[fd.k];
      if (fd.t === 'checkbox') f[fd.k] = v == 1 ? 1 : 0;
      else if (fd.t === 'datetime-local' || fd.t === 'date') f[fd.k] = toInput(v, fd.t);
      else f[fd.k] = v ?? '';
    });
    setForm(f); setEditId(row[entity.id]);
  }

  function cancelEdit() { setEditId(null); setForm(emptyForm(entity.fields)); }

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
      isEdit && entity.updateFields
        ? entity.fields.filter(f => f.k === entity.id || entity.updateFields.includes(f.k))
        : entity.fields.filter(f => !(isEdit && f.createOnly));
    const payload = preparePayload(fieldsToUse, form);
    try {
      const res = await fetch(
        `${API_BASE}/${entity.key}${isEdit ? '/' + editId : ''}`,
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setMsg(isEdit ? 'Actualizado.' : 'Creado.');
      cancelEdit(); load();
    } catch (err) { setMsg('Error: ' + err.message); }
  }

  async function del(id) {
    if (!confirm(`¿Eliminar "${id}"?`)) return;
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

  const sectionEntities = filteredEntities ?? (SECTIONS[section]?.entities ?? []);
  const isNewRecord = editId === '__new__';
  const formFields = entity
    ? !isNewRecord && editId && entity.updateFields
        ? entity.fields.filter(f => f.k === entity.id || entity.updateFields.includes(f.k))
        : entity.fields.filter(f => !(editId && !isNewRecord && f.createOnly))
    : [];

  const visibleFormFields = formFields;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'system-ui,sans-serif', fontSize:14 }}>

      {/* Tabs (demo completo; oculto en módulos del panel admin) */}
      {!filteredEntities && (
        <div style={{ padding:'8px 12px', borderBottom:'1px solid #ccc', display:'flex', gap:8 }}>
          {Object.entries(SECTIONS).map(([k, s]) => (
            <button key={k} onClick={() => selectSection(k)}
              style={{ padding:'5px 12px', cursor:'pointer', fontWeight: section===k ? 700 : 400,
                background: section===k ? '#222' : '#fff', color: section===k ? '#fff' : '#222',
                border:'1px solid #999', borderRadius:4 }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Sidebar */}
        <div style={{ width:170, borderRight:'1px solid #ccc', overflowY:'auto', padding:'4px 0' }}>
          {sectionEntities.map(e => (
            <button key={e.key} onClick={() => selectEntity(e)}
              style={{ display:'block', width:'100%', textAlign:'left', border:'none', background: entity?.key === e.key ? '#e8f0fe' : 'transparent',
                padding:'7px 12px', cursor:'pointer',
                fontWeight: entity?.key === e.key ? 700 : 400,
                borderLeft: entity?.key === e.key ? '3px solid #1a73e8' : '3px solid transparent' }}>
              {e.label}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          {!entity && <p style={{ color:'#888' }}>Selecciona una entidad</p>}

          {entity && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <strong>{entity.label}</strong>
                {entity.ops.c && !editId && (
                  <button onClick={() => { setEditId('__new__'); setForm(emptyForm(entity.fields)); }}
                    style={{ padding:'4px 10px', cursor:'pointer' }}>
                    + Nuevo
                  </button>
                )}
                {msg && <span style={{ color: msg.startsWith('Error') ? 'red' : 'green' }}>{msg}</span>}
              </div>

              {/* Form */}
              {editId && (
                <form onSubmit={save} style={{ background:'#f9f9f9', border:'1px solid #ddd', borderRadius:4, padding:12, marginBottom:12, display:'flex', flexWrap:'wrap', gap:8 }}>
                  <div style={{ width:'100%', marginBottom:4 }}>
                    <strong>{editId === '__new__' ? 'Nuevo registro' : `Editando: ${editId}`}</strong>
                  </div>
                  {isNewRecord && (
                    <div style={{ width:'100%', fontSize:12, color:'#555', marginBottom:4 }}>
                      El ID se genera automaticamente al guardar.
                    </div>
                  )}
                  {visibleFormFields.map(f => (
                    <div key={f.k} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      <label style={{ fontSize:11, color:'#666' }}>{f.l}{f.req ? ' *' : ''}</label>
                      {f.t === 'checkbox' ? (
                        <input type="checkbox" checked={!!form[f.k]}
                          onChange={ev => setForm(p => ({ ...p, [f.k]: ev.target.checked ? 1 : 0 }))} />
                      ) : (
                        <input
                          type={f.t === 'password' && editId !== '__new__' ? 'text' : (f.t || 'text')}
                          value={form[f.k] ?? ''}
                          placeholder={isNewRecord && f.k === entity?.id ? 'Se genera automaticamente al guardar' : ''}
                          required={!!f.req}
                          disabled={(f.k === entity.id && editId !== '__new__') || (isNewRecord && f.k === entity?.id)}
                          style={{ padding:'4px 6px', border:'1px solid #ccc', borderRadius:3, width: f.t === 'datetime-local' ? 175 : 130 }}
                          onChange={ev => setForm(p => ({ ...p, [f.k]: ev.target.value }))} />
                      )}
                    </div>
                  ))}
                  <div style={{ width:'100%', display:'flex', gap:8, marginTop:4 }}>
                    <button type="submit" style={{ padding:'5px 12px', cursor:'pointer' }}>Guardar</button>
                    <button type="button" onClick={cancelEdit} style={{ padding:'5px 12px', cursor:'pointer' }}>Cancelar</button>
                  </div>
                </form>
              )}

              {/* Table */}
              {loading ? <p>Cargando…</p> : rows.length === 0 ? <p style={{ color:'#888' }}>Sin registros</p> : (
                <table style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f0f0f0' }}>
                      {Object.keys(rows[0]).map(c => <th key={c} style={{ padding:'6px 8px', textAlign:'left', border:'1px solid #ddd', whiteSpace:'nowrap' }}>{c}</th>)}
                      {(entity.ops.u || entity.ops.d || entity.key === 'membresia') && <th style={{ padding:'6px 8px', border:'1px solid #ddd' }}>Acc.</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ background: i%2 ? '#fafafa' : '#fff' }}>
                        {Object.entries(row).map(([c, v]) => (
                          <td key={c} style={{ padding:'5px 8px', border:'1px solid #eee', whiteSpace:'nowrap', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                            {v == null ? '—'
                              : c === 'USU_PASSWORD' ? '••••'
                              : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('es-GT')
                              : String(v)}
                          </td>
                        ))}
                        {(entity.ops.u || entity.ops.d || entity.key === 'membresia') && (
                          <td style={{ padding:'4px 8px', border:'1px solid #eee', whiteSpace:'nowrap' }}>
                            {entity.ops.u && <button onClick={() => startEdit(row)} style={{ marginRight:4, cursor:'pointer', padding:'2px 8px' }}>Editar</button>}
                            {entity.ops.d && <button onClick={() => del(row[entity.id])} style={{ cursor:'pointer', padding:'2px 8px', color:'red' }}>Eliminar</button>}
                            {entity.key === 'cliente' && Number(row.CLI_ACTIVO ?? 1) === 1 && (
                              <button
                                onClick={() => deactivateCliente(row)}
                                style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                              >
                                Desactivar
                              </button>
                            )}
                            {entity.key === 'usuario' && Number(row.USU_ACTIVO ?? 1) === 1 && (
                              <button
                                onClick={() => deactivateUsuario(row)}
                                style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                              >
                                Desactivar
                              </button>
                            )}
                            {entity.key === 'membresia' && (
                              <button
                                onClick={() => downloadTag(row)}
                                style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                              >
                                Descargar Tag
                              </button>
                            )}
                            {entity.key === 'maquina' && (
                              <>
                                <button
                                  onClick={() => showMachineData(row.MAQ_ID, `/maquina/${row.MAQ_ID}/transacciones`, `Transacciones (MAQ_ID ${row.MAQ_ID})`)}
                                  style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                                >
                                  Transacciones
                                </button>
                                <button
                                  onClick={() => showMachineData(row.MAQ_ID, `/registro-mantenimiento/maquina/${row.MAQ_ID}`, `Mantenimientos (MAQ_ID ${row.MAQ_ID})`)}
                                  style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                                >
                                  Mantenimientos
                                </button>
                                <button
                                  onClick={() => showMachineData(row.MAQ_ID, `/recargo-maquina/maquina/${row.MAQ_ID}`, `Recargas (MAQ_ID ${row.MAQ_ID})`)}
                                  style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
                                >
                                  Recargas
                                </button>
                                <button
                                  onClick={() => showMachineData(row.MAQ_ID, `/detalle-saldo/maquina/${row.MAQ_ID}`, `Saldo y umbral (MAQ_ID ${row.MAQ_ID})`)}
                                  style={{ marginLeft:4, cursor:'pointer', padding:'2px 8px' }}
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
              )}
              {entity?.key === 'maquina' && machineView.maqId != null && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <strong>{machineView.title}</strong>
                    <button onClick={() => setMachineView({ maqId: null, title: '', rows: [] })}>Cerrar</button>
                  </div>
                  {machineView.rows.length === 0 ? (
                    <p style={{ color:'#777' }}>Sin registros para esta máquina.</p>
                  ) : (
                    <table style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f0f0f0' }}>
                          {Object.keys(machineView.rows[0]).map(c => (
                            <th key={c} style={{ padding:'6px 8px', textAlign:'left', border:'1px solid #ddd', whiteSpace:'nowrap' }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {machineView.rows.map((r, i) => (
                          <tr key={i} style={{ background: i%2 ? '#fafafa' : '#fff' }}>
                            {Object.entries(r).map(([c, v]) => (
                              <td key={c} style={{ padding:'5px 8px', border:'1px solid #eee', whiteSpace:'nowrap', maxWidth:230, overflow:'hidden', textOverflow:'ellipsis' }}>
                                {v == null ? '—'
                                  : typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('es-GT')
                                  : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
