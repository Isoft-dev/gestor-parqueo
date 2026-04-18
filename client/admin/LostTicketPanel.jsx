import { useState } from 'react';
import { API_BASE } from '../config.js';

export default function LostTicketPanel() {
  const [placa, setPlaca] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState(null);

  async function preparar() {
    setLoading(true);
    setMsg('');
    setQuote(null);
    try {
      const res = await fetch(`${API_BASE}/ticket/extraviado/preparar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ VEH_PLACA: placa.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setQuote(data);
      setMsg(
        'Estado actualizado a extraviado. Cotización lista para cobro manual (use «Operación cabina» o el API checkout con cobro no procesado por máquina).',
      );
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-panel-block" style={{ marginBottom: 16 }}>
      <h2 className="admin-page-title" style={{ fontSize: '1.1rem', marginTop: 0 }}>
        Ticket extraviado (esporádico)
      </h2>
      <p className="admin-muted" style={{ marginTop: 0 }}>
        Busca por placa, marca el ticket como extraviado y obtén la cotización vigente.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Placa del vehículo"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          style={{ padding: '8px 10px', minWidth: 160 }}
        />
        <button type="button" className="admin-btn-primary" onClick={preparar} disabled={loading || !placa.trim()}>
          {loading ? 'Procesando…' : 'Buscar y marcar extraviado'}
        </button>
      </div>
      {msg ? (
        <p style={{ marginTop: 10 }} role="status">
          {msg}
        </p>
      ) : null}
      {quote?.montoTotal != null ? (
        <p style={{ marginTop: 8 }}>
          <strong>Monto sugerido:</strong> Q{Number(quote.montoTotal).toFixed(2)} (ticket{' '}
          {quote.ticket?.TIC_CODIGO})
        </p>
      ) : null}
    </div>
  );
}
