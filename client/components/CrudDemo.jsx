import { useState, useEffect } from 'react';
import { API_BASE } from '../config.js';

const toArr = (data) => (Array.isArray(data) ? data : []);

export default function CrudDemo() {
  const [clientes, setClientes] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [estadoEspacio, setEstadoEspacio] = useState([]);
  const [estadoMaquina, setEstadoMaquina] = useState([]);
  const [tipoMaquina, setTipoMaquina] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [tipoVehiculos, setTipoVehiculos] = useState([]);
  const [registroMovimientoMembresias, setRegistroMovimientoMembresias] = useState([]);
  const [tipoMembresias, setTipoMembresias] = useState([]);
  const [estadoMembresias, setEstadoMembresias] = useState([]);
  const [tipoCobros, setTipoCobros] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [tipoAlertas, setTipoAlertas] = useState([]);
  const [estadoAlertas, setEstadoAlertas] = useState([]);
  const [alertas, setAlertas] = useState([]);

  const [loading, setLoading] = useState({
    clientes: true, espacios: true, estadoEspacio: true, estadoMaquina: true,
    tipoMaquina: true, roles: true, usuarios: true, vehiculos: true, tipoVehiculos: true, registroMovimientoMembresias: true, tipoMembresias: true, estadoMembresias: true, tipoCobros: true, cobros: true, tarifas: true, tipoAlertas: true, estadoAlertas: true, alertas: true,
  });
  const [error, setError] = useState('');

  const [editCliente, setEditCliente] = useState(null);
  const [editEspacio, setEditEspacio] = useState(null);
  const [editEstadoMaquina, setEditEstadoMaquina] = useState(null);
  const [editTipoMaquina, setEditTipoMaquina] = useState(null);
  const [editRol, setEditRol] = useState(null);
  const [editUsuario, setEditUsuario] = useState(null);
  const [editVehiculo, setEditVehiculo] = useState(null);
  const [editTipoVehiculo, setEditTipoVehiculo] = useState(null);
  const [editTipoMembresia, setEditTipoMembresia] = useState(null);
  const [editTipoCobro, setEditTipoCobro] = useState(null);
  const [editTarifa, setEditTarifa] = useState(null);
  const [editTipoAlerta, setEditTipoAlerta] = useState(null);
  const [editAlerta, setEditAlerta] = useState(null);

  const emptyCliente = {
    CLI_ID: '', CLI_PRIMER_NOMBRE: '', CLI_SEGUNDO_NOMBRE: '',
    CLI_PRIMER_APELLIDO: '', CLI_SEGUNDO_APELLIDO: '', CLI_DPI: '', CLI_NIT: '',
    CLI_CORREO: '', CLI_TELEFONO: '', CLI_ZONA: '', CLI_CALLE: '', CLI_NUMERO: '',
    CLI_COLONIA: '', CLI_CIUDAD: '', CLI_CODIGO_POSTAL: '', CLI_ACTIVO: 1,
  };
  const [formCliente, setFormCliente] = useState(emptyCliente);
  const [formEspacio, setFormEspacio] = useState({
    ESP_ID: '', ESP_CODIGO: '', EES_ID: '', ESP_UBICACION: '',
  });
  const [formEstadoEspacio, setFormEstadoEspacio] = useState({ EES_ID: '', EES_ESTADO: '' });
  const [formEstadoMaquina, setFormEstadoMaquina] = useState({
    EMA_ID: '', EMA_ESTADO: '', EMA_DESCRIPCION: '',
  });
  const [formTipoMaquina, setFormTipoMaquina] = useState({
    TMA_ID: '', TMA_TIPO: '', TMA_DESCRIPCION: '',
  });
  const [formRol, setFormRol] = useState({
    ROL_ID: '', ROL_TIPO: '', ROL_DESCRIPCION: '',
  });
  const [formUsuario, setFormUsuario] = useState({
    USU_ID: '', USU_PRIMER_NOMBRE: '', USU_SEGUNDO_NOMBRE: '',
    USU_PRIMER_APELLIDO: '', USU_SEGUNDO_APELLIDO: '', USU_CORREO: '',
    USU_PASSWORD: '', USU_TELEFONO: '', ROL_ID: '', USU_ACTIVO: 1,
  });

  const [formVehiculo, setFormVehiculo] = useState({ VEH_ID: '', VEH_PLACA: '', VEH_MODELO: '', VEH_COLOR: '', TVE_ID: '', CLI_ID: '' });
  const [formTipoVehiculo, setFormTipoVehiculo] = useState({ TVE_ID: '', TVE_TIPO: '', TVE_MARCA: '', TVE_DESCRIPCION: '' });
  const [formRegistroMovimientoMembresia, setFormRegistroMovimientoMembresia] = useState({ RMM_ID: '', RMM_FECHA_HORA_ENTRADA: '', RMM_FECHA_HORA_SALIDA: '', MEM_ID: '' });
  const [formTipoMembresia, setFormTipoMembresia] = useState({ TME_ID: '', TME_TIPO: '', TME_DESCRIPCION: '', TME_DURACION: '', TME_PRECIO: '' });
  const [formEstadoMembresia, setFormEstadoMembresia] = useState({ EME_ID: '', EME_ESTADO: '' });
  const [formTipoCobro, setFormTipoCobro] = useState({ TCO_ID: '', TCO_TIPO: '', TCO_DESCRIPCION: '' });
  const [formCobro, setFormCobro] = useState({ COB_ID: '', COB_HORAS_TOTALES: '', TCO_ID: '', COB_MONTO_TOTAL: '', COB_MONTO_RECIBIDO: '', COB_VUELTO: '', COB_FECHA_HORA: '', COB_PROCESADO_MAQUINA: 0, TAR_ID: '' });
  const [formTarifa, setFormTarifa] = useState({ TAR_ID: '', TAR_TIPO: '', TAR_PRECIO: '' });
  const [formTipoAlerta, setFormTipoAlerta] = useState({ TAL_ID: '', TAL_TIPO: '', TAL_DESCRIPCION: '' });
  const [formEstadoAlerta, setFormEstadoAlerta] = useState({ EAL_ID: '', EAL_ESTADO: '', EAL_DESCRIPCION: '' });
  const [formAlerta, setFormAlerta] = useState({ ALE_ID: '', MAQ_ID: '', ALE_MOTIVO: '', ALE_DESCRIPCION: '', ALE_FECHA_HORA_GENERACION: '', EAL_ID: '', TAL_ID: '', ALE_FECHA_ATENCION: '' });

  const api = (path, opt = {}) =>
    fetch(`${API_BASE}${path}`, { ...opt, headers: { 'Content-Type': 'application/json', ...opt.headers } });

  const fetchAll = (key, path) => async () => {
    setLoading((l) => ({ ...l, [key]: true }));
    setError('');
    try {
      const res = await api(path);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      return toArr(data);
    } catch (e) {
      setError((err) => (err ? err + ' | ' : '') + `${key}: ${e.message}`);
      return [];
    } finally {
      setLoading((l) => ({ ...l, [key]: false }));
    }
  };

  const fetchClientes = fetchAll('clientes', '/cliente');
  const fetchEspacios = fetchAll('espacios', '/espacio');
  const fetchEstadoEspacio = fetchAll('estadoEspacio', '/estado-espacio');
  const fetchEstadoMaquina = fetchAll('estadoMaquina', '/estado-maquina');
  const fetchTipoMaquina = fetchAll('tipoMaquina', '/tipo-maquina');
  const fetchRoles = fetchAll('roles', '/rol');
  const fetchUsuarios = fetchAll('usuarios', '/usuario');
  const fetchVehiculos = fetchAll('vehiculos', '/vehiculo');
  const fetchTipoVehiculos = fetchAll('tipoVehiculos', '/tipo-vehiculo');
  const fetchRegistroMovimientoMembresias = fetchAll('registroMovimientoMembresias', '/registro-movimiento-membresia');
  const fetchTipoMembresias = fetchAll('tipoMembresias', '/tipo-membresia');
  const fetchEstadoMembresias = fetchAll('estadoMembresias', '/estado-membresia');
  const fetchTipoCobros = fetchAll('tipoCobros', '/tipo-cobro');
  const fetchCobros = fetchAll('cobros', '/cobro');
  const fetchTarifas = fetchAll('tarifas', '/tarifa');
  const fetchTipoAlertas = fetchAll('tipoAlertas', '/tipo-alerta');
  const fetchEstadoAlertas = fetchAll('estadoAlertas', '/estado-alerta');
  const fetchAlertas = fetchAll('alertas', '/alerta');

  useEffect(() => {
    (async () => {
      setClientes(await fetchClientes());
      setEspacios(await fetchEspacios());
      setEstadoEspacio(await fetchEstadoEspacio());
      setEstadoMaquina(await fetchEstadoMaquina());
      setTipoMaquina(await fetchTipoMaquina());
      setRoles(await fetchRoles());
      setUsuarios(await fetchUsuarios());
      setVehiculos(await fetchVehiculos());
      setTipoVehiculos(await fetchTipoVehiculos());
      setRegistroMovimientoMembresias(await fetchRegistroMovimientoMembresias());
      setTipoMembresias(await fetchTipoMembresias());
      setEstadoMembresias(await fetchEstadoMembresias());
      setTipoCobros(await fetchTipoCobros());
      setCobros(await fetchCobros());
      setTarifas(await fetchTarifas());
      setTipoAlertas(await fetchTipoAlertas());
      setEstadoAlertas(await fetchEstadoAlertas());
      setAlertas(await fetchAlertas());
    })();
  }, []);

  const handleSaveCliente = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formCliente,
      CLI_ACTIVO: formCliente.CLI_ACTIVO ? 1 : 0,
    };
    try {
      if (editCliente != null) {
        const res = await api(`/cliente/${editCliente.CLI_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/cliente', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditCliente(null);
      setFormCliente(emptyCliente);
      setClientes(await fetchClientes());
    } catch (e) {
      setError('Cliente: ' + e.message);
    }
  };

  const handleSaveEspacio = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formEspacio,
      EES_ID: formEspacio.EES_ID || null,
    };
    try {
      if (editEspacio != null) {
        const res = await api(`/espacio/${editEspacio.ESP_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/espacio', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditEspacio(null);
      setFormEspacio({ ESP_ID: '', ESP_CODIGO: '', EES_ID: '', ESP_UBICACION: '' });
      setEspacios(await fetchEspacios());
    } catch (e) {
      setError('Espacio: ' + e.message);
    }
  };

  const handleSaveEstadoEspacio = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api('/estado-espacio', { method: 'POST', body: JSON.stringify(formEstadoEspacio) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setFormEstadoEspacio({ EES_ID: '', EES_ESTADO: '' });
      setEstadoEspacio(await fetchEstadoEspacio());
    } catch (e) {
      setError('Estado espacio: ' + e.message);
    }
  };

  const handleSaveEstadoMaquina = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...formEstadoMaquina };
    try {
      if (editEstadoMaquina != null) {
        const res = await api(`/estado-maquina/${editEstadoMaquina.EMA_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/estado-maquina', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditEstadoMaquina(null);
      setFormEstadoMaquina({ EMA_ID: '', EMA_ESTADO: '', EMA_DESCRIPCION: '' });
      setEstadoMaquina(await fetchEstadoMaquina());
    } catch (e) {
      setError('Estado máquina: ' + e.message);
    }
  };

  const handleSaveTipoMaquina = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...formTipoMaquina };
    try {
      if (editTipoMaquina != null) {
        const res = await api(`/tipo-maquina/${editTipoMaquina.TMA_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tipo-maquina', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTipoMaquina(null);
      setFormTipoMaquina({ TMA_ID: '', TMA_TIPO: '', TMA_DESCRIPCION: '' });
      setTipoMaquina(await fetchTipoMaquina());
    } catch (e) {
      setError('Tipo máquina: ' + e.message);
    }
  };

  const handleSaveRol = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...formRol };
    try {
      if (editRol != null) {
        const res = await api(`/rol/${editRol.ROL_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/rol', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditRol(null);
      setFormRol({ ROL_ID: '', ROL_TIPO: '', ROL_DESCRIPCION: '' });
      setRoles(await fetchRoles());
    } catch (e) {
      setError('Rol: ' + e.message);
    }
  };

  const handleSaveUsuario = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formUsuario,
      USU_ACTIVO: formUsuario.USU_ACTIVO ? 1 : 0,
    };
    try {
      if (editUsuario != null) {
        const res = await api(`/usuario/${editUsuario.USU_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/usuario', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditUsuario(null);
      setFormUsuario({
        USU_ID: '', USU_PRIMER_NOMBRE: '', USU_SEGUNDO_NOMBRE: '',
        USU_PRIMER_APELLIDO: '', USU_SEGUNDO_APELLIDO: '', USU_CORREO: '',
        USU_PASSWORD: '', USU_TELEFONO: '', ROL_ID: '', USU_ACTIVO: 1,
      });
      setUsuarios(await fetchUsuarios());
    } catch (e) {
      setError('Usuario: ' + e.message);
    }
  };

  const handleSaveVehiculo = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formVehiculo,
      CLI_ID: formVehiculo.CLI_ID || null,
    };
    try {
      if (editVehiculo != null) {
        const res = await api(`/vehiculo/${editVehiculo.VEH_ID}`, { method: 'PUT', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/vehiculo', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditVehiculo(null);
      setFormVehiculo({ VEH_ID: '', VEH_PLACA: '', VEH_MODELO: '', VEH_COLOR: '', TVE_ID: '', CLI_ID: '' });
      setVehiculos(await fetchVehiculos());
    } catch (e) {
      setError('Vehículo: ' + e.message);
    }
  };

  const handleSaveTipoVehiculo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editTipoVehiculo != null) {
        const res = await api(`/tipo-vehiculo/${editTipoVehiculo.TVE_ID}`, { method: 'PUT', body: JSON.stringify(formTipoVehiculo) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tipo-vehiculo', { method: 'POST', body: JSON.stringify(formTipoVehiculo) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTipoVehiculo(null);
      setFormTipoVehiculo({ TVE_ID: '', TVE_TIPO: '', TVE_MARCA: '', TVE_DESCRIPCION: '' });
      setTipoVehiculos(await fetchTipoVehiculos());
    } catch (e) {
      setError('Tipo Vehículo: ' + e.message);
    }
  };

  const handleSaveRegistroMovimientoMembresia = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api('/registro-movimiento-membresia', { method: 'POST', body: JSON.stringify(formRegistroMovimientoMembresia) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setFormRegistroMovimientoMembresia({ RMM_ID: '', RMM_FECHA_HORA_ENTRADA: '', RMM_FECHA_HORA_SALIDA: '', MEM_ID: '' });
      setRegistroMovimientoMembresias(await fetchRegistroMovimientoMembresias());
    } catch (e) {
      setError('Registro Movimiento Membresía: ' + e.message);
    }
  };

  const handleSaveTipoMembresia = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editTipoMembresia != null) {
        const res = await api(`/tipo-membresia/${editTipoMembresia.TME_ID}`, { method: 'PUT', body: JSON.stringify(formTipoMembresia) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tipo-membresia', { method: 'POST', body: JSON.stringify(formTipoMembresia) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTipoMembresia(null);
      setFormTipoMembresia({ TME_ID: '', TME_TIPO: '', TME_DESCRIPCION: '', TME_DURACION: '', TME_PRECIO: '' });
      setTipoMembresias(await fetchTipoMembresias());
    } catch (e) {
      setError('Tipo Membresía: ' + e.message);
    }
  };

  const handleSaveEstadoMembresia = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api('/estado-membresia', { method: 'POST', body: JSON.stringify(formEstadoMembresia) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setFormEstadoMembresia({ EME_ID: '', EME_ESTADO: '' });
      setEstadoMembresias(await fetchEstadoMembresias());
    } catch (e) {
      setError('Estado Membresía: ' + e.message);
    }
  };

  const handleSaveTipoCobro = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editTipoCobro != null) {
        const res = await api(`/tipo-cobro/${editTipoCobro.TCO_ID}`, { method: 'PUT', body: JSON.stringify(formTipoCobro) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tipo-cobro', { method: 'POST', body: JSON.stringify(formTipoCobro) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTipoCobro(null);
      setFormTipoCobro({ TCO_ID: '', TCO_TIPO: '', TCO_DESCRIPCION: '' });
      setTipoCobros(await fetchTipoCobros());
    } catch (e) {
      setError('Tipo Cobro: ' + e.message);
    }
  };

  const handleSaveCobro = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formCobro,
      COB_PROCESADO_MAQUINA: formCobro.COB_PROCESADO_MAQUINA ? 1 : 0,
    };
    try {
      const res = await api('/cobro', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setFormCobro({ COB_ID: '', COB_HORAS_TOTALES: '', TCO_ID: '', COB_MONTO_TOTAL: '', COB_MONTO_RECIBIDO: '', COB_VUELTO: '', COB_FECHA_HORA: '', COB_PROCESADO_MAQUINA: 0, TAR_ID: '' });
      setCobros(await fetchCobros());
    } catch (e) {
      setError('Cobro: ' + e.message);
    }
  };

  const handleSaveTarifa = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editTarifa != null) {
        const res = await api(`/tarifa/${editTarifa.TAR_ID}`, { method: 'PUT', body: JSON.stringify(formTarifa) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tarifa', { method: 'POST', body: JSON.stringify(formTarifa) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTarifa(null);
      setFormTarifa({ TAR_ID: '', TAR_TIPO: '', TAR_PRECIO: '' });
      setTarifas(await fetchTarifas());
    } catch (e) {
      setError('Tarifa: ' + e.message);
    }
  };

  const handleSaveTipoAlerta = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editTipoAlerta != null) {
        const res = await api(`/tipo-alerta/${editTipoAlerta.TAL_ID}`, { method: 'PUT', body: JSON.stringify(formTipoAlerta) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/tipo-alerta', { method: 'POST', body: JSON.stringify(formTipoAlerta) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditTipoAlerta(null);
      setFormTipoAlerta({ TAL_ID: '', TAL_TIPO: '', TAL_DESCRIPCION: '' });
      setTipoAlertas(await fetchTipoAlertas());
    } catch (e) {
      setError('Tipo Alerta: ' + e.message);
    }
  };

  const handleSaveEstadoAlerta = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api('/estado-alerta', { method: 'POST', body: JSON.stringify(formEstadoAlerta) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      setFormEstadoAlerta({ EAL_ID: '', EAL_ESTADO: '', EAL_DESCRIPCION: '' });
      setEstadoAlertas(await fetchEstadoAlertas());
    } catch (e) {
      setError('Estado Alerta: ' + e.message);
    }
  };

  const handleSaveAlerta = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formAlerta,
      MAQ_ID: formAlerta.MAQ_ID || null,
      ALE_FECHA_ATENCION: formAlerta.ALE_FECHA_ATENCION || null,
    };
    try {
      if (editAlerta != null) {
        const res = await api(`/alerta/${editAlerta.ALE_ID}`, { method: 'PUT', body: JSON.stringify({ EAL_ID: payload.EAL_ID, ALE_FECHA_ATENCION: payload.ALE_FECHA_ATENCION }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      } else {
        const res = await api('/alerta', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      }
      setEditAlerta(null);
      setFormAlerta({ ALE_ID: '', MAQ_ID: '', ALE_MOTIVO: '', ALE_DESCRIPCION: '', ALE_FECHA_HORA_GENERACION: '', EAL_ID: '', TAL_ID: '', ALE_FECHA_ATENCION: '' });
      setAlertas(await fetchAlertas());
    } catch (e) {
      setError('Alerta: ' + e.message);
    }
  };

  const handleDelete = (path, id, fetchList, setListState) => async () => {
    if (!confirm('¿Eliminar?')) return;
    setError('');
    try {
      const res = await api(`${path}/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText);
      const list = await fetchList();
      setListState(list);
    } catch (e) {
      setError('Eliminar: ' + e.message);
    }
  };

  const listItem = (item, onEdit, onDelete, label) => (
    <li key={item.id ?? item.CLI_ID ?? item.ESP_ID ?? item.EES_ID ?? item.EMA_ID ?? item.TMA_ID ?? item.ROL_ID ?? item.USU_ID ?? item.VEH_ID ?? item.TVE_ID ?? item.RMM_ID ?? item.TME_ID ?? item.EME_ID ?? item.TCO_ID ?? item.COB_ID ?? item.TAR_ID ?? item.TAL_ID ?? item.EAL_ID ?? item.ALE_ID} className="crud-list-item">
      <span>{label}</span>
      <div className="crud-list-actions">
        <button type="button" className="btn-editar" onClick={() => onEdit(item)}>Editar</button>
        {onDelete && (
          <button type="button" className="btn-eliminar" onClick={onDelete}>Eliminar</button>
        )}
      </div>
    </li>
  );

  return (
    <div className="crud-demo">
      <h2 className="crud-title">Gestión de Datos (CRUD)</h2>
      {error && <div className="crud-error">{error}</div>}

      {/* Clientes */}
      <section className="crud-section">
        <h3>Clientes</h3>
        {loading.clientes ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {clientes.length === 0 ? <li className="crud-list-empty">No hay clientes.</li> : clientes.map((c) =>
              listItem(c, (x) => {
                setEditCliente(x);
                setFormCliente({
                  CLI_ID: x.CLI_ID ?? '', CLI_PRIMER_NOMBRE: x.CLI_PRIMER_NOMBRE ?? '', CLI_SEGUNDO_NOMBRE: x.CLI_SEGUNDO_NOMBRE ?? '',
                  CLI_PRIMER_APELLIDO: x.CLI_PRIMER_APELLIDO ?? '', CLI_SEGUNDO_APELLIDO: x.CLI_SEGUNDO_APELLIDO ?? '', CLI_DPI: x.CLI_DPI ?? '', CLI_NIT: x.CLI_NIT ?? '',
                  CLI_CORREO: x.CLI_CORREO ?? '', CLI_TELEFONO: x.CLI_TELEFONO ?? '', CLI_ZONA: x.CLI_ZONA ?? '', CLI_CALLE: x.CLI_CALLE ?? '', CLI_NUMERO: x.CLI_NUMERO ?? '',
                  CLI_COLONIA: x.CLI_COLONIA ?? '', CLI_CIUDAD: x.CLI_CIUDAD ?? '', CLI_CODIGO_POSTAL: x.CLI_CODIGO_POSTAL ?? '', CLI_ACTIVO: x.CLI_ACTIVO ?? 1,
                });
              }, null,
                `ID: ${c.CLI_ID} — ${c.CLI_PRIMER_NOMBRE} ${c.CLI_PRIMER_APELLIDO} — DPI: ${c.CLI_DPI} — ${c.CLI_CORREO ?? '-'} — Tel: ${c.CLI_TELEFONO ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editCliente ? 'Editar cliente' : 'Agregar cliente'}</h4>
          <form onSubmit={handleSaveCliente} className="crud-form crud-form-cliente">
            <input placeholder="ID" value={formCliente.CLI_ID} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_ID: e.target.value }))} disabled={editCliente != null} />
            <input placeholder="Primer nombre" value={formCliente.CLI_PRIMER_NOMBRE} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_PRIMER_NOMBRE: e.target.value }))} required />
            <input placeholder="Segundo nombre" value={formCliente.CLI_SEGUNDO_NOMBRE} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_SEGUNDO_NOMBRE: e.target.value }))} />
            <input placeholder="Primer apellido" value={formCliente.CLI_PRIMER_APELLIDO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_PRIMER_APELLIDO: e.target.value }))} required />
            <input placeholder="Segundo apellido" value={formCliente.CLI_SEGUNDO_APELLIDO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_SEGUNDO_APELLIDO: e.target.value }))} />
            <input placeholder="DPI" value={formCliente.CLI_DPI} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_DPI: e.target.value }))} required />
            <input placeholder="NIT" value={formCliente.CLI_NIT} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_NIT: e.target.value }))} />
            <input placeholder="Correo" type="email" value={formCliente.CLI_CORREO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_CORREO: e.target.value }))} />
            <input placeholder="Teléfono" value={formCliente.CLI_TELEFONO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_TELEFONO: e.target.value }))} />
            <input placeholder="Zona" value={formCliente.CLI_ZONA} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_ZONA: e.target.value }))} />
            <input placeholder="Calle" value={formCliente.CLI_CALLE} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_CALLE: e.target.value }))} />
            <input placeholder="Número" value={formCliente.CLI_NUMERO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_NUMERO: e.target.value }))} />
            <input placeholder="Colonia" value={formCliente.CLI_COLONIA} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_COLONIA: e.target.value }))} />
            <input placeholder="Ciudad" value={formCliente.CLI_CIUDAD} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_CIUDAD: e.target.value }))} />
            <input placeholder="Código postal" value={formCliente.CLI_CODIGO_POSTAL} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_CODIGO_POSTAL: e.target.value }))} />
            <label className="crud-checkbox"><input type="checkbox" checked={!!formCliente.CLI_ACTIVO} onChange={(e) => setFormCliente((f) => ({ ...f, CLI_ACTIVO: e.target.checked ? 1 : 0 }))} /> Activo</label>
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editCliente && <button type="button" onClick={() => { setEditCliente(null); setFormCliente(emptyCliente); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Espacios */}
      <section className="crud-section">
        <h3>Espacios</h3>
        {loading.espacios ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {espacios.length === 0 ? <li className="crud-list-empty">No hay espacios.</li> : espacios.map((e) =>
              listItem(e, (x) => { setEditEspacio(x); setFormEspacio({ ESP_ID: x.ESP_ID, ESP_CODIGO: x.ESP_CODIGO ?? '', EES_ID: x.EES_ID ?? '', ESP_UBICACION: x.ESP_UBICACION ?? '' }); }, null,
                `ID: ${e.ESP_ID} — Código: ${e.ESP_CODIGO} — Estado: ${e.EES_ESTADO ?? e.EES_ID ?? '-'} — ${e.ESP_UBICACION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editEspacio ? 'Editar espacio' : 'Agregar espacio'}</h4>
          <form onSubmit={handleSaveEspacio} className="crud-form">
            <input placeholder="ID" value={formEspacio.ESP_ID} onChange={(e) => setFormEspacio((f) => ({ ...f, ESP_ID: e.target.value }))} disabled={editEspacio != null} />
            <input placeholder="Código" value={formEspacio.ESP_CODIGO} onChange={(e) => setFormEspacio((f) => ({ ...f, ESP_CODIGO: e.target.value }))} required />
            <input placeholder="EES_ID" value={formEspacio.EES_ID} onChange={(e) => setFormEspacio((f) => ({ ...f, EES_ID: e.target.value }))} />
            <input placeholder="Ubicación" value={formEspacio.ESP_UBICACION} onChange={(e) => setFormEspacio((f) => ({ ...f, ESP_UBICACION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editEspacio && <button type="button" onClick={() => { setEditEspacio(null); setFormEspacio({ ESP_ID: '', ESP_CODIGO: '', EES_ID: '', ESP_UBICACION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Estado Espacio (solo listar + agregar) */}
      <section className="crud-section">
        <h3>Estado Espacio</h3>
        {loading.estadoEspacio ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {estadoEspacio.length === 0 ? <li className="crud-list-empty">No hay registros.</li> : estadoEspacio.map((x) => (
              <li key={x.EES_ID} className="crud-list-item">
                <span>ID: {x.EES_ID} — Estado: {x.EES_ESTADO}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>Agregar estado espacio</h4>
          <form onSubmit={handleSaveEstadoEspacio} className="crud-form">
            <input placeholder="EES_ID" value={formEstadoEspacio.EES_ID} onChange={(e) => setFormEstadoEspacio((f) => ({ ...f, EES_ID: e.target.value }))} required />
            <input placeholder="EES_ESTADO" value={formEstadoEspacio.EES_ESTADO} onChange={(e) => setFormEstadoEspacio((f) => ({ ...f, EES_ESTADO: e.target.value }))} required />
            <button type="submit">Guardar</button>
          </form>
        </div>
      </section>

      {/* Estado Máquina */}
      <section className="crud-section">
        <h3>Estado Máquina</h3>
        {loading.estadoMaquina ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {estadoMaquina.length === 0 ? <li className="crud-list-empty">No hay registros.</li> : estadoMaquina.map((x) =>
              listItem(x,
                (item) => { setEditEstadoMaquina(item); setFormEstadoMaquina({ EMA_ID: item.EMA_ID, EMA_ESTADO: item.EMA_ESTADO ?? '', EMA_DESCRIPCION: item.EMA_DESCRIPCION ?? '' }); },
                () => handleDelete('/estado-maquina', x.EMA_ID, fetchEstadoMaquina, setEstadoMaquina)(),
                `ID: ${x.EMA_ID} — ${x.EMA_ESTADO} — ${x.EMA_DESCRIPCION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editEstadoMaquina ? 'Editar estado máquina' : 'Agregar estado máquina'}</h4>
          <form onSubmit={handleSaveEstadoMaquina} className="crud-form">
            <input placeholder="EMA_ID" value={formEstadoMaquina.EMA_ID} onChange={(e) => setFormEstadoMaquina((f) => ({ ...f, EMA_ID: e.target.value }))} disabled={editEstadoMaquina != null} />
            <input placeholder="Estado" value={formEstadoMaquina.EMA_ESTADO} onChange={(e) => setFormEstadoMaquina((f) => ({ ...f, EMA_ESTADO: e.target.value }))} required />
            <input placeholder="Descripción" value={formEstadoMaquina.EMA_DESCRIPCION} onChange={(e) => setFormEstadoMaquina((f) => ({ ...f, EMA_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editEstadoMaquina && <button type="button" onClick={() => { setEditEstadoMaquina(null); setFormEstadoMaquina({ EMA_ID: '', EMA_ESTADO: '', EMA_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Tipo Máquina */}
      <section className="crud-section">
        <h3>Tipo Máquina</h3>
        {loading.tipoMaquina ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tipoMaquina.length === 0 ? <li className="crud-list-empty">No hay registros.</li> : tipoMaquina.map((x) =>
              listItem(x,
                (item) => { setEditTipoMaquina(item); setFormTipoMaquina({ TMA_ID: item.TMA_ID, TMA_TIPO: item.TMA_TIPO ?? '', TMA_DESCRIPCION: item.TMA_DESCRIPCION ?? '' }); },
                () => handleDelete('/tipo-maquina', x.TMA_ID, fetchTipoMaquina, setTipoMaquina)(),
                `ID: ${x.TMA_ID} — ${x.TMA_TIPO} — ${x.TMA_DESCRIPCION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTipoMaquina ? 'Editar tipo máquina' : 'Agregar tipo máquina'}</h4>
          <form onSubmit={handleSaveTipoMaquina} className="crud-form">
            <input placeholder="TMA_ID" value={formTipoMaquina.TMA_ID} onChange={(e) => setFormTipoMaquina((f) => ({ ...f, TMA_ID: e.target.value }))} disabled={editTipoMaquina != null} />
            <input placeholder="Tipo" value={formTipoMaquina.TMA_TIPO} onChange={(e) => setFormTipoMaquina((f) => ({ ...f, TMA_TIPO: e.target.value }))} required />
            <input placeholder="Descripción" value={formTipoMaquina.TMA_DESCRIPCION} onChange={(e) => setFormTipoMaquina((f) => ({ ...f, TMA_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTipoMaquina && <button type="button" onClick={() => { setEditTipoMaquina(null); setFormTipoMaquina({ TMA_ID: '', TMA_TIPO: '', TMA_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Rol */}
      <section className="crud-section">
        <h3>Roles</h3>
        {loading.roles ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {roles.length === 0 ? <li className="crud-list-empty">No hay roles.</li> : roles.map((x) =>
              listItem(x,
                (item) => { setEditRol(item); setFormRol({ ROL_ID: item.ROL_ID, ROL_TIPO: item.ROL_TIPO ?? '', ROL_DESCRIPCION: item.ROL_DESCRIPCION ?? '' }); },
                () => handleDelete('/rol', x.ROL_ID, fetchRoles, setRoles)(),
                `ID: ${x.ROL_ID} — ${x.ROL_TIPO} — ${x.ROL_DESCRIPCION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editRol ? 'Editar rol' : 'Agregar rol'}</h4>
          <form onSubmit={handleSaveRol} className="crud-form">
            <input placeholder="ROL_ID" value={formRol.ROL_ID} onChange={(e) => setFormRol((f) => ({ ...f, ROL_ID: e.target.value }))} disabled={editRol != null} />
            <input placeholder="Tipo" value={formRol.ROL_TIPO} onChange={(e) => setFormRol((f) => ({ ...f, ROL_TIPO: e.target.value }))} required />
            <input placeholder="Descripción" value={formRol.ROL_DESCRIPCION} onChange={(e) => setFormRol((f) => ({ ...f, ROL_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editRol && <button type="button" onClick={() => { setEditRol(null); setFormRol({ ROL_ID: '', ROL_TIPO: '', ROL_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Usuario */}
      <section className="crud-section">
        <h3>Usuarios</h3>
        {loading.usuarios ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {usuarios.length === 0 ? <li className="crud-list-empty">No hay usuarios.</li> : usuarios.map((u) =>
              listItem(u,
                (item) => {
                  setEditUsuario(item);
                  setFormUsuario({
                    USU_ID: item.USU_ID, USU_PRIMER_NOMBRE: item.USU_PRIMER_NOMBRE ?? '', USU_SEGUNDO_NOMBRE: item.USU_SEGUNDO_NOMBRE ?? '',
                    USU_PRIMER_APELLIDO: item.USU_PRIMER_APELLIDO ?? '', USU_SEGUNDO_APELLIDO: item.USU_SEGUNDO_APELLIDO ?? '',
                    USU_CORREO: item.USU_CORREO ?? '', USU_PASSWORD: '', USU_TELEFONO: item.USU_TELEFONO ?? '',
                    ROL_ID: item.ROL_ID ?? '', USU_ACTIVO: item.USU_ACTIVO ?? 1,
                  });
                },
                null,
                `ID: ${u.USU_ID} — ${u.USU_PRIMER_NOMBRE} ${u.USU_PRIMER_APELLIDO} — ${u.USU_CORREO} — Rol: ${u.ROL_ID}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editUsuario ? 'Editar usuario' : 'Agregar usuario'}</h4>
          <form onSubmit={handleSaveUsuario} className="crud-form crud-form-cliente">
            <input placeholder="USU_ID" value={formUsuario.USU_ID} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_ID: e.target.value }))} disabled={editUsuario != null} />
            <input placeholder="Primer nombre" value={formUsuario.USU_PRIMER_NOMBRE} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_PRIMER_NOMBRE: e.target.value }))} required />
            <input placeholder="Segundo nombre" value={formUsuario.USU_SEGUNDO_NOMBRE} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_SEGUNDO_NOMBRE: e.target.value }))} />
            <input placeholder="Primer apellido" value={formUsuario.USU_PRIMER_APELLIDO} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_PRIMER_APELLIDO: e.target.value }))} required />
            <input placeholder="Segundo apellido" value={formUsuario.USU_SEGUNDO_APELLIDO} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_SEGUNDO_APELLIDO: e.target.value }))} />
            <input placeholder="Correo" type="email" value={formUsuario.USU_CORREO} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_CORREO: e.target.value }))} required />
            <input placeholder="Password" type="password" value={formUsuario.USU_PASSWORD} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_PASSWORD: e.target.value }))} />
            <input placeholder="Teléfono" value={formUsuario.USU_TELEFONO} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_TELEFONO: e.target.value }))} />
            <input placeholder="ROL_ID" value={formUsuario.ROL_ID} onChange={(e) => setFormUsuario((f) => ({ ...f, ROL_ID: e.target.value }))} required />
            <label className="crud-checkbox"><input type="checkbox" checked={!!formUsuario.USU_ACTIVO} onChange={(e) => setFormUsuario((f) => ({ ...f, USU_ACTIVO: e.target.checked ? 1 : 0 }))} /> Activo</label>
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editUsuario && <button type="button" onClick={() => { setEditUsuario(null); setFormUsuario({ USU_ID: '', USU_PRIMER_NOMBRE: '', USU_SEGUNDO_NOMBRE: '', USU_PRIMER_APELLIDO: '', USU_SEGUNDO_APELLIDO: '', USU_CORREO: '', USU_PASSWORD: '', USU_TELEFONO: '', ROL_ID: '', USU_ACTIVO: 1 }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>
      {/* Vehículos */}
      <section className="crud-section">
        <h3>Vehículos</h3>
        {loading.vehiculos ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {vehiculos.length === 0 ? <li className="crud-list-empty">No hay vehículos.</li> : vehiculos.map((x) =>
              listItem(x,
                (item) => { setEditVehiculo(item); setFormVehiculo({ VEH_ID: item.VEH_ID, VEH_PLACA: item.VEH_PLACA, VEH_MODELO: item.VEH_MODELO, VEH_COLOR: item.VEH_COLOR ?? '', TVE_ID: item.TVE_ID, CLI_ID: item.CLI_ID ?? '' }); },
                null,
                `ID: ${x.VEH_ID} — Placa: ${x.VEH_PLACA} — Modelo: ${x.VEH_MODELO} — Color: ${x.VEH_COLOR ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editVehiculo ? 'Editar vehículo' : 'Agregar vehículo'}</h4>
          <form onSubmit={handleSaveVehiculo} className="crud-form">
            <input placeholder="VEH_ID" value={formVehiculo.VEH_ID} onChange={(e) => setFormVehiculo((f) => ({ ...f, VEH_ID: e.target.value }))} disabled={editVehiculo != null} required />
            <input placeholder="Placa" value={formVehiculo.VEH_PLACA} onChange={(e) => setFormVehiculo((f) => ({ ...f, VEH_PLACA: e.target.value }))} required />
            <input placeholder="Modelo" value={formVehiculo.VEH_MODELO} onChange={(e) => setFormVehiculo((f) => ({ ...f, VEH_MODELO: e.target.value }))} required />
            <input placeholder="Color" value={formVehiculo.VEH_COLOR} onChange={(e) => setFormVehiculo((f) => ({ ...f, VEH_COLOR: e.target.value }))} />
            <input placeholder="TVE_ID" value={formVehiculo.TVE_ID} onChange={(e) => setFormVehiculo((f) => ({ ...f, TVE_ID: e.target.value }))} required />
            <input placeholder="CLI_ID (Opcional)" value={formVehiculo.CLI_ID} onChange={(e) => setFormVehiculo((f) => ({ ...f, CLI_ID: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editVehiculo && <button type="button" onClick={() => { setEditVehiculo(null); setFormVehiculo({ VEH_ID: '', VEH_PLACA: '', VEH_MODELO: '', VEH_COLOR: '', TVE_ID: '', CLI_ID: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Tipo Vehículo */}
      <section className="crud-section">
        <h3>Tipo Vehículo</h3>
        {loading.tipoVehiculos ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tipoVehiculos.length === 0 ? <li className="crud-list-empty">No hay tipos de vehículo.</li> : tipoVehiculos.map((x) =>
              listItem(x,
                (item) => { setEditTipoVehiculo(item); setFormTipoVehiculo({ TVE_ID: item.TVE_ID, TVE_TIPO: item.TVE_TIPO, TVE_MARCA: item.TVE_MARCA ?? '', TVE_DESCRIPCION: item.TVE_DESCRIPCION ?? '' }); },
                () => handleDelete('/tipo-vehiculo', x.TVE_ID, fetchTipoVehiculos, setTipoVehiculos)(),
                `ID: ${x.TVE_ID} — ${x.TVE_TIPO} — Marca: ${x.TVE_MARCA ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTipoVehiculo ? 'Editar tipo vehículo' : 'Agregar tipo vehículo'}</h4>
          <form onSubmit={handleSaveTipoVehiculo} className="crud-form">
            <input placeholder="TVE_ID" value={formTipoVehiculo.TVE_ID} onChange={(e) => setFormTipoVehiculo((f) => ({ ...f, TVE_ID: e.target.value }))} disabled={editTipoVehiculo != null} required />
            <input placeholder="Tipo" value={formTipoVehiculo.TVE_TIPO} onChange={(e) => setFormTipoVehiculo((f) => ({ ...f, TVE_TIPO: e.target.value }))} required />
            <input placeholder="Marca" value={formTipoVehiculo.TVE_MARCA} onChange={(e) => setFormTipoVehiculo((f) => ({ ...f, TVE_MARCA: e.target.value }))} />
            <input placeholder="Descripción" value={formTipoVehiculo.TVE_DESCRIPCION} onChange={(e) => setFormTipoVehiculo((f) => ({ ...f, TVE_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTipoVehiculo && <button type="button" onClick={() => { setEditTipoVehiculo(null); setFormTipoVehiculo({ TVE_ID: '', TVE_TIPO: '', TVE_MARCA: '', TVE_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Registro Movimiento Membresía (Inmutable) */}
      <section className="crud-section">
        <h3>Registro Movimientos Membresía</h3>
        {loading.registroMovimientoMembresias ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {registroMovimientoMembresias.length === 0 ? <li className="crud-list-empty">No hay registros de movimiento.</li> : registroMovimientoMembresias.map((x) => (
              <li key={x.RMM_ID} className="crud-list-item">
                <span>ID: {x.RMM_ID} — MEM_ID: {x.MEM_ID} — Ent: {x.RMM_FECHA_HORA_ENTRADA} — Sal: {x.RMM_FECHA_HORA_SALIDA ?? 'En curso'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>Registrar movimiento (inmutable)</h4>
          <form onSubmit={handleSaveRegistroMovimientoMembresia} className="crud-form">
            <input placeholder="RMM_ID" value={formRegistroMovimientoMembresia.RMM_ID} onChange={(e) => setFormRegistroMovimientoMembresia((f) => ({ ...f, RMM_ID: e.target.value }))} required />
            <input placeholder="MEM_ID" value={formRegistroMovimientoMembresia.MEM_ID} onChange={(e) => setFormRegistroMovimientoMembresia((f) => ({ ...f, MEM_ID: e.target.value }))} required />
            <input type="datetime-local" title="Fecha Entrada" placeholder="Fecha Hora Entrada" value={formRegistroMovimientoMembresia.RMM_FECHA_HORA_ENTRADA} onChange={(e) => setFormRegistroMovimientoMembresia((f) => ({ ...f, RMM_FECHA_HORA_ENTRADA: e.target.value }))} required />
            <input type="datetime-local" title="Fecha Salida" placeholder="Fecha Hora Salida (opcional)" value={formRegistroMovimientoMembresia.RMM_FECHA_HORA_SALIDA} onChange={(e) => setFormRegistroMovimientoMembresia((f) => ({ ...f, RMM_FECHA_HORA_SALIDA: e.target.value }))} />
            <button type="submit">Guardar</button>
          </form>
        </div>
      </section>

      {/* Tipo Membresía */}
      <section className="crud-section">
        <h3>Tipo Membresía</h3>
        {loading.tipoMembresias ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tipoMembresias.length === 0 ? <li className="crud-list-empty">No hay tipos de membresía.</li> : tipoMembresias.map((x) =>
              listItem(x,
                (item) => { setEditTipoMembresia(item); setFormTipoMembresia({ TME_ID: item.TME_ID, TME_TIPO: item.TME_TIPO, TME_DESCRIPCION: item.TME_DESCRIPCION ?? '', TME_DURACION: item.TME_DURACION, TME_PRECIO: item.TME_PRECIO }); },
                () => handleDelete('/tipo-membresia', x.TME_ID, fetchTipoMembresias, setTipoMembresias)(),
                `ID: ${x.TME_ID} — ${x.TME_TIPO} — Duración: ${x.TME_DURACION} días — Precio: Q${x.TME_PRECIO}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTipoMembresia ? 'Editar tipo membresía' : 'Agregar tipo membresía'}</h4>
          <form onSubmit={handleSaveTipoMembresia} className="crud-form">
            <input placeholder="TME_ID" value={formTipoMembresia.TME_ID} onChange={(e) => setFormTipoMembresia((f) => ({ ...f, TME_ID: e.target.value }))} disabled={editTipoMembresia != null} required />
            <input placeholder="Tipo" value={formTipoMembresia.TME_TIPO} onChange={(e) => setFormTipoMembresia((f) => ({ ...f, TME_TIPO: e.target.value }))} required />
            <input placeholder="Descripción" value={formTipoMembresia.TME_DESCRIPCION} onChange={(e) => setFormTipoMembresia((f) => ({ ...f, TME_DESCRIPCION: e.target.value }))} />
            <input placeholder="Duración (días)" type="number" value={formTipoMembresia.TME_DURACION} onChange={(e) => setFormTipoMembresia((f) => ({ ...f, TME_DURACION: e.target.value }))} required />
            <input placeholder="Precio" type="number" step="0.01" value={formTipoMembresia.TME_PRECIO} onChange={(e) => setFormTipoMembresia((f) => ({ ...f, TME_PRECIO: e.target.value }))} required />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTipoMembresia && <button type="button" onClick={() => { setEditTipoMembresia(null); setFormTipoMembresia({ TME_ID: '', TME_TIPO: '', TME_DESCRIPCION: '', TME_DURACION: '', TME_PRECIO: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Estado Membresía */}
      <section className="crud-section">
        <h3>Estado Membresía</h3>
        {loading.estadoMembresias ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {estadoMembresias.length === 0 ? <li className="crud-list-empty">No hay estados de membresía.</li> : estadoMembresias.map((x) => (
              <li key={x.EME_ID} className="crud-list-item">
                <span>ID: {x.EME_ID} — Estado: {x.EME_ESTADO}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>Agregar estado membresía</h4>
          <form onSubmit={handleSaveEstadoMembresia} className="crud-form">
            <input placeholder="EME_ID" value={formEstadoMembresia.EME_ID} onChange={(e) => setFormEstadoMembresia((f) => ({ ...f, EME_ID: e.target.value }))} required />
            <input placeholder="Estado" value={formEstadoMembresia.EME_ESTADO} onChange={(e) => setFormEstadoMembresia((f) => ({ ...f, EME_ESTADO: e.target.value }))} required />
            <button type="submit">Guardar</button>
          </form>
        </div>
      </section>

      {/* Tipo Cobro */}
      <section className="crud-section">
        <h3>Tipo Cobro</h3>
        {loading.tipoCobros ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tipoCobros.length === 0 ? <li className="crud-list-empty">No hay tipos de cobro.</li> : tipoCobros.map((x) =>
              listItem(x,
                (item) => { setEditTipoCobro(item); setFormTipoCobro({ TCO_ID: item.TCO_ID, TCO_TIPO: item.TCO_TIPO, TCO_DESCRIPCION: item.TCO_DESCRIPCION ?? '' }); },
                () => handleDelete('/tipo-cobro', x.TCO_ID, fetchTipoCobros, setTipoCobros)(),
                `ID: ${x.TCO_ID} — ${x.TCO_TIPO} — ${x.TCO_DESCRIPCION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTipoCobro ? 'Editar tipo cobro' : 'Agregar tipo cobro'}</h4>
          <form onSubmit={handleSaveTipoCobro} className="crud-form">
            <input placeholder="TCO_ID" value={formTipoCobro.TCO_ID} onChange={(e) => setFormTipoCobro((f) => ({ ...f, TCO_ID: e.target.value }))} disabled={editTipoCobro != null} required />
            <input placeholder="Tipo" value={formTipoCobro.TCO_TIPO} onChange={(e) => setFormTipoCobro((f) => ({ ...f, TCO_TIPO: e.target.value }))} required />
            <input placeholder="Descripción" value={formTipoCobro.TCO_DESCRIPCION} onChange={(e) => setFormTipoCobro((f) => ({ ...f, TCO_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTipoCobro && <button type="button" onClick={() => { setEditTipoCobro(null); setFormTipoCobro({ TCO_ID: '', TCO_TIPO: '', TCO_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Cobro */}
      <section className="crud-section">
        <h3>Cobros (Inmutables)</h3>
        {loading.cobros ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {cobros.length === 0 ? <li className="crud-list-empty">No hay cobros.</li> : cobros.map((x) => (
              <li key={x.COB_ID} className="crud-list-item">
                <span>ID: {x.COB_ID} — Total: Q{x.COB_MONTO_TOTAL} — Fecha: {new Date(x.COB_FECHA_HORA).toLocaleString()} — PROC: {x.COB_PROCESADO_MAQUINA ? 'Sí' : 'No'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>Registrar cobro</h4>
          <form onSubmit={handleSaveCobro} className="crud-form">
            <input placeholder="COB_ID" value={formCobro.COB_ID} onChange={(e) => setFormCobro((f) => ({ ...f, COB_ID: e.target.value }))} required />
            <input placeholder="Horas totales" type="number" step="0.01" value={formCobro.COB_HORAS_TOTALES} onChange={(e) => setFormCobro((f) => ({ ...f, COB_HORAS_TOTALES: e.target.value }))} required />
            <input placeholder="TCO_ID" value={formCobro.TCO_ID} onChange={(e) => setFormCobro((f) => ({ ...f, TCO_ID: e.target.value }))} required />
            <input placeholder="Monto total" type="number" step="0.01" value={formCobro.COB_MONTO_TOTAL} onChange={(e) => setFormCobro((f) => ({ ...f, COB_MONTO_TOTAL: e.target.value }))} required />
            <input placeholder="Monto recibido" type="number" step="0.01" value={formCobro.COB_MONTO_RECIBIDO} onChange={(e) => setFormCobro((f) => ({ ...f, COB_MONTO_RECIBIDO: e.target.value }))} required />
            <input placeholder="Vuelto" type="number" step="0.01" value={formCobro.COB_VUELTO} onChange={(e) => setFormCobro((f) => ({ ...f, COB_VUELTO: e.target.value }))} required />
            <input type="datetime-local" title="Fecha Hora" placeholder="Fecha Hora" value={formCobro.COB_FECHA_HORA} onChange={(e) => setFormCobro((f) => ({ ...f, COB_FECHA_HORA: e.target.value }))} required />
            <input placeholder="TAR_ID" value={formCobro.TAR_ID} onChange={(e) => setFormCobro((f) => ({ ...f, TAR_ID: e.target.value }))} required />
            <label className="crud-checkbox"><input type="checkbox" checked={!!formCobro.COB_PROCESADO_MAQUINA} onChange={(e) => setFormCobro((f) => ({ ...f, COB_PROCESADO_MAQUINA: e.target.checked ? 1 : 0 }))} /> Proc. Máquina</label>
            <button type="submit">Guardar</button>
          </form>
        </div>
      </section>

      {/* Tarifa */}
      <section className="crud-section">
        <h3>Tarifas</h3>
        {loading.tarifas ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tarifas.length === 0 ? <li className="crud-list-empty">No hay tarifas.</li> : tarifas.map((x) =>
              listItem(x,
                (item) => { setEditTarifa(item); setFormTarifa({ TAR_ID: item.TAR_ID, TAR_TIPO: item.TAR_TIPO, TAR_PRECIO: item.TAR_PRECIO }); },
                () => handleDelete('/tarifa', x.TAR_ID, fetchTarifas, setTarifas)(),
                `ID: ${x.TAR_ID} — ${x.TAR_TIPO} — Precio: Q${x.TAR_PRECIO}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTarifa ? 'Editar tarifa' : 'Agregar tarifa'}</h4>
          <form onSubmit={handleSaveTarifa} className="crud-form">
            <input placeholder="TAR_ID" value={formTarifa.TAR_ID} onChange={(e) => setFormTarifa((f) => ({ ...f, TAR_ID: e.target.value }))} disabled={editTarifa != null} required />
            <input placeholder="Tipo" value={formTarifa.TAR_TIPO} onChange={(e) => setFormTarifa((f) => ({ ...f, TAR_TIPO: e.target.value }))} required />
            <input placeholder="Precio" type="number" step="0.01" value={formTarifa.TAR_PRECIO} onChange={(e) => setFormTarifa((f) => ({ ...f, TAR_PRECIO: e.target.value }))} required />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTarifa && <button type="button" onClick={() => { setEditTarifa(null); setFormTarifa({ TAR_ID: '', TAR_TIPO: '', TAR_PRECIO: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Tipo Alerta */}
      <section className="crud-section">
        <h3>Tipo Alerta</h3>
        {loading.tipoAlertas ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {tipoAlertas.length === 0 ? <li className="crud-list-empty">No hay tipos de alerta.</li> : tipoAlertas.map((x) =>
              listItem(x,
                (item) => { setEditTipoAlerta(item); setFormTipoAlerta({ TAL_ID: item.TAL_ID, TAL_TIPO: item.TAL_TIPO, TAL_DESCRIPCION: item.TAL_DESCRIPCION ?? '' }); },
                () => handleDelete('/tipo-alerta', x.TAL_ID, fetchTipoAlertas, setTipoAlertas)(),
                `ID: ${x.TAL_ID} — ${x.TAL_TIPO} — ${x.TAL_DESCRIPCION ?? '-'}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editTipoAlerta ? 'Editar tipo alerta' : 'Agregar tipo alerta'}</h4>
          <form onSubmit={handleSaveTipoAlerta} className="crud-form">
            <input placeholder="TAL_ID" value={formTipoAlerta.TAL_ID} onChange={(e) => setFormTipoAlerta((f) => ({ ...f, TAL_ID: e.target.value }))} disabled={editTipoAlerta != null} required />
            <input placeholder="Tipo" value={formTipoAlerta.TAL_TIPO} onChange={(e) => setFormTipoAlerta((f) => ({ ...f, TAL_TIPO: e.target.value }))} required />
            <input placeholder="Descripción" value={formTipoAlerta.TAL_DESCRIPCION} onChange={(e) => setFormTipoAlerta((f) => ({ ...f, TAL_DESCRIPCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editTipoAlerta && <button type="button" onClick={() => { setEditTipoAlerta(null); setFormTipoAlerta({ TAL_ID: '', TAL_TIPO: '', TAL_DESCRIPCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

      {/* Estado Alerta */}
      <section className="crud-section">
        <h3>Estado Alerta</h3>
        {loading.estadoAlertas ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {estadoAlertas.length === 0 ? <li className="crud-list-empty">No hay estados de alerta.</li> : estadoAlertas.map((x) => (
              <li key={x.EAL_ID} className="crud-list-item">
                <span>ID: {x.EAL_ID} — Estado: {x.EAL_ESTADO} — {x.EAL_DESCRIPCION ?? '-'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>Agregar estado alerta</h4>
          <form onSubmit={handleSaveEstadoAlerta} className="crud-form">
            <input placeholder="EAL_ID" value={formEstadoAlerta.EAL_ID} onChange={(e) => setFormEstadoAlerta((f) => ({ ...f, EAL_ID: e.target.value }))} required />
            <input placeholder="Estado" value={formEstadoAlerta.EAL_ESTADO} onChange={(e) => setFormEstadoAlerta((f) => ({ ...f, EAL_ESTADO: e.target.value }))} required />
            <input placeholder="Descripción" value={formEstadoAlerta.EAL_DESCRIPCION} onChange={(e) => setFormEstadoAlerta((f) => ({ ...f, EAL_DESCRIPCION: e.target.value }))} />
            <button type="submit">Guardar</button>
          </form>
        </div>
      </section>

      {/* Alerta */}
      <section className="crud-section">
        <h3>Alertas</h3>
        {loading.alertas ? <p className="crud-loading">Cargando…</p> : (
          <ul className="crud-list">
            {alertas.length === 0 ? <li className="crud-list-empty">No hay alertas.</li> : alertas.map((x) =>
              listItem(x,
                (item) => {
                  setEditAlerta(item);
                  setFormAlerta({
                    ALE_ID: item.ALE_ID, MAQ_ID: item.MAQ_ID ?? '', ALE_MOTIVO: item.ALE_MOTIVO, ALE_DESCRIPCION: item.ALE_DESCRIPCION ?? '',
                    ALE_FECHA_HORA_GENERACION: item.ALE_FECHA_HORA_GENERACION, EAL_ID: item.EAL_ID, TAL_ID: item.TAL_ID, ALE_FECHA_ATENCION: item.ALE_FECHA_ATENCION ?? ''
                  });
                },
                null,
                `ID: ${x.ALE_ID} — MAQ: ${x.MAQ_ID ?? '-'} — Motivo: ${x.ALE_MOTIVO} — Est: ${x.EAL_ID} — F. Generación: ${new Date(x.ALE_FECHA_HORA_GENERACION).toLocaleString()}`)
            )}
          </ul>
        )}
        <div className="crud-form-box">
          <h4>{editAlerta ? 'Editar alerta (solo EAL_ID y Atencion)' : 'Agregar alerta'}</h4>
          <form onSubmit={handleSaveAlerta} className="crud-form">
            <input placeholder="ALE_ID" value={formAlerta.ALE_ID} onChange={(e) => setFormAlerta((f) => ({ ...f, ALE_ID: e.target.value }))} disabled={editAlerta != null} required />
            <input placeholder="MAQ_ID (Opcional)" value={formAlerta.MAQ_ID} onChange={(e) => setFormAlerta((f) => ({ ...f, MAQ_ID: e.target.value }))} disabled={editAlerta != null} />
            <input placeholder="Motivo" value={formAlerta.ALE_MOTIVO} onChange={(e) => setFormAlerta((f) => ({ ...f, ALE_MOTIVO: e.target.value }))} disabled={editAlerta != null} required />
            <input placeholder="Descripción" value={formAlerta.ALE_DESCRIPCION} onChange={(e) => setFormAlerta((f) => ({ ...f, ALE_DESCRIPCION: e.target.value }))} disabled={editAlerta != null} />
            <input type="datetime-local" title="Fecha Generación" value={formAlerta.ALE_FECHA_HORA_GENERACION ? new Date(formAlerta.ALE_FECHA_HORA_GENERACION).toISOString().slice(0, 16) : ''} onChange={(e) => setFormAlerta((f) => ({ ...f, ALE_FECHA_HORA_GENERACION: e.target.value }))} disabled={editAlerta != null} required />
            <input placeholder="EAL_ID" value={formAlerta.EAL_ID} onChange={(e) => setFormAlerta((f) => ({ ...f, EAL_ID: e.target.value }))} required />
            <input placeholder="TAL_ID" value={formAlerta.TAL_ID} onChange={(e) => setFormAlerta((f) => ({ ...f, TAL_ID: e.target.value }))} disabled={editAlerta != null} required />
            <input type="datetime-local" title="Fecha Atención" value={formAlerta.ALE_FECHA_ATENCION ? new Date(formAlerta.ALE_FECHA_ATENCION).toISOString().slice(0, 16) : ''} onChange={(e) => setFormAlerta((f) => ({ ...f, ALE_FECHA_ATENCION: e.target.value }))} />
            <div className="crud-form-actions">
              <button type="submit">Guardar</button>
              {editAlerta && <button type="button" onClick={() => { setEditAlerta(null); setFormAlerta({ ALE_ID: '', MAQ_ID: '', ALE_MOTIVO: '', ALE_DESCRIPCION: '', ALE_FECHA_HORA_GENERACION: '', EAL_ID: '', TAL_ID: '', ALE_FECHA_ATENCION: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
      </section>

    </div>
  );
}
