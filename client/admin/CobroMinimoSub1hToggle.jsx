import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../config.js';

export default function CobroMinimoSub1hToggle() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/cobro-politica`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || j.message || r.statusText);
      setCfg(j);
    } catch (e) {
      setErr(e.message);
      setCfg(null);
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
        body: JSON.stringify({ habilitado: !cfg.habilitado, quetzales: cfg.quetzales }),
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
        <span>Mínimo &lt; 1 h (Q{Number(cfg?.quetzales ?? 5).toFixed(2)})</span>
      </label>
      {err ? <span className="cobro-minimo-toggle__err">{err}</span> : null}
    </div>
  );
}
