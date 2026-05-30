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
  const [preview, setPreview] = useState(null);
  const [mailMode, setMailMode] = useState('simulate');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState('');
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
      const [inboxRes, previewRes] = await Promise.all([
        fetch(`${API_BASE}/notificacion/inbox`, { cache: 'no-store' }),
        fetch(`${API_BASE}/notificacion/jobs/preview`, { cache: 'no-store' }),
      ]);
      const inboxJson = await parseJsonSafe(inboxRes);
      const previewJson = await parseJsonSafe(previewRes);
      if (!inboxRes.ok) throw new Error(inboxJson.error || inboxJson.message || inboxRes.statusText);
      if (!previewRes.ok) throw new Error(previewJson.error || previewJson.message || previewRes.statusText);
      setItems(Array.isArray(inboxJson?.items) ? inboxJson.items : []);
      setMailMode(inboxJson?.mailMode || 'simulate');
      setPreview(previewJson);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutarJob = async ({ force = false, demoOnly = false } = {}) => {
    setError('');
    setInfo('');
    setRunning(demoOnly ? 'demo' : force ? 'force' : 'daily');
    try {
      const res = await fetch(`${API_BASE}/notificacion/jobs/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, demoOnly }),
      });
      const json = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(json.error || json.message || 'El servidor no pudo completar el proceso');
      }
      const recordatorios = json?.result?.reminders?.sent ?? 0;
      const omitidos = json?.result?.reminders?.skipped ?? 0;
      const vencidas = json?.result?.suspension?.vencidas ?? 0;
      if (recordatorios === 0 && !demoOnly) {
        setInfo(
          omitidos > 0
            ? `No se generaron correos nuevos: ${omitidos} membresía(s) ya tenían aviso de hoy o no aplicaban. Usa «Generar demo» o «Forzar reenvío».`
            : 'No hay membresías activas en ventana de recordatorio (3, 2, 1, 0 o −1 día). Prueba «Generar demo de clientes seed».',
        );
      } else {
        setInfo(
          demoOnly
            ? `Demo generado: ${recordatorios} correo(s) simulado(s) para clientes demo.vencer*.`
            : `Job completado: ${recordatorios} recordatorio(s) nuevo(s), ${vencidas} membresía(s) marcada(s) vencida(s).`,
        );
      }
      await cargar();
    } catch (e) {
      const msg = e.message || 'No se pudo ejecutar el job';
      setError(
        /fetch|network|ECONNRESET|Failed to fetch/i.test(msg)
          ? 'No se pudo contactar al servidor. Verifica que el backend (pnpm dev en server/) esté en ejecución.'
          : msg,
      );
    } finally {
      setRunning('');
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

  const elegiblesHoy = preview?.elegiblesHoy ?? 0;
  const enviadosHoy = preview?.enviadosHoy ?? 0;

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Correos simulados</h1>
        <p className="admin-page-desc">
          Aquí ves los avisos de vencimiento de membresía que el sistema enviaría a los clientes.
          En modo simulado no sale correo real: se guarda en la bandeja de abajo.
        </p>
      </header>

      <nav className="correo-flow-bar" aria-label="Pasos del flujo de correos">
        <div className="correo-flow-bar__item correo-flow-bar__item--done">
          <span className="correo-flow-bar__dot">1</span>
          <span>Revisar quién recibiría aviso hoy</span>
        </div>
        <div className="correo-flow-bar__item correo-flow-bar__item--current">
          <span className="correo-flow-bar__dot">2</span>
          <span>Ejecutar el job (simulado)</span>
        </div>
        <div className="correo-flow-bar__item">
          <span className="correo-flow-bar__dot">3</span>
          <span>Leer la bandeja y abrir cada correo</span>
        </div>
      </nav>

      <div className="correo-workspace">
        <section className="correo-panel correo-panel--info">
          <div className="correo-panel__head">
            <span className="correo-panel__step">Paso 1 · Vista previa</span>
            <span
              style={badgeStyle(
                mailMode === 'simulate'
                  ? { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' }
                  : { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
              )}
            >
              Modo {mailMode === 'simulate' ? 'simulado' : 'SMTP real'}
            </span>
          </div>
          <p className="correo-panel__hint">
            El job diario solo procesa membresías <strong>activas</strong> cuyo vencimiento cae
            exactamente en 3, 2, 1, 0 o −1 día(s) respecto a hoy. Si ya se envió el mismo aviso
            hoy, no se repite.
          </p>
          <div className="correo-preview-stats">
            <div className="correo-preview-stat">
              <span className="correo-preview-stat__value">{elegiblesHoy}</span>
              <span className="correo-preview-stat__label">Elegibles hoy</span>
            </div>
            <div className="correo-preview-stat">
              <span className="correo-preview-stat__value">{enviadosHoy}</span>
              <span className="correo-preview-stat__label">Ya enviados hoy</span>
            </div>
            <div className="correo-preview-stat">
              <span className="correo-preview-stat__value">{totales.total}</span>
              <span className="correo-preview-stat__label">En bandeja</span>
            </div>
          </div>
          {(preview?.items?.length > 0) ? (
            <ul className="correo-preview-list">
              {preview.items.slice(0, 6).map((row) => (
                <li key={row.memId}>
                  <span style={badgeStyle(ETAPA_TONO[row.etapa] || ETAPA_TONO['3 días antes'])}>
                    {row.etapa}
                  </span>
                  {' '}
                  {row.nombre || row.correo} · {row.placa} · MEM {row.memId}
                </li>
              ))}
              {preview.items.length > 6 ? (
                <li className="correo-preview-list__more">+ {preview.items.length - 6} más…</li>
              ) : null}
            </ul>
          ) : (
            <p className="correo-panel__empty">
              Hoy no hay membresías en la ventana automática. Usa el botón demo para poblar la bandeja con clientes seed.
            </p>
          )}
        </section>

        <section className="correo-panel correo-panel--action">
          <div className="correo-panel__head">
            <span className="correo-panel__step">Paso 2 · Ejecutar</span>
          </div>
          <p className="correo-panel__hint">
            Elige cómo disparar el proceso. En demo solo se usan clientes <code>demo.vencer*</code> del seed de membresías.
          </p>
          <div className="correo-action-grid">
            <button
              type="button"
              className="admin-btn-primary"
              onClick={() => ejecutarJob({ demoOnly: true, force: true })}
              disabled={!!running}
            >
              {running === 'demo' ? 'Generando…' : 'Generar demo (clientes seed)'}
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => ejecutarJob({ force: false })}
              disabled={!!running}
            >
              {running === 'daily' ? 'Ejecutando…' : 'Job del día (como cron)'}
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => ejecutarJob({ force: true })}
              disabled={!!running}
            >
              {running === 'force' ? 'Reenviando…' : 'Forzar reenvío hoy'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={cargar} disabled={loading}>
              {loading ? 'Recargando…' : 'Actualizar vista'}
            </button>
          </div>
        </section>
      </div>

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

      <section className="correo-panel correo-panel--inbox" style={{ marginTop: '0.85rem' }}>
        <div className="correo-panel__head">
          <span className="correo-panel__step">Paso 3 · Bandeja</span>
        </div>
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
                  <td colSpan={9} className="correo-inbox-empty">
                    {loading
                      ? 'Cargando…'
                      : 'Sin correos en la bandeja. Pulsa «Generar demo (clientes seed)» para ver ejemplos.'}
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
          className="correo-modal-backdrop"
          onClick={() => setSeleccion(null)}
        >
          <div className="correo-modal" onClick={(e) => e.stopPropagation()}>
            <header className="correo-modal__header">
              <div>
                <div className="correo-modal__eyebrow">
                  Notificación #{seleccion.notId} · {seleccion.etapa}
                </div>
                <h2 className="correo-modal__title">{seleccion.asunto || '(sin asunto)'}</h2>
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
            <div className="correo-modal__meta">
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
                <strong>Próximo:</strong> {fmtDate(seleccion.proximaFechaEnvio)}
              </div>
            </div>
            <div className="correo-modal__body">
              <div className="correo-modal__body-label">Cuerpo del correo</div>
              <pre className="correo-modal__pre">{seleccion.cuerpo || '(sin cuerpo registrado)'}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
