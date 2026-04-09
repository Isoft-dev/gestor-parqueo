import { useEffect, useState } from 'react';
import { API_BASE } from '../config.js';
import { getDbColumnLabel } from '../utils/dbColumnLabel.js';

export default function MonthlyPaymentsPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tipoPagoId, setTipoPagoId] = useState('');
  const [tiposPago, setTiposPago] = useState([]);
  const [history, setHistory] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [reactivar, setReactivar] = useState(true);
  const [msg, setMsg] = useState('');
  const [searchNoHits, setSearchNoHits] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/tipo-pago`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setTiposPago(Array.isArray(data) ? data : []);
      } catch {
        setTiposPago([]);
      }
    })();
  }, []);

  async function search() {
    setLoading(true);
    setMsg('');
    setSearchNoHits(false);
    try {
      const res = await fetch(
        `${API_BASE}/membresia/payment-candidates/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list = Array.isArray(data) ? data : [];
      setResults(list);
      if (list.length === 0) {
        setSearchNoHits(true);
        setSelected(null);
        setHistory(null);
      }
    } catch (e) {
      setMsg(`Error de busqueda: ${e.message}`);
      setResults([]);
      setSearchNoHits(false);
    } finally {
      setLoading(false);
    }
  }

  async function registerPayment() {
    if (!selected?.MEM_ID || !tipoPagoId) {
      setMsg('Selecciona membresia y tipo de pago');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/membresia/${selected.MEM_ID}/register-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TPA_ID: tipoPagoId,
          PAG_MONTO_RECIBIDO: montoRecibido || undefined,
          REACTIVATE_IF_SUSPENDED: reactivar,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg(`Pago registrado. ${getDbColumnLabel('PAG_ID')}: ${data.PAG_ID}`);
      setSelected(null);
      setResults([]);
      setHistory(null);
    } catch (e) {
      setMsg(`Error al registrar pago: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(memId) {
    try {
      const res = await fetch(`${API_BASE}/membresia/${memId}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setHistory(data);
    } catch (e) {
      setMsg(`Error al cargar historial: ${e.message}`);
      setHistory(null);
    }
  }

  /** Cierra solo el detalle (membresía seleccionada + historial); mantiene búsqueda y tabla de resultados. */
  function closePaymentsDetail() {
    setSelected(null);
    setHistory(null);
    setMsg('');
    setTipoPagoId('');
    setMontoRecibido('');
    setReactivar(true);
  }

  function clearSearchFilter() {
    setQuery('');
    setResults([]);
    setSearchNoHits(false);
    setSelected(null);
    setHistory(null);
    setMsg('');
    setTipoPagoId('');
    setMontoRecibido('');
    setReactivar(true);
  }

  return (
    <div className="admin-panel-block">
      <div className="admin-panel-head admin-panel-head--row">
        <div className="admin-panel-head-text">
          <h2>Registro de pagos de membresia</h2>
          <p className="admin-panel-sub">Busca por nombre del cliente o placa del vehiculo.</p>
        </div>
        {selected ? (
          <button
            type="button"
            className="admin-panel-close"
            onClick={closePaymentsDetail}
            aria-label="Cerrar detalle de pago"
            title="Cerrar detalle"
          >
            ✕
          </button>
        ) : null}
      </div>
      <form
        className="admin-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && query.trim().length >= 2) search();
        }}
      >
        <div className="admin-search-input-wrap">
          <input
            className="admin-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchNoHits(false);
            }}
            placeholder="🔍 Nombre o placa"
            aria-label="Buscar cliente por nombre o placa"
          />
        </div>
        <div className="admin-search-actions">
          <button
            type="submit"
            className="admin-btn-search"
            disabled={loading || query.trim().length < 2}
          >
            Buscar
          </button>
          <button
            type="button"
            className="admin-btn-search-clear"
            onClick={clearSearchFilter}
            disabled={loading}
            title="Vaciar búsqueda y ocultar resultados"
          >
            Limpiar
          </button>
        </div>
      </form>

      {searchNoHits && !loading && (
        <p className="admin-muted" role="status" style={{ margin: '0.5rem 0' }}>
          No se encontraron clientes o membresías con ese criterio. Prueba con otro nombre o placa.
        </p>
      )}

      {results.length > 0 && (
        <div className="admin-table-wrap admin-table-scroll" style={{ marginBottom: 10 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{getDbColumnLabel('MEM_ID')}</th>
                <th>{getDbColumnLabel('VEH_PLACA')}</th>
                <th>{getDbColumnLabel('TME_PRECIO')}</th>
                <th>{getDbColumnLabel('MEM_FECHA_VENCIMIENTO')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.MEM_ID}>
                  <td>{r.MEM_ID}</td>
                  <td>{r.VEH_PLACA}</td>
                  <td>{r.TME_PRECIO}</td>
                  <td>
                    {r.MEM_FECHA_VENCIMIENTO
                      ? new Date(r.MEM_FECHA_VENCIMIENTO).toLocaleDateString('es-GT')
                      : '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setSelected(r);
                        loadHistory(r.MEM_ID);
                      }}
                    >
                      Seleccionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>Membresia {selected.MEM_ID}</strong>
          <select
            value={tipoPagoId}
            onChange={(e) => setTipoPagoId(e.target.value)}
            style={{ padding: '8px 10px', minWidth: 210 }}
          >
            <option value="">Selecciona tipo de pago</option>
            {tiposPago.map((tp) => (
              <option key={tp.TPA_ID} value={tp.TPA_ID}>
                {tp.TPA_TIPO} (ID {tp.TPA_ID})
              </option>
            ))}
          </select>
          <input
            placeholder="Monto recibido"
            value={montoRecibido}
            onChange={(e) => setMontoRecibido(e.target.value)}
            style={{ padding: '8px 10px', width: 150 }}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={reactivar}
              onChange={(e) => setReactivar(e.target.checked)}
            />
            Reactivar si esta suspendida
          </label>
          <button onClick={registerPayment} disabled={loading}>
            Registrar pago
          </button>
        </div>
      )}

      {history && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Historial de membresia {history.membership?.MEM_ID}</h3>
          <p className="admin-muted" style={{ marginBottom: 8 }}>
            Estado: {history.membership?.EME_ESTADO || 'N/D'} · Vence: {history.membership?.MEM_FECHA_VENCIMIENTO ? new Date(history.membership.MEM_FECHA_VENCIMIENTO).toLocaleDateString('es-GT') : 'N/D'}
          </p>
          <div className="admin-table-wrap admin-table-scroll" style={{ marginBottom: 8 }}>
            <table className="admin-table">
              <thead>
                <tr><th colSpan="3">Movimientos</th></tr>
                <tr>
                  <th>{getDbColumnLabel('RMM_ID')}</th>
                  <th>{getDbColumnLabel('RMM_FECHA_HORA_ENTRADA')}</th>
                  <th>{getDbColumnLabel('RMM_FECHA_HORA_SALIDA')}</th>
                </tr>
              </thead>
              <tbody>
                {(history.movimientos || []).map((m) => (
                  <tr key={m.RMM_ID}>
                    <td>{m.RMM_ID}</td>
                    <td>{m.RMM_FECHA_HORA_ENTRADA ? new Date(m.RMM_FECHA_HORA_ENTRADA).toLocaleString('es-GT') : '—'}</td>
                    <td>{m.RMM_FECHA_HORA_SALIDA ? new Date(m.RMM_FECHA_HORA_SALIDA).toLocaleString('es-GT') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-table-wrap admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr><th colSpan="5">Pagos</th></tr>
                <tr>
                  <th>{getDbColumnLabel('PAG_ID')}</th>
                  <th>{getDbColumnLabel('PAG_MONTO_TOTAL')}</th>
                  <th>{getDbColumnLabel('PAG_MONTO_RECIBIDO')}</th>
                  <th>{getDbColumnLabel('PAG_VUELTO')}</th>
                  <th>{getDbColumnLabel('PAG_FECHA_HORA')}</th>
                </tr>
              </thead>
              <tbody>
                {(history.pagos || []).map((p) => (
                  <tr key={p.PAG_ID}>
                    <td>{p.PAG_ID}</td>
                    <td>{p.PAG_MONTO_TOTAL}</td>
                    <td>{p.PAG_MONTO_RECIBIDO}</td>
                    <td>{p.PAG_VUELTO}</td>
                    <td>{p.PAG_FECHA_HORA ? new Date(p.PAG_FECHA_HORA).toLocaleString('es-GT') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {msg && <p className="admin-muted" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
