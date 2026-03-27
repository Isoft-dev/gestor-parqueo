import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';

function decodePdfText(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

function extractTicketCodeFromPdfText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  const explicit =
    normalized.match(/TIC[_\s-]*CODIGO[^A-Z0-9]*([A-Z0-9-]{4,40})/i) ||
    normalized.match(/TICKET[^A-Z0-9]*([A-Z0-9-]{4,40})/i);
  if (explicit?.[1]) return explicit[1].trim().toUpperCase();
  const generic = normalized.match(/\b[A-Z0-9]{3,8}-[A-Z0-9-]{2,30}\b/);
  return generic?.[0]?.trim().toUpperCase() || '';
}

export default function TicketLoaderPage() {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState(null);
  const [tiposCobro, setTiposCobro] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [tcoId, setTcoId] = useState('');
  const [maqId, setMaqId] = useState('');
  const [nit, setNit] = useState('');
  const [cf, setCf] = useState(false);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [checkoutDone, setCheckoutDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/tipo-cobro`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setTiposCobro(Array.isArray(data) ? data : []);
      } catch {
        setTiposCobro([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/maquina`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMaquinas(Array.isArray(data) ? data : []);
      } catch {
        setMaquinas([]);
      }
    })();
  }, []);

  async function onLoadPdf(file) {
    setLoading(true);
    setMsg('');
    setQuote(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = decodePdfText(buffer);
      const ticCodigo = extractTicketCodeFromPdfText(pdfText);
      if (!ticCodigo) {
        setMsg('Ticket no reconocido: no se pudo extraer TIC_CODIGO del PDF.');
        return;
      }

      const res = await fetch(`${API_BASE}/ticket/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TIC_CODIGO: ticCodigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setQuote(data);
      setCheckoutDone(null);
      setMsg('');
    } catch (err) {
      const txt = String(err?.message || '');
      if (/ya saldado/i.test(txt)) {
        setMsg('El ticket ya está saldado. Carga un ticket diferente para continuar.');
        setQuote(null);
        return;
      }
      if (/no reconocido/i.test(txt)) {
        setMsg('Ticket no reconocido.');
        setQuote(null);
        return;
      }
      setMsg(`Error: ${txt}`);
      setQuote(null);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submitCheckout() {
    if (!tcoId) {
      setMsg('No se puede continuar sin haber seleccionado un tipo de cobro.');
      return;
    }
    if (!cf && !String(nit || '').trim()) {
      setMsg('No se puede continuar sin haber ingresado NIT o seleccionado CF.');
      return;
    }
    if (!maqId) {
      setMsg('Debes seleccionar una máquina de cobro.');
      return;
    }
    if (!quote?.ticket?.TIC_CODIGO) {
      setMsg('Primero debes cargar un ticket válido.');
      return;
    }
    if (!montoRecibido || Number(montoRecibido) < Number(quote?.montoTotal || 0)) {
      setMsg('El efectivo ingresado debe ser mayor o igual al monto total.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/ticket/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TIC_CODIGO: quote.ticket.TIC_CODIGO,
          TCO_ID: tcoId,
          MAQ_ID: maqId,
          COB_NIT: cf ? 'CF' : nit,
          USE_CF: cf,
          COB_MONTO_RECIBIDO: Number(montoRecibido),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCheckoutDone(data);
      setQuote(null);
      setMsg('Cobro registrado correctamente.');
      setNit('');
      setCf(false);
      setTcoId('');
      setMaqId('');
      setMontoRecibido('');
    } catch (err) {
      setMsg(`Error: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  }

  function resetProcess() {
    setQuote(null);
    setCheckoutDone(null);
    setMsg('');
    setTcoId('');
    setMaqId('');
    setNit('');
    setCf(false);
    setMontoRecibido('');
  }

  function downloadReceiptAndReset() {
    if (!checkoutDone?.TIC_ID) return;
    window.open(`${API_BASE}/ticket/${checkoutDone.TIC_ID}/comprobante.pdf`, '_blank');
    resetProcess();
  }

  return (
    <div style={{ maxWidth: 860, margin: '22px auto', fontFamily: 'system-ui,sans-serif', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Consulta de ticket</h1>
        <Link to="/admin">Ir a panel admin</Link>
      </div>
      <p style={{ color: '#555', marginTop: 0 }}>
        Carga el PDF de tu ticket para conocer tiempo de estadía y monto a pagar.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onLoadPdf(f);
        }}
      />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}>
        Cargar Ticket
      </button>
      {loading ? <span style={{ marginLeft: 10 }}>Procesando...</span> : null}

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, border: '1px solid #e2b4b4', background: '#fff4f4', color: '#8a1f1f' }}>
          {msg}
        </div>
      ) : null}

      {quote && (
        <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 8, padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Detalle de pago</h2>
          <p style={{ margin: '6px 0' }}>
            <strong>Ticket:</strong> {quote.ticket?.TIC_CODIGO} ({quote.ticket?.TIC_ID})
          </p>
          <p style={{ margin: '6px 0' }}>
            <strong>Placa:</strong> {quote.ticket?.VEH_PLACA || 'N/D'}
          </p>
          <p style={{ margin: '6px 0' }}>
            <strong>Entrada:</strong>{' '}
            {quote.ticket?.TIC_FECHA_HORA_ENTRADA
              ? new Date(quote.ticket.TIC_FECHA_HORA_ENTRADA).toLocaleString('es-GT')
              : 'N/D'}
          </p>
          <p style={{ margin: '6px 0' }}>
            <strong>Tiempo de estadía:</strong> {quote.estadia?.horasFacturables} horas facturables
            ({quote.estadia?.minutosFacturables} min)
          </p>
          <p style={{ margin: '6px 0' }}>
            <strong>Tarifa vigente:</strong> {quote.tarifa?.TAR_TIPO} - Q{quote.tarifa?.TAR_PRECIO} / hora
          </p>
          <p style={{ margin: '6px 0', fontSize: 18 }}>
            <strong>Monto total a pagar: Q{quote.montoTotal}</strong>
          </p>
          <hr />
          <h3 style={{ marginBottom: 8 }}>Facturación</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={tcoId} onChange={(e) => setTcoId(e.target.value)} style={{ padding: '8px 10px', minWidth: 260 }}>
              <option value="">Selecciona tipo de cobro</option>
              {tiposCobro.map((t) => (
                <option key={t.TCO_ID} value={t.TCO_ID}>
                  {t.TCO_TIPO} (ID {t.TCO_ID})
                </option>
              ))}
            </select>
            <select value={maqId} onChange={(e) => setMaqId(e.target.value)} style={{ padding: '8px 10px', minWidth: 220 }}>
              <option value="">Selecciona máquina de cobro</option>
              {maquinas.map((m) => (
                <option key={m.MAQ_ID} value={m.MAQ_ID}>
                  {m.MAQ_CODIGO || `MAQ ${m.MAQ_ID}`} (ID {m.MAQ_ID})
                </option>
              ))}
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={cf}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCf(checked);
                  if (checked) setNit('');
                }}
              />
              Consumidor final (CF)
            </label>
            <input
              type="text"
              placeholder="Ingresa NIT"
              value={nit}
              disabled={cf}
              onChange={(e) => setNit(e.target.value)}
              style={{ padding: '8px 10px', minWidth: 180 }}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Efectivo recibido"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              style={{ padding: '8px 10px', minWidth: 170 }}
            />
            <button type="button" onClick={submitCheckout} disabled={loading}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {checkoutDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Cobro registrado</strong>
          <p style={{ margin: '6px 0' }}>Ticket: {checkoutDone.TIC_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>COB_ID: {checkoutDone.COB_ID}</p>
          <p style={{ margin: '6px 0' }}>Tipo cobro: {checkoutDone.TCO_ID}</p>
          <p style={{ margin: '6px 0' }}>NIT/CF: {checkoutDone.COB_NIT}</p>
          <p style={{ margin: '6px 0' }}>Efectivo: Q{checkoutDone.COB_MONTO_RECIBIDO}</p>
          <p style={{ margin: '6px 0' }}>Vuelto: Q{checkoutDone.COB_VUELTO}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={downloadReceiptAndReset}>Descargar comprobante</button>
            <button type="button" onClick={resetProcess}>Rechazar comprobante</button>
          </div>
        </div>
      )}
    </div>
  );
}
