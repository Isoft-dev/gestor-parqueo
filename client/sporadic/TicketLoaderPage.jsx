import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { API_BASE } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

async function decodePdfText(buffer) {
  try {
    const pdf = await getDocument({ data: buffer }).promise;
    const parts = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((i) => i.str).join(' '));
    }
    const parsed = parts.join(' ').trim();
    if (parsed) return parsed;
  } catch {
    // fallback below for malformed PDFs
  }
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

function extractTicketCodeFromPdfText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  const explicitCandidates = [
    normalized.match(/TIC[_\s-]*CODIGO[^A-Z0-9]*([A-Z0-9-]{6,40})/i)?.[1],
    normalized.match(/CODIGO\s*TICKET[^A-Z0-9]*([A-Z0-9-]{6,40})/i)?.[1],
    normalized.match(/TICKET\s*ID[^A-Z0-9]*([A-Z0-9-]{1,12})/i)?.[1],
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase());

  for (const c of explicitCandidates) {
    if (/[A-Z]/.test(c) && /\d/.test(c)) return c;
  }

  // Formato esperado de ticket generado por backend: DDMMYYHHmm + PLACA
  const formatoGenerado = normalized.match(/\b\d{10}[A-Z0-9]{3,20}\b/i);
  if (formatoGenerado?.[0]) return formatoGenerado[0].trim().toUpperCase();

  const generic = normalized.match(/\b[A-Z0-9]{3,8}-[A-Z0-9-]{2,30}\b/i);
  return generic?.[0]?.trim().toUpperCase() || '';
}

function extractMemCodeFromPdfText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ');
  const explicit =
    normalized.match(/MEM[_\s-]*CODIGO[^A-Z0-9]*([A-Z0-9-]{6,40})/i) ||
    normalized.match(/CODIGO[^A-Z0-9]*([A-Z0-9-]{6,40})/i) ||
    normalized.match(/TAG[^A-Z0-9]*([A-Z0-9-]{6,40})/i);
  if (explicit?.[1]) return explicit[1].trim().toUpperCase();
  const generic = normalized.match(/\b\d{6}[A-Z0-9]{1,25}\b/);
  return generic?.[0]?.trim().toUpperCase() || '';
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomPlate() {
  const firstOnly = 'PMAO';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
  return (
    pick(firstOnly) +
    pick(nums) +
    pick(nums) +
    pick(nums) +
    pick(letters) +
    pick(letters) +
    pick(letters)
  );
}

function generateVehicleData() {
  const models = ['Corolla', 'Civic', 'Hilux', 'Sportage', 'Elantra', 'Accent', 'RAV4'];
  const colors = ['Negro', 'Blanco', 'Plata', 'Rojo', 'Azul', 'Gris'];
  return {
    VEH_PLACA: generateRandomPlate(),
    VEH_MODELO: randomFrom(models),
    VEH_COLOR: randomFrom(colors),
  };
}

export default function TicketLoaderPage({ embeddedInAdmin = false }) {
  const { user, logout } = useAuth();
  const fileRef = useRef(null);
  const tagFileRef = useRef(null);
  const salidaFileRef = useRef(null);
  const tagSalidaFileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState(null);
  const [tipoVehiculo, setTipoVehiculo] = useState([]);
  const [tiposCobro, setTiposCobro] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [entryTicketDone, setEntryTicketDone] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({
    VEH_PLACA: '',
    VEH_MODELO: '',
    VEH_COLOR: '',
    TVE_ID: '',
    MAQ_ID: '',
  });
  const [tcoId, setTcoId] = useState('');
  const [maqId, setMaqId] = useState('');
  const [nit, setNit] = useState('');
  const [cf, setCf] = useState(false);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [checkoutDone, setCheckoutDone] = useState(null);
  const [tagValidationDone, setTagValidationDone] = useState(null);
  const [tagExitValidationDone, setTagExitValidationDone] = useState(null);
  const [exitMaqId, setExitMaqId] = useState('');
  const [exitValidationDone, setExitValidationDone] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [espacioResumen, setEspacioResumen] = useState(null);
  const [assistMaqId, setAssistMaqId] = useState('');
  const [billetes, setBilletes] = useState({ 5: 0, 10: 0, 20: 0, 50: 0 });
  const [assistMsg, setAssistMsg] = useState('');
  const montoTotalCalculado = Number(quote?.montoTotal || 0);
  const horasCalculadas = Number(
    quote?.estadia?.horasCobradas ?? quote?.estadia?.horasFacturables ?? 0,
  );
  const montoRecibidoNum = Number(montoRecibido);
  const vueltoCalculado =
    Number.isFinite(montoRecibidoNum) && montoRecibidoNum >= montoTotalCalculado
      ? Number((montoRecibidoNum - montoTotalCalculado).toFixed(2))
      : 0;

  const sumaBilletes =
    billetes[5] * 5 + billetes[10] * 10 + billetes[20] * 20 + billetes[50] * 50;

  /** Solo dígitos y un punto decimal; nunca negativos (evita que `min` del input sea insuficiente). */
  function onMontoRecibidoChange(raw) {
    let v = String(raw ?? '').replace(/,/g, '.');
    v = v.replace(/[^0-9.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
    setMontoRecibido(v);
  }

  useEffect(() => {
    let cancelled = false;
    async function pollEspacios() {
      try {
        const res = await fetch(`${API_BASE}/espacio/resumen-publico`);
        const data = await res.json();
        if (!cancelled && res.ok) setEspacioResumen(data);
      } catch {
        /* kiosk sin API */
      }
    }
    pollEspacios();
    const t = setInterval(pollEspacios, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      try {
        const [rTve, rCobro, rMaq] = await Promise.all([
          fetch(`${API_BASE}/tipo-vehiculo`),
          fetch(`${API_BASE}/tipo-cobro`),
          fetch(`${API_BASE}/maquina`),
        ]);
        const [dTve, dCobro, dMaq] = await Promise.all([
          rTve.json(),
          rCobro.json(),
          rMaq.json(),
        ]);
        if (!rTve.ok) throw new Error(dTve.error || rTve.statusText);
        if (!rCobro.ok) throw new Error(dCobro.error || rCobro.statusText);
        if (!rMaq.ok) throw new Error(dMaq.error || rMaq.statusText);
        setTipoVehiculo(Array.isArray(dTve) ? dTve : []);
        setTiposCobro(Array.isArray(dCobro) ? dCobro : []);
        setMaquinas(Array.isArray(dMaq) ? dMaq : []);
        if (Array.isArray(dMaq) && dMaq[0]?.MAQ_ID != null) {
          setAssistMaqId((prev) => prev || String(dMaq[0].MAQ_ID));
        }
      } catch {
        setTipoVehiculo([]);
        setTiposCobro([]);
        setMaquinas([]);
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, []);

  async function enviarAsistencia(motivoExtra) {
    if (!assistMaqId) {
      setAssistMsg('Selecciona una máquina para asociar la asistencia.');
      return;
    }
    setAssistMsg('');
    try {
      const res = await fetch(`${API_BASE}/alerta/solicitud-asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MAQ_ID: assistMaqId,
          ALE_MOTIVO: motivoExtra || 'Solicitud de asistencia',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setAssistMsg(
        data?.ALE_ID != null
          ? `Solicitud registrada (alerta #${data.ALE_ID}). Revisa gestión de alertas.`
          : 'Solicitud enviada al panel.',
      );
    } catch (e) {
      setAssistMsg(`No se pudo enviar: ${String(e?.message || e)}`);
    }
  }

  function applyAutocompletado() {
    const generated = generateVehicleData();
    const defaultTve = String(tipoVehiculo?.[0]?.TVE_ID ?? '');
    const defaultMaq = String(maquinas?.[0]?.MAQ_ID ?? '');
    setVehicleForm({
      VEH_PLACA: generated.VEH_PLACA,
      VEH_MODELO: generated.VEH_MODELO,
      VEH_COLOR: generated.VEH_COLOR,
      TVE_ID: defaultTve,
      MAQ_ID: defaultMaq,
    });
  }

  async function submitGenerateTicket() {
    if (!vehicleForm.VEH_PLACA || !vehicleForm.TVE_ID || !vehicleForm.MAQ_ID) {
      setMsg('Para generar ticket debes ingresar placa, tipo de vehículo y máquina.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/ticket/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          VEH_PLACA: vehicleForm.VEH_PLACA,
          VEH_MODELO: vehicleForm.VEH_MODELO,
          VEH_COLOR: vehicleForm.VEH_COLOR,
          TVE_ID: vehicleForm.TVE_ID,
          MAQ_ID: vehicleForm.MAQ_ID,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setEntryTicketDone(data);
      setShowGenerateForm(false);
      setVehicleForm({
        VEH_PLACA: '',
        VEH_MODELO: '',
        VEH_COLOR: '',
        TVE_ID: '',
        MAQ_ID: '',
      });
      setMsg('Ticket de entrada generado correctamente.');
    } catch (err) {
      setMsg(`Error: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function onLoadPdf(file) {
    setLoading(true);
    setMsg('');
    setQuote(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
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

  async function onLoadTagPdf(file) {
    setLoading(true);
    setMsg('');
    setTagValidationDone(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const memCodigo = extractMemCodeFromPdfText(pdfText);
      if (!memCodigo) {
        setMsg('Tag no reconocido: no se pudo extraer MEM_CODIGO del PDF.');
        return;
      }
      const res = await fetch(`${API_BASE}/membresia/validate-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ MEM_CODIGO: memCodigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setTagValidationDone(data);
      setMsg('Acceso concedido.');
    } catch (err) {
      const txt = String(err?.message || '');
      if (/tag no reconocido/i.test(txt)) {
        setMsg('Tag no reconocido.');
      } else if (/suspendida/i.test(txt)) {
        setMsg('Acceso denegado: membresía suspendida.');
      } else if (/vencida/i.test(txt)) {
        setMsg('Acceso denegado: membresía vencida.');
      } else {
        setMsg(`Error: ${txt}`);
      }
      setTagValidationDone(null);
    } finally {
      setLoading(false);
      if (tagFileRef.current) tagFileRef.current.value = '';
    }
  }

  async function onLoadTagExitPdf(file) {
    setLoading(true);
    setMsg('');
    setTagExitValidationDone(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const memCodigo = extractMemCodeFromPdfText(pdfText);
      if (!memCodigo) {
        setMsg('Tag no reconocido: no se pudo extraer MEM_CODIGO del PDF.');
        return;
      }
      const res = await fetch(`${API_BASE}/membresia/validate-tag-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ MEM_CODIGO: memCodigo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setTagExitValidationDone(data);
      setMsg('Salida mensual registrada.');
    } catch (err) {
      const txt = String(err?.message || '');
      if (/tag no reconocido/i.test(txt)) {
        setMsg('Tag no reconocido.');
      } else if (/ingreso activo asociado/i.test(txt)) {
        setMsg('No se encontró un ingreso activo asociado.');
      } else {
        setMsg(`Error: ${txt}`);
      }
      setTagExitValidationDone(null);
    } finally {
      setLoading(false);
      if (tagSalidaFileRef.current) tagSalidaFileRef.current.value = '';
    }
  }

  async function onLoadExitPdf(file) {
    if (!exitMaqId) {
      setMsg('Selecciona la máquina de salida antes de cargar el ticket.');
      return;
    }
    setLoading(true);
    setMsg('');
    setExitValidationDone(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const ticCodigo = extractTicketCodeFromPdfText(pdfText);
      if (!ticCodigo) {
        setMsg('Ticket no reconocido: no se pudo extraer TIC_CODIGO del PDF.');
        return;
      }
      const res = await fetch(`${API_BASE}/ticket/exit-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TIC_CODIGO: ticCodigo,
          MAQ_ID: exitMaqId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setExitValidationDone(data);
      setMsg('Salida autorizada.');
    } catch (err) {
      const txt = String(err?.message || '');
      if (/no reconocido/i.test(txt)) {
        setMsg('Ticket no reconocido.');
      } else if (/no esta pagado/i.test(txt)) {
        setMsg('Salida bloqueada: el ticket no está pagado. Dirígete a la máquina de cobro.');
      } else if (/gracia superado|solicita asistencia/i.test(txt)) {
        setMsg('Salida bloqueada: superó el tiempo de gracia. Solicita asistencia.');
      } else {
        setMsg(`Error: ${txt}`);
      }
      setExitValidationDone(null);
    } finally {
      setLoading(false);
      if (salidaFileRef.current) salidaFileRef.current.value = '';
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
    const recibido = Number(montoRecibido);
    if (!montoRecibido.trim() || !Number.isFinite(recibido) || recibido < 0) {
      setMsg('El monto recibido debe ser un número mayor o igual a cero.');
      return;
    }
    if (recibido < montoTotalCalculado) {
      setMsg('El efectivo ingresado debe ser mayor o igual al monto total.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const payload = {
        TIC_CODIGO: quote.ticket.TIC_CODIGO,
        TCO_ID: tcoId,
        MAQ_ID: maqId,
        COB_NIT: cf ? 'CF' : nit,
        USE_CF: cf,
        COB_MONTO_RECIBIDO: recibido,
      };
      const tieneBilletes = Object.values(billetes).some((n) => n > 0);
      if (tieneBilletes) {
        payload.BILLETES_INGRESO = { ...billetes };
      }
      const res = await fetch(`${API_BASE}/ticket/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
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
    setEntryTicketDone(null);
    setTagValidationDone(null);
    setTagExitValidationDone(null);
    setExitValidationDone(null);
    setExitMaqId('');
    setShowGenerateForm(false);
    setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
  }

  function downloadReceiptAndReset() {
    if (!checkoutDone?.TIC_ID) return;
    window.open(`${API_BASE}/ticket/${checkoutDone.TIC_ID}/comprobante.pdf`, '_blank');
    resetProcess();
  }

  return (
    <div
      className={embeddedInAdmin ? 'ops-shell ops-shell--embedded' : 'admin-page ops-page-public'}
      style={{ maxWidth: embeddedInAdmin ? '100%' : 1040, margin: '12px auto', padding: 16 }}
    >
      <header className={`admin-page-header ${embeddedInAdmin ? 'ops-top-row' : 'ops-page-header'}`}>
        <h1 className="admin-page-title">{embeddedInAdmin ? 'Operación en cabina' : 'Consulta de ticket'}</h1>
        {!embeddedInAdmin ? (
          user ? (
            <button
              type="button"
              className="ops-header-auth-btn"
              onClick={() => logout()}
            >
              Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="ops-header-auth-link">
              Ir al panel de admin
            </Link>
          )
        ) : null}
      </header>
      <p className="admin-page-desc">
        Puedes generar ticket de entrada o cargar ticket para continuar con el cobro.
      </p>
      {espacioResumen ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: espacioResumen.parqueoLleno ? '#fff4f4' : '#f0fdf4',
            border: `1px solid ${espacioResumen.parqueoLleno ? '#f5c2c2' : '#86efac'}`,
          }}
        >
          <strong>Espacios disponibles:</strong> {espacioResumen.disponibles ?? '—'} de {espacioResumen.total ?? '—'}
          {espacioResumen.parqueoLleno ? (
            <span style={{ color: '#991b1b', marginLeft: 8 }}>Parqueo lleno — no se puede generar ticket.</span>
          ) : null}
        </div>
      ) : null}
      <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>Máquina para alertas de asistencia:</span>
        <select
          value={assistMaqId}
          onChange={(e) => setAssistMaqId(e.target.value)}
          style={{ padding: '6px 10px', minWidth: 200 }}
        >
          <option value="">—</option>
          {maquinas.map((m) => (
            <option key={m.MAQ_ID} value={m.MAQ_ID}>
              {m.MAQ_CODIGO || `MAQ ${m.MAQ_ID}`}
            </option>
          ))}
        </select>
        {assistMsg ? <span style={{ fontSize: 13, color: '#065f46' }}>{assistMsg}</span> : null}
      </div>
      {catalogLoading ? (
        <div className="ops-loader-wrap">
          <span className="ops-loader" aria-hidden="true" />
          <span>Cargando catálogos base...</span>
        </div>
      ) : null}

      <section className="admin-panel-block ops-panel-block">
        <div className="admin-panel-head">
          <h2>Cliente mensual (Tag)</h2>
          <p className="admin-panel-sub">Sección exclusiva para validar tag de membresía.</p>
        </div>
        <input
          ref={tagFileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadTagPdf(f);
          }}
        />
        <button type="button" className="admin-btn-primary" onClick={() => tagFileRef.current?.click()} disabled={loading || catalogLoading} style={{ marginTop: 10 }}>
          Validar Tag
        </button>
      </section>

      <section className="admin-panel-block ops-panel-block">
        <div className="admin-panel-head">
          <h2>Salida cliente mensual</h2>
          <p className="admin-panel-sub">Carga el tag para cerrar un ingreso activo asociado a la membresía.</p>
        </div>
        <input
          ref={tagSalidaFileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadTagExitPdf(f);
          }}
        />
        <button type="button" className="admin-btn-primary" onClick={() => tagSalidaFileRef.current?.click()} disabled={loading || catalogLoading} style={{ marginTop: 10 }}>
          Cargar Tag
        </button>
      </section>

      <section className="admin-panel-block ops-panel-block">
        <div className="admin-panel-head">
          <h2>Salida cliente esporádico</h2>
          <p className="admin-panel-sub">
            Carga el ticket para verificar estado de pago y tiempo de gracia post-pago.
          </p>
        </div>
        <input
          ref={salidaFileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onLoadExitPdf(f);
          }}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={exitMaqId}
            onChange={(e) => setExitMaqId(e.target.value)}
            style={{ padding: '8px 10px', minWidth: 250 }}
          >
            <option value="">Selecciona máquina de salida</option>
            {maquinas.map((m) => (
              <option key={m.MAQ_ID} value={m.MAQ_ID}>
                {m.MAQ_CODIGO || `MAQ ${m.MAQ_ID}`} (ID {m.MAQ_ID})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => salidaFileRef.current?.click()}
            disabled={loading || catalogLoading}
          >
            Cargar Ticket
          </button>
        </div>
      </section>

      <div className="ops-main-ticket-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="admin-btn-primary"
          onClick={() => { setShowGenerateForm((v) => !v); setMsg(''); }}
          disabled={loading || catalogLoading || espacioResumen?.parqueoLleno}
        >
          Generar Ticket
        </button>
        <button
          type="button"
          className="admin-btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={loading || catalogLoading}
          title="Selecciona el PDF del ticket para cotizar y completar el pago en el detalle de cobro."
        >
          Pagar ticket
        </button>
      </div>

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
      {loading ? <span style={{ marginLeft: 10 }}>Procesando...</span> : null}

      {msg ? (
        <div style={{ marginTop: 12, padding: 10, border: '1px solid #e2b4b4', background: '#fff4f4', color: '#8a1f1f' }}>
          {msg}
        </div>
      ) : null}

      {showGenerateForm && (
        <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 8, padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Generar ticket de entrada</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Placa"
              value={vehicleForm.VEH_PLACA}
              onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_PLACA: e.target.value.toUpperCase() }))}
              style={{ padding: '8px 10px', minWidth: 160 }}
            />
            <input
              type="text"
              placeholder="Modelo"
              value={vehicleForm.VEH_MODELO}
              onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_MODELO: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 160 }}
            />
            <input
              type="text"
              placeholder="Color"
              value={vehicleForm.VEH_COLOR}
              onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_COLOR: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 140 }}
            />
            <select
              value={vehicleForm.TVE_ID}
              onChange={(e) => setVehicleForm((p) => ({ ...p, TVE_ID: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 220 }}
            >
              <option value="">Selecciona tipo de vehículo</option>
              {tipoVehiculo.map((t) => (
                <option key={t.TVE_ID} value={t.TVE_ID}>
                  {t.TVE_TIPO || `Tipo ${t.TVE_ID}`} (ID {t.TVE_ID})
                </option>
              ))}
            </select>
            <select
              value={vehicleForm.MAQ_ID}
              onChange={(e) => setVehicleForm((p) => ({ ...p, MAQ_ID: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 220 }}
            >
              <option value="">Selecciona máquina de entrada</option>
              {maquinas.map((m) => (
                <option key={m.MAQ_ID} value={m.MAQ_ID}>
                  {m.MAQ_CODIGO || `MAQ ${m.MAQ_ID}`} (ID {m.MAQ_ID})
                </option>
              ))}
            </select>
            <button type="button" onClick={applyAutocompletado} disabled={loading}>Autocompletado</button>
            <button type="button" onClick={submitGenerateTicket} disabled={loading}>Confirmar</button>
          </div>
        </div>
      )}

      {entryTicketDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Ticket generado</strong>
          <p style={{ margin: '6px 0' }}>Ticket: {entryTicketDone.TIC_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Placa: {entryTicketDone.VEH_PLACA}</p>
          <p style={{ margin: '6px 0' }}>Hora entrada: {new Date(entryTicketDone.TIC_FECHA_HORA_ENTRADA).toLocaleString('es-GT')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => window.open(`${API_BASE}/ticket/${entryTicketDone.TIC_ID}/entrada.pdf`, '_blank')}>
              Descargar ticket PDF
            </button>
            <button type="button" onClick={resetProcess}>Finalizar</button>
          </div>
        </div>
      )}

      {tagValidationDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Acceso concedido</strong>
          <p style={{ margin: '6px 0' }}>Membresía: {tagValidationDone.MEM_ID}</p>
          <p style={{ margin: '6px 0' }}>Código: {tagValidationDone.MEM_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Placa: {tagValidationDone.VEH_PLACA || 'N/D'}</p>
        </div>
      )}

      {tagExitValidationDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Salida mensual registrada</strong>
          <p style={{ margin: '6px 0' }}>Membresía: {tagExitValidationDone.MEM_ID}</p>
          <p style={{ margin: '6px 0' }}>Código: {tagExitValidationDone.MEM_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Registro movimiento: {tagExitValidationDone.RMM_ID}</p>
          <p style={{ margin: '6px 0' }}>
            Hora salida: {new Date(tagExitValidationDone.RMM_FECHA_HORA_SALIDA).toLocaleString('es-GT')}
          </p>
        </div>
      )}

      {exitValidationDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Salida autorizada</strong>
          <p style={{ margin: '6px 0' }}>Ticket: {exitValidationDone.TIC_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Minutos desde pago: {exitValidationDone.minutesSincePayment}</p>
          <p style={{ margin: '6px 0' }}>Gracia permitida (min): {exitValidationDone.graceMinutes}</p>
        </div>
      )}

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
            <strong>Monto total a pagar: Q{montoTotalCalculado.toFixed(2)}</strong>
          </p>
          <hr />
          <h3 style={{ marginBottom: 8 }}>Facturación (campos automáticos y manuales)</h3>
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
              value={horasCalculadas}
              readOnly
              disabled
              style={{ padding: '8px 10px', minWidth: 150, background: '#f3f4f6' }}
              title="Se calcula automáticamente según hora de entrada y tarifa"
            />
            <input
              type="number"
              value={montoTotalCalculado.toFixed(2)}
              readOnly
              disabled
              style={{ padding: '8px 10px', minWidth: 150, background: '#f3f4f6' }}
              title="Monto total calculado automáticamente"
            />
            <div style={{ width: '100%', marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Simulación de billetes (Q5, Q10, Q20, Q50)</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {[5, 10, 20, 50].map((d) => (
                  <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setBilletes((b) => ({ ...b, [d]: Math.max(0, (b[d] || 0) + 1) }))
                      }
                    >
                      +Q{d}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBilletes((b) => ({ ...b, [d]: Math.max(0, (b[d] || 0) - 1) }))
                      }
                    >
                      −
                    </button>
                    <small>
                      {d}: {billetes[d] || 0}
                    </small>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMontoRecibido(String(sumaBilletes.toFixed(2)));
                  }}
                >
                  Usar suma billetes ({sumaBilletes.toFixed(2)})
                </button>
              </div>
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Monto recibido (manual)"
              value={montoRecibido}
              onChange={(e) => onMontoRecibidoChange(e.target.value)}
              style={{ padding: '8px 10px', minWidth: 190 }}
            />
            <input
              type="number"
              value={vueltoCalculado.toFixed(2)}
              readOnly
              disabled
              style={{ padding: '8px 10px', minWidth: 150, background: '#f3f4f6' }}
              title="Vuelto calculado automáticamente"
            />
            <button type="button" onClick={submitCheckout} disabled={loading}>
              Continuar
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
            Campos automáticos: horas, monto total y vuelto. Campo manual: monto recibido.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => enviarAsistencia()}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 50,
          padding: '12px 16px',
          borderRadius: 999,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
        }}
      >
        Asistencia
      </button>

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
