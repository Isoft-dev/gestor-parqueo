import { useEffect, useMemo, useState } from 'react';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { API_BASE } from '../config.js';

ChartJS.register(ArcElement, Tooltip, Legend);

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 29);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default function ReportesMembresiasClientesSection() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState('mora');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [queryCliente, setQueryCliente] = useState('');
  const [candidatos, setCandidatos] = useState([]);
  const [cliId, setCliId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    // Limpia resultados al cambiar de subreporte para evitar residuos visuales.
    setError('');
    setData(null);
  }, [tab]);

  const buscarClientes = async () => {
    setError('');
    try {
      const q = new URLSearchParams({ q: queryCliente });
      const res = await fetch(`${API_BASE}/reportes/membresias-clientes/buscar?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setCandidatos(Array.isArray(json) ? json : []);
    } catch (e) {
      setError(e.message || 'No se pudo buscar clientes');
    }
  };

  const generate = async () => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      if (tab === 'mora') {
        const res = await fetch(`${API_BASE}/reportes/clientes-mora`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      } else if (tab === 'estado') {
        const q = new URLSearchParams({ desde, hasta });
        const res = await fetch(`${API_BASE}/reportes/membresias-estado?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      } else {
        const q = new URLSearchParams({ cli_id: cliId });
        const res = await fetch(`${API_BASE}/reportes/membresias-clientes/historial-pagos?${q}`, { cache: 'no-store' });
        const json = await parseJsonSafe(res);
        if (!res.ok) throw new Error(json.error || json.message || res.statusText);
        setData(json);
      }
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    if (tab === 'mora') {
      window.open(`${API_BASE}/reportes/clientes-mora/pdf`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (tab === 'estado') {
      const q = new URLSearchParams({ desde, hasta });
      window.open(`${API_BASE}/reportes/membresias-estado/pdf?${q}`, '_blank', 'noopener,noreferrer');
      return;
    }
    const q = new URLSearchParams({ cli_id: cliId });
    window.open(`${API_BASE}/reportes/membresias-clientes/historial-pagos/pdf?${q}`, '_blank', 'noopener,noreferrer');
  };

  const detalleEstadoFiltrado = (() => {
    const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
    if (!estadoFiltro) return detalle;
    return detalle.filter((r) => String(r.estadoActual || '').toLowerCase() === estadoFiltro.toLowerCase());
  })();

  const pieDataEstado = {
    labels: (data?.porEstado || []).map((x) => x.estadoTexto),
    datasets: [
      {
        data: (data?.porEstado || []).map((x) => Number(x.cantidad || 0)),
        backgroundColor: (data?.porEstado || []).map((x) => x.color || '#64748b'),
      },
    ],
  };

  const estadosOpciones = [...new Set((data?.detalle || []).map((x) => x.estadoActual).filter(Boolean))];

  return (
    <>
      <div className="reporte-tabs" role="tablist" aria-label="Subreportes membresías y clientes">
        <button type="button" role="tab" aria-selected={tab === 'mora'} className={`reporte-tab-btn${tab === 'mora' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('mora')}>
          Clientes con mora
        </button>
        <button type="button" role="tab" aria-selected={tab === 'estado'} className={`reporte-tab-btn${tab === 'estado' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('estado')}>
          Estado de membresías
        </button>
        <button type="button" role="tab" aria-selected={tab === 'historial'} className={`reporte-tab-btn${tab === 'historial' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('historial')}>
          Historial pagos cliente
        </button>
      </div>

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">
          {tab === 'mora'
            ? 'Reporte de clientes con mora'
            : tab === 'estado'
              ? 'Reporte de membresías activas, suspendidas y vencidas'
              : 'Reporte de historial de pagos por cliente'}
        </h2>
        <form
          className="reporte-inc-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          {tab === 'estado' ? (
            <>
              <label className="reporte-inc-field"><span>Fecha inicio</span><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required /></label>
              <label className="reporte-inc-field"><span>Fecha fin</span><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required /></label>
            </>
          ) : null}
          {tab === 'historial' ? (
            <>
              <label className="reporte-inc-field" style={{ minWidth: 260 }}>
                <span>Buscar cliente (nombre o placa)</span>
                <input type="text" value={queryCliente} onChange={(e) => setQueryCliente(e.target.value)} placeholder="Ej. Juan o P123ABC" />
              </label>
              <div className="reporte-inc-form__actions">
                <button type="button" className="admin-btn-ghost" onClick={buscarClientes} disabled={!queryCliente || queryCliente.trim().length < 2}>
                  Filtrar
                </button>
              </div>
              <label className="reporte-inc-field" style={{ minWidth: 260 }}>
                <span>Cliente</span>
                <select value={cliId} onChange={(e) => setCliId(e.target.value)}>
                  <option value="">Seleccione</option>
                  {candidatos.map((c) => (
                    <option key={String(c.cliId)} value={String(c.cliId)}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading || (tab === 'historial' && !cliId)}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading || (tab === 'historial' && !cliId)}>
              Exportar PDF
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {data == null ? null : (
        <>
          {tab === 'mora' ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay registros disponibles.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Clientes en mora</div><div className="admin-kpi-value">{data.totalClientesDistintos}</div></article>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Monto pendiente</div><div className="admin-kpi-value">Q{Number(data.montoTotalReferencia || 0).toFixed(2)}</div></article>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Detalle de mora</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Correo</th><th>Teléfono</th><th>Placa</th><th>Vencimiento</th><th>Días mora</th></tr></thead>
                        <tbody>
                          {data.detalle.map((r) => (
                            <tr key={String(r.memId)}>
                              <td>{r.nombreCompleto}</td>
                              <td>{r.correo}</td>
                              <td>{r.telefono}</td>
                              <td>{r.placa}</td>
                              <td>{r.fechaVencimiento || '—'}</td>
                              <td>{r.diasMora}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'estado' ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Activas</div><div className="admin-kpi-value">{data.resumen?.activas ?? 0}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Suspendidas</div><div className="admin-kpi-value">{data.resumen?.suspendidas ?? 0}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Vencidas</div><div className="admin-kpi-value">{data.resumen?.vencidas ?? 0}</div></article>
                  </div>
                  <div className="reporte-inc-chart-wrap">
                    <h3 className="reporte-inc-subtitle">Proporción por estado</h3>
                    <div style={{ height: 260, maxWidth: 360 }}><Pie data={pieDataEstado} /></div>
                  </div>
                  <section className="reporte-inc-card" style={{ marginTop: '0.5rem' }}>
                    <form className="reporte-inc-form" onSubmit={(e) => e.preventDefault()}>
                      <label className="reporte-inc-field"><span>Filtrar por estado</span>
                        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                          <option value="">Todos</option>
                          {estadosOpciones.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                    </form>
                  </section>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Detalle de membresías</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Placa</th><th>Espacio</th><th>Inicio</th><th>Vencimiento</th><th>Estado</th></tr></thead>
                        <tbody>
                          {detalleEstadoFiltrado.map((r) => (
                            <tr key={String(r.memId)}><td>{r.clienteNombre}</td><td>{r.placa}</td><td>{r.espacioAsignado}</td><td>{r.fechaInicio || '—'}</td><td>{r.fechaVencimiento || '—'}</td><td>{r.estadoActual}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'historial' ? (
            <>
              {!data.historial?.length ? <p className="reporte-inc-empty">Este cliente no tiene historial de pagos.</p> : null}
              <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Cliente</div><div className="admin-kpi-value" style={{ fontSize: '1rem' }}>{data.cliente?.nombreCompleto || '—'}</div><div className="admin-kpi-hint">DPI: {data.cliente?.dpi || '—'}</div></article>
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">
                    {(Number(data.totalMembresiasActivas || 0) > 1) ? 'Membresías activas' : 'Membresía actual'}
                  </div>
                  <div className="admin-kpi-value" style={{ fontSize: '1rem' }}>
                    {(Number(data.totalMembresiasActivas || 0) > 1)
                      ? Number(data.totalMembresiasActivas || 0)
                      : (data.membresiaActual?.estado || '—')}
                  </div>
                  {(Number(data.totalMembresiasActivas || 0) > 1) ? null : (
                    <div className="admin-kpi-hint">Vence: {data.membresiaActual?.fechaVencimiento || '—'}</div>
                  )}
                </article>
                <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Total histórico</div><div className="admin-kpi-value">Q{Number(data.totalHistoricoPagado || 0).toFixed(2)}</div></article>
              </div>
              {(Number(data.totalMembresiasActivas || 0) > 1) ? (
                <div className="reporte-inc-table-wrap">
                  <h3 className="reporte-inc-subtitle">Detalle de membresías activas</h3>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>ID membresía</th><th>Placa</th><th>Fecha inicio</th><th>Fecha vencimiento</th><th>Estado</th></tr></thead>
                      <tbody>
                        {(data.membresiasActivas || []).map((m) => (
                          <tr key={String(m.memId)}>
                            <td>{m.memId}</td>
                            <td>{m.placa || '—'}</td>
                            <td>{m.fechaInicio || '—'}</td>
                            <td>{m.fechaVencimiento || '—'}</td>
                            <td>{m.estado || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {data.historial?.length ? (
                <div className="reporte-inc-table-wrap">
                  <h3 className="reporte-inc-subtitle">Historial de pagos</h3>
                  <div className="crudx-table-scroll">
                    <table className="crudx-table reporte-inc-table">
                      <thead><tr><th>Fecha pago</th><th>Placa</th><th>Monto</th><th>Método pago</th><th>Mes cancelado</th></tr></thead>
                      <tbody>
                        {data.historial.map((r) => (
                          <tr key={String(r.id)}><td>{r.fechaPago ? new Date(r.fechaPago).toLocaleString('es-GT') : '—'}</td><td>{r.placa || '—'}</td><td>Q{Number(r.montoPagado || 0).toFixed(2)}</td><td>{r.metodoPago}</td><td>{r.mesCancelado}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </>
  );
}
