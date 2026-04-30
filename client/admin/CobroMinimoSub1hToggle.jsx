import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../config.js';

export default function CobroMinimoSub1hToggle() {
  const [cfg, setCfg] = useState(null);
  const [tarifas, setTarifas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

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

  useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (!cfg || saving) return;
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/cobro-politica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habilitado: !cfg.habilitado,
          quetzales: cfg.quetzales,
          tarifaActivaTarId: cfg?.tarifaActivaTarId ?? null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || j.message || r.statusText);
      setCfg(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeTarifaActiva(nextTarId) {
    if (!cfg || saving) return;
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/cobro-politica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habilitado: cfg.habilitado,
          quetzales: cfg.quetzales,
          tarifaActivaTarId: Number(nextTarId),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || j.message || r.statusText);
      setCfg(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (cfg == null && !err) {
    return <span className="cobro-minimo-toggle cobro-minimo-toggle--loading">Cargando política…</span>;
  }

  return (
    <div className="cobro-minimo-toggle">
      <label className="cobro-minimo-toggle__label">
        <input
          type="checkbox"
          checked={!!cfg?.habilitado}
          disabled={saving || cfg == null}
          onChange={() => toggle()}
        />
        <span>Mínimo &lt; 15 min (Q{Number(cfg?.quetzales ?? 5).toFixed(2)})</span>
      </label>
      <label className="cobro-minimo-toggle__label cobro-minimo-toggle__label--tarifa">
        <span className="cobro-minimo-toggle__tarifa-text">Tarifa activa:</span>
        <select
          className="admin-search-select cobro-minimo-toggle__tarifa-select"
          value={
            cfg?.tarifaActivaTarId != null
              ? String(cfg.tarifaActivaTarId)
              : (tarifas[0]?.TAR_ID != null ? String(tarifas[0].TAR_ID) : '')
          }
          disabled={saving || tarifas.length === 0}
          onChange={(e) => changeTarifaActiva(e.target.value)}
        >
          {tarifas.map((t) => (
            <option key={t.TAR_ID} value={String(t.TAR_ID)}>
              {t.TAR_TIPO} - Q{Number(t.TAR_PRECIO || 0).toFixed(2)}
            </option>
          ))}
        </select>
      </label>
      {err ? <span className="cobro-minimo-toggle__err">{err}</span> : null}
    </div>
  );
}
