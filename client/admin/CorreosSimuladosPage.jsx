import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config.js';

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

const ETAPA_TONO = {
  '3 días antes': { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  '2 días antes': { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
  '1 día antes': { bg: '#fefce8', border: '#fde68a', text: '#92400e' },
  'día del vencimiento': { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  'día siguiente al vencimiento': { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  'aviso de vencimiento': { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  'aviso de suspensión': { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
};

function badgeStyle(tono) {
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 600,
    backgroundColor: tono.bg,
    border: `1px solid ${tono.border}`,
    color: tono.text,
    whiteSpace: 'nowrap',
  };
}

function fmtDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('es-GT');
  } catch {
    return String(value);
  }
}

export default function CorreosSimuladosPage() {
  const [items, setItems] = useState([]);
  const [mailMode, setMailMode] = useState('simulate');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('Todas');
  const [filtroExito, setFiltroExito] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notificacion/inbox`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setItems(Array.isArray(json?.items) ? json.items : []);
      setMailMode(json?.mailMode || 'simulate');
    } catch (e) {
      setError(e.message || 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutarAhora = async () => {
    setError('');
    setInfo('');
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/notificacion/jobs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      const recordatorios = json?.result?.reminders?.sent ?? 0;
      const vencidas = json?.result?.suspension?.vencidas ?? 0;
      const suspendidas = json?.result?.suspension?.suspendidas ?? 0;
      setInfo(
        `Proceso ejecutado. Recordatorios procesados: ${recordatorios}. Membresías vencidas: ${vencidas}. Membresías suspendidas: ${suspendidas}.`,
      );
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo ejecutar el job');
    } finally {
      setRunning(false);
    }
  };

  const etapas = useMemo(() => {
    const set = new Set(items.map((row) => row.etapa).filter(Boolean));
    return ['Todas', ...set];
  }, [items]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((row) => {
      if (filtroEtapa !== 'Todas' && row.etapa !== filtroEtapa) return false;
      if (filtroExito === 'Enviados' && !row.exito) return false;
      if (filtroExito === 'Fallidos' && row.exito) return false;
      if (!q) return true;
      const blob = [
        row.destinatarioNombre,
        row.destinatarioCorreo,
        row.placa,
        row.asunto,
        row.memId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, filtroEtapa, filtroExito, busqueda]);

  const totales = useMemo(() => {
    const total = items.length;
    const enviados = items.filter((r) => r.exito).length;
    const fallidos = total - enviados;
    return { total, enviados, fallidos };
  }, [items]);

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Correos simulados</h1>
        <p className="admin-page-desc">
          Bandeja de los recordatorios de vencimiento de membresía que el sistema envía
          a los clientes. Aquí puedes ver el correo que recibió cada cliente, en qué etapa
          (3 días, 2 días, 1 día antes, día del vencimiento o día siguiente) y si el envío
          fue exitoso.
        </p>
      </header>

      <section className="reporte-inc-card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>
              Modo de envío actual:{' '}
              <span
                style={badgeStyle(
                  mailMode === 'simulate'
                    ? { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' }
                    : { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
                )}
              >
                {mailMode === 'simulate' ? 'Simulado' : 'Envío real'}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="admin-btn-ghost" onClick={cargar} disabled={loading}>
              {loading ? 'Recargando…' : 'Recargar'}
            </button>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={ejecutarAhora}
              disabled={running}
            >
              {running ? 'Ejecutando…' : 'Ejecutar ahora'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="admin-banner admin-banner--error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="admin-banner" role="status" style={{ marginTop: 8 }}>
          {info}
        </div>
      ) : null}

      <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
        <article className="admin-kpi admin-kpi--alerts2">
          <div className="admin-kpi-label">Notificaciones registradas</div>
          <div className="admin-kpi-value">{totales.total}</div>
        </article>
        <article className="admin-kpi admin-kpi--spaces">
          <div className="admin-kpi-label">Enviados con éxito</div>
          <div className="admin-kpi-value">{totales.enviados}</div>
        </article>
        <article className="admin-kpi admin-kpi--alerts">
          <div className="admin-kpi-label">Fallidos</div>
          <div className="admin-kpi-value">{totales.fallidos}</div>
        </article>
      </div>

      <section className="reporte-inc-card" style={{ marginTop: '0.75rem' }}>
        <form className="reporte-inc-form" onSubmit={(e) => e.preventDefault()}>
          <label className="reporte-inc-field" style={{ minWidth: 220 }}>
            <span>Buscar</span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente, correo, placa, asunto…"
            />
          </label>
          <label className="reporte-inc-field">
            <span>Etapa</span>
            <select value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
              {etapas.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="reporte-inc-field">
            <span>Estado</span>
            <select value={filtroExito} onChange={(e) => setFiltroExito(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="Enviados">Enviados</option>
              <option value="Fallidos">Fallidos</option>
            </select>
          </label>
        </form>
      </section>

      <div className="reporte-inc-table-wrap">
        <div className="crudx-table-scroll">
          <table className="crudx-table reporte-inc-table">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Destinatario</th>
                <th>Correo</th>
                <th>Placa</th>
                <th>Asunto</th>
                <th>Enviado</th>
                <th>Próximo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!filtrados.length ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '1.25rem' }}>
                    {loading ? 'Cargando…' : 'Sin notificaciones para los filtros actuales.'}
                  </td>
                </tr>
              ) : null}
              {filtrados.map((row) => {
                const tono =
                  ETAPA_TONO[row.etapa] || {
                    bg: '#f1f5f9',
                    border: '#cbd5e1',
                    text: '#334155',
                  };
                return (
                  <tr key={String(row.notId)}>
                    <td>
                      <span style={badgeStyle(tono)}>{row.etapa}</span>
                    </td>
                    <td>{row.destinatarioNombre || '—'}</td>
                    <td>{row.destinatarioCorreo || '—'}</td>
                    <td>{row.placa || '—'}</td>
                    <td style={{ maxWidth: 280 }}>{row.asunto || '—'}</td>
                    <td>{fmtDate(row.ultimaFechaEnvio)}</td>
                    <td>{fmtDate(row.proximaFechaEnvio)}</td>
                    <td>
                      {row.exito ? (
                        <span
                          style={badgeStyle({ bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' })}
                        >
                          ✓ enviado
                        </span>
                      ) : (
                        <span
                          style={badgeStyle({ bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' })}
                        >
                          ✕ fallo
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn-ghost"
                        onClick={() => setSeleccion(row)}
                      >
                        Ver correo
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {seleccion ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSeleccion(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <header
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Notificación #{seleccion.notId} · {seleccion.etapa}
                </div>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>
                  {seleccion.asunto || '(sin asunto)'}
                </h2>
              </div>
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => setSeleccion(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: 8, fontSize: '0.9rem' }}>
              <div>
                <strong>Para:</strong> {seleccion.destinatarioNombre || '—'}{' '}
                {seleccion.destinatarioCorreo ? `<${seleccion.destinatarioCorreo}>` : ''}
              </div>
              <div>
                <strong>Placa:</strong> {seleccion.placa || '—'} · <strong>MEM_ID:</strong>{' '}
                {seleccion.memId}
              </div>
              <div>
                <strong>Enviado:</strong> {fmtDate(seleccion.ultimaFechaEnvio)} ·{' '}
                <strong>Próximo programado:</strong> {fmtDate(seleccion.proximaFechaEnvio)}
              </div>
              <div>
                <strong>Estado:</strong>{' '}
                {seleccion.exito ? 'Enviado correctamente' : 'El envío no se concretó'}
              </div>
            </div>
            <div
              style={{
                padding: '0 1.25rem 1.25rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Cuerpo del correo</div>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  fontFamily: 'inherit',
                  fontSize: '0.92rem',
                  margin: 0,
                }}
              >
                {seleccion.cuerpo || '(sin cuerpo registrado)'}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
