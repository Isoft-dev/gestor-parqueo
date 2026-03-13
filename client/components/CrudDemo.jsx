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

  const [loading, setLoading] = useState({
    clientes: true, espacios: true, estadoEspacio: true, estadoMaquina: true,
    tipoMaquina: true, roles: true, usuarios: true,
  });
  const [error, setError] = useState('');

  const [editCliente, setEditCliente] = useState(null);
  const [editEspacio, setEditEspacio] = useState(null);
  const [editEstadoMaquina, setEditEstadoMaquina] = useState(null);
  const [editTipoMaquina, setEditTipoMaquina] = useState(null);
  const [editRol, setEditRol] = useState(null);
  const [editUsuario, setEditUsuario] = useState(null);

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

  useEffect(() => {
    (async () => {
      setClientes(await fetchClientes());
      setEspacios(await fetchEspacios());
      setEstadoEspacio(await fetchEstadoEspacio());
      setEstadoMaquina(await fetchEstadoMaquina());
      setTipoMaquina(await fetchTipoMaquina());
      setRoles(await fetchRoles());
      setUsuarios(await fetchUsuarios());
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
    <li key={item.id ?? item.CLI_ID ?? item.ESP_ID ?? item.EES_ID ?? item.EMA_ID ?? item.TMA_ID ?? item.ROL_ID ?? item.USU_ID} className="crud-list-item">
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
    </div>
  );
}
