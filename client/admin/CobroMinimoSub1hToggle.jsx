import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../config.js';

export default function CobroMinimoSub1hToggle() {
  const [cfg, setCfg] = useState(null);
  const [tarifas, setTarifas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [editingQ, setEditingQ] = useState(false);
  const [qDraft, setQDraft] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [rPol, rTar] = await Promise.all([
        fetch(`${API_BASE}/cobro-politica`, { cache: 'no-store' }),
        fetch(`${API_BASE}/tarifa`, { cache: 'no-store' }),
      ]);
      const jPol = await rPol.json().catch(() => ({}));
      const jTar = await rTar.json().catch(() => ([]));
      if (!rPol.ok) throw new Error(jPol.error || jPol.message || rPol.statusText);
      if (!rTar.ok) throw new Error(jTar.error || jTar.message || rTar.statusText);
      setCfg(jPol);
      setTarifas(Array.isArray(jTar) ? jTar : []);
    } catch (e) {
      setErr(e.message);
      setCfg(null);
      setTarifas([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function callApi(body) {
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/cobro-politica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || j.message || r.statusText);
      setCfg(j);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function toggle() {
    if (!cfg || saving) return;
    callApi({ habilitado: !cfg.habilitado, quetzales: cfg.quetzales, tarifaActivaTarId: cfg?.tarifaActivaTarId ?? null });
  }

  function changeTarifaActiva(nextTarId) {
    if (!cfg || saving) return;
    callApi({ habilitado: cfg.habilitado, quetzales: cfg.quetzales, tarifaActivaTarId: Number(nextTarId) });
  }

  function startEditQ() {
    setQDraft(String(cfg?.quetzales ?? 5));
    setEditingQ(true);
  }

  function cancelEditQ() {
    setEditingQ(false);
    setQDraft('');
  }

  function saveQ() {
    const val = parseFloat(qDraft);
    if (isNaN(val) || val < 0) { setErr('Ingresa un monto válido (número ≥ 0).'); return; }
    setEditingQ(false);
    callApi({ habilitado: cfg.habilitado, quetzales: val, tarifaActivaTarId: cfg?.tarifaActivaTarId ?? null });
  }

  function onQKeyDown(e) {
    if (e.key === 'Enter') saveQ();
    if (e.key === 'Escape') cancelEditQ();
  }

  if (cfg == null && !err) {
    return (
      <div className="tarifa-card tarifa-card--loading">
        <span className="tarifa-card__spinner" aria-hidden="true" />
        <span>Cargando política de cobro...</span>
      </div>
    );
  }

  const enabled = !!cfg?.habilitado;
  const tarifaValue = cfg?.tarifaActivaTarId != null
    ? String(cfg.tarifaActivaTarId)
    : (tarifas[0]?.TAR_ID != null ? String(tarifas[0].TAR_ID) : '');
  const tarifaActiva = tarifas.find((t) => String(t.TAR_ID) === tarifaValue);
  const precio = Number(tarifaActiva?.TAR_PRECIO || 0).toFixed(2);
  const gracia = tarifaActiva?.TAR_TIEMPO_GRACIA ?? 0;
  const minimoQ = Number(cfg?.quetzales ?? 5).toFixed(2);

  return (
    <div className="tarifa-card">

      {/* ── Cabecera: selector de tarifa activa */}
      <div className="tarifa-card__header">
        <div className="tarifa-card__icon" aria-hidden="true">Q</div>
        <div className="tarifa-card__header-text">
          <span className="tarifa-card__eyebrow">Tarifa vigente</span>
          <select
            className="tarifa-card__select"
            aria-label="Seleccionar tarifa activa"
            value={tarifaValue}
            disabled={saving || tarifas.length === 0}
            onChange={(e) => changeTarifaActiva(e.target.value)}
          >
            {tarifas.map((t) => (
              <option key={t.TAR_ID} value={String(t.TAR_ID)}>
                {t.TAR_TIPO} — Q{Number(t.TAR_PRECIO || 0).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Nombre de la tarifa */}
      <div className="tarifa-card__name">
        {tarifaActiva ? tarifaActiva.TAR_TIPO : <span className="tarifa-card__empty">Sin tarifa seleccionada</span>}
      </div>

      {/* ── Stats de la tarifa */}
      <div className="tarifa-card__stats">
        <div className="tarifa-card__stat">
          <span className="tarifa-card__stat-label">Precio / hora</span>
          <span className="tarifa-card__stat-value">Q{precio}</span>
        </div>
        <div className="tarifa-card__stat-divider" aria-hidden="true" />
        <div className="tarifa-card__stat">
          <span className="tarifa-card__stat-label">Tiempo de gracia</span>
          <span className="tarifa-card__stat-value">{gracia} min</span>
        </div>
      </div>

      {/* ── Sección de cobro mínimo */}
      <div className={`tarifa-card__minimo${enabled ? ' tarifa-card__minimo--on' : ''}`}>
        <div className="tarifa-card__minimo-info">
          <span className="tarifa-card__minimo-label">Cobro mínimo antes de gracia</span>
          <div className="tarifa-card__minimo-value">
            {editingQ ? (
              <div className="tarifa-card__q-edit">
                <span className="tarifa-card__q-prefix">Q</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="tarifa-card__q-input"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={onQKeyDown}
                  autoFocus
                  aria-label="Monto del cobro mínimo"
                />
                <button type="button" className="tarifa-card__q-save" onClick={saveQ} disabled={saving}>✓</button>
                <button type="button" className="tarifa-card__q-cancel" onClick={cancelEditQ}>✕</button>
              </div>
            ) : (
              <button
                type="button"
                className="tarifa-card__q-display"
                onClick={startEditQ}
                title="Haz clic para editar el monto mínimo"
                disabled={saving}
              >
                Q{minimoQ}
                <span className="tarifa-card__q-edit-hint" aria-hidden="true">✏</span>
              </button>
            )}
            <span className={`tarifa-card__minimo-badge${enabled ? ' is-on' : ' is-off'}`}>
              {enabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={`tarifa-card__toggle${enabled ? ' tarifa-card__toggle--on' : ''}`}
          aria-pressed={enabled}
          disabled={saving || cfg == null}
          onClick={() => toggle()}
        >
          {saving ? 'Guardando...' : enabled ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      {err ? <span className="tarifa-card__err">{err}</span> : null}
    </div>
  );
}
