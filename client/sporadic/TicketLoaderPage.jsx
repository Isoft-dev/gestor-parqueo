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
  // El MEM_CODIGO generado por backend es numérico (DDMMYY + MEM_ID).
  // Priorizamos capturas estrictas para evitar arrastrar palabras como CLIENTE/PLACA.
  const explicitNumeric =
    normalized.match(/MEM[_\s-]*CODIGO[^0-9]*([0-9]{6,25})(?=\s|$)/i) ||
    normalized.match(/CODIGO[^0-9]*([0-9]{6,25})(?=\s|$)/i) ||
    normalized.match(/TAG[^0-9]*([0-9]{6,25})(?=\s|$)/i);
  if (explicitNumeric?.[1]) return explicitNumeric[1].trim();

  // Compatibilidad por si existiera formato alfanumérico en datos históricos.
  const explicitAlpha =
    normalized.match(/MEM[_\s-]*CODIGO[^A-Z0-9]*([A-Z0-9-]{6,40})(?=\s|$)/i) ||
    normalized.match(/CODIGO[^A-Z0-9]*([A-Z0-9-]{6,40})(?=\s|$)/i) ||
    normalized.match(/TAG[^A-Z0-9]*([A-Z0-9-]{6,40})(?=\s|$)/i);
  if (explicitAlpha?.[1]) return explicitAlpha[1].trim().toUpperCase();

  const generic = normalized.match(/\b[0-9]{6,25}\b/);
  return generic?.[0]?.trim() || '';
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

function getTagWelcomeName(data) {
  const full = [
    data?.CLI_PRIMER_NOMBRE,
    data?.CLI_SEGUNDO_NOMBRE,
    data?.CLI_PRIMER_APELLIDO,
    data?.CLI_SEGUNDO_APELLIDO,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (full) return full;
  return String(data?.CLI_NOMBRE ?? data?.CLI_NOMBRE_COMPLETO ?? 'cliente').trim() || 'cliente';
}

/** Máquina de entrada por defecto: la 1 si existe en el catálogo de entrada; si no, la de menor MAQ_ID. */
function pickDefaultEntradaMaqId(entradaList, maqList) {
  const pool = Array.isArray(entradaList) && entradaList.length > 0 ? entradaList : (Array.isArray(maqList) ? maqList : []);
  if (!pool.length) return '';
  const hasOne = pool.some((m) => String(m?.MAQ_ID) === '1');
  if (hasOne) return '1';
  const sorted = [...pool].sort((a, b) => Number(a?.MAQ_ID) - Number(b?.MAQ_ID));
  return String(sorted[0]?.MAQ_ID ?? '');
}

export default function TicketLoaderPage({ embeddedInAdmin = false, cobroOnly = false, entradaOnly = false, salidaOnly = false }) {
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
  const [tiposPago, setTiposPago] = useState([]);
  const [tiposMaquina, setTiposMaquina] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [maquinasCobro, setMaquinasCobro] = useState([]);
  const [maquinasEntrada, setMaquinasEntrada] = useState([]);
  const [maquinasSalida, setMaquinasSalida] = useState([]);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [entryTicketDone, setEntryTicketDone] = useState(null);
  const [entryKioskState, setEntryKioskState] = useState('idle'); // idle | ticket_ready | notice | tag_welcome
  const [entryNotice, setEntryNotice] = useState({ text: '', severity: 'warn' }); // warn | error
  const [entryWelcomeName, setEntryWelcomeName] = useState('');
  const [showEntryVehicleModal, setShowEntryVehicleModal] = useState(false);
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
  const [defaultCobroMaqId, setDefaultCobroMaqId] = useState('');
  const [defaultEntradaMaqId, setDefaultEntradaMaqId] = useState('');
  const [defaultSalidaMaqId, setDefaultSalidaMaqId] = useState('');
  const [billetes, setBilletes] = useState({ 5: 0, 10: 0, 20: 0, 50: 0 });
  const [cardSim, setCardSim] = useState({
    numero: '',
    nombre: '',
    exp: '',
    cvv: '',
  });
  const [assistMsg, setAssistMsg] = useState('');
  const onlyKiosk = cobroOnly || entradaOnly || salidaOnly;
  const [denominacionesDisponibles, setDenominacionesDisponibles] = useState([5, 10, 20, 50]);
  const [memPayQ, setMemPayQ] = useState('');
  const [memPayList, setMemPayList] = useState([]);
  const [memPaySelected, setMemPaySelected] = useState(null);
  const [memPayTpaId, setMemPayTpaId] = useState('');
  const [memPayRecibido, setMemPayRecibido] = useState('');
  const [memPayBilletes, setMemPayBilletes] = useState({ 5: 0, 10: 0, 20: 0, 50: 0 });
  const [memPayCardSim, setMemPayCardSim] = useState({
    numero: '',
    nombre: '',
    exp: '',
    cvv: '',
  });
  const [memPayDone, setMemPayDone] = useState(null);
  const montoTotalCalculado = Number(quote?.montoTotal || 0);
  const horasCalculadas = Number(
    quote?.estadia?.horasCobradas ?? quote?.estadia?.horasFacturables ?? 0,
  );
  const montoRecibidoNum = Number(montoRecibido);
  const vueltoCalculado =
    Number.isFinite(montoRecibidoNum) && montoRecibidoNum >= montoTotalCalculado
      ? Number((montoRecibidoNum - montoTotalCalculado).toFixed(2))
      : 0;

  const sumaBilletes = denominacionesDisponibles.reduce(
    (acc, d) => acc + Number(billetes[d] || 0) * Number(d),
    0,
  );
  const tipoCobroSeleccionado = tiposCobro.find((t) => String(t?.TCO_ID) === String(tcoId));
  const hasTipoCobroSeleccionado = String(tcoId || '').trim().length > 0;
  const isCardPaymentSelected = /tarjeta|card|credito|cr[eé]dito|debito|d[eé]bito/i.test(
    String(tipoCobroSeleccionado?.TCO_TIPO || ''),
  );
  const isCashPaymentSelected = /efectivo|cash/i.test(
    String(tipoCobroSeleccionado?.TCO_TIPO || ''),
  );

  const memMontoPlan = Number(memPaySelected?.TME_PRECIO ?? 0);
  const tipoPagoMemSeleccionado = tiposPago.find((t) => String(t?.TPA_ID) === String(memPayTpaId));
  const memCardTipoPago = tiposPago.find((t) =>
    /tarjeta|card|credito|cr[eé]dito|debito|d[eé]bito/i.test(String(t?.TPA_TIPO || '')),
  );
  const hasMemPayTpaSeleccionado = String(memPayTpaId || '').trim().length > 0;
  const isMemPayCardSelected = /tarjeta|card|credito|cr[eé]dito|debito|d[eé]bito/i.test(
    String(tipoPagoMemSeleccionado?.TPA_TIPO || ''),
  );
  const isMemPayCashSelected = /efectivo|cash/i.test(
    String(tipoPagoMemSeleccionado?.TPA_TIPO || ''),
  );
  const memPayRecibidoNum = Number(String(memPayRecibido || '').replace(',', '.'));
  const sumaMemPayBilletes = denominacionesDisponibles.reduce(
    (acc, d) => acc + Number(memPayBilletes[d] || 0) * Number(d),
    0,
  );
  const memPayVueltoCalculado =
    Number.isFinite(memPayRecibidoNum) && memPayRecibidoNum >= memMontoPlan
      ? Number((memPayRecibidoNum - memMontoPlan).toFixed(2))
      : 0;

  /** Solo dígitos y un punto decimal; nunca negativos (evita que `min` del input sea insuficiente). */
  function onMontoRecibidoChange(raw) {
    let v = String(raw ?? '').replace(/,/g, '.');
    v = v.replace(/[^0-9.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
    setMontoRecibido(v);
  }

  function isTipoMaquinaCobro(tipo) {
    const t = String(tipo || '').toLowerCase();
    return t.includes('cobro') || t.includes('caja') || t.includes('pago');
  }

  function isTipoMaquinaEntrada(tipo) {
    const t = String(tipo || '').toLowerCase();
    return t.includes('entrada') || t.includes('ingreso');
  }

  function isTipoMaquinaSalida(tipo) {
    const t = String(tipo || '').toLowerCase();
    return t.includes('salida') || t.includes('egreso');
  }

  function machineLabel(m) {
    const tipoRaw = tiposMaquina.find((t) => String(t?.TMA_ID) === String(m?.TMA_ID))?.TMA_TIPO;
    let base = String(tipoRaw || '').trim();
    if (!base) return `Máquina (${m?.MAQ_ID ?? '?'})`;
    if (!/maquina/i.test(base)) base = `Máquina de ${base.toLowerCase()}`;
    return `${base} (${m?.MAQ_ID ?? '?'})`;
  }

  function resetCardSimulator() {
    setCardSim({
      numero: '',
      nombre: '',
      exp: '',
      cvv: '',
    });
  }

  function resetMemPayCardSimulator() {
    setMemPayCardSim({
      numero: '',
      nombre: '',
      exp: '',
      cvv: '',
    });
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
        const [rTve, rCobro, rMaq, rSdi, rTma, rTpa] = await Promise.all([
          fetch(`${API_BASE}/tipo-vehiculo`),
          fetch(`${API_BASE}/tipo-cobro`),
          fetch(`${API_BASE}/maquina`),
          fetch(`${API_BASE}/saldo-disponible`),
          fetch(`${API_BASE}/tipo-maquina`),
          fetch(`${API_BASE}/tipo-pago`),
        ]);
        const [dTve, dCobro, dMaq, dSdi, dTma, dTpa] = await Promise.all([
          rTve.json(),
          rCobro.json(),
          rMaq.json(),
          rSdi.json(),
          rTma.json(),
          rTpa.json(),
        ]);
        if (!rTve.ok) throw new Error(dTve.error || rTve.statusText);
        if (!rCobro.ok) throw new Error(dCobro.error || rCobro.statusText);
        if (!rMaq.ok) throw new Error(dMaq.error || rMaq.statusText);
        if (!rSdi.ok) throw new Error(dSdi.error || rSdi.statusText);
        if (!rTma.ok) throw new Error(dTma.error || rTma.statusText);
        setTiposPago(rTpa.ok && Array.isArray(dTpa) ? dTpa : []);
        setTipoVehiculo(Array.isArray(dTve) ? dTve : []);
        setTiposCobro(Array.isArray(dCobro) ? dCobro : []);
        setTiposMaquina(Array.isArray(dTma) ? dTma : []);
        const maqList = Array.isArray(dMaq) ? dMaq : [];
        setMaquinas(maqList);

        const tipoById = new Map(
          (Array.isArray(dTma) ? dTma : []).map((t) => [String(t.TMA_ID), t]),
        );
        const cobroMaq = maqList.find((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaCobro(tipo?.TMA_TIPO);
        });
        const cobroList = maqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaCobro(tipo?.TMA_TIPO);
        });
        setMaquinasCobro(cobroList);
        const fallbackByCode = maqList.find((m) =>
          String(m.MAQ_CODIGO || '').toLowerCase().includes('cob'),
        );
        const pickedCobroMaqId = String(
          cobroMaq?.MAQ_ID ?? fallbackByCode?.MAQ_ID ?? maqList[0]?.MAQ_ID ?? '',
        );
        setDefaultCobroMaqId(pickedCobroMaqId);

        const entradaList = maqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaEntrada(tipo?.TMA_TIPO);
        });
        setMaquinasEntrada(entradaList);
        const pickedEntradaMaqId = pickDefaultEntradaMaqId(entradaList, maqList);
        setDefaultEntradaMaqId(pickedEntradaMaqId);
        const salidaMaq = maqList.find((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaSalida(tipo?.TMA_TIPO);
        });
        const salidaList = maqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaSalida(tipo?.TMA_TIPO);
        });
        setMaquinasSalida(salidaList);
        const salidaByCode = maqList.find((m) =>
          String(m.MAQ_CODIGO || '').toLowerCase().includes('sal'),
        );
        const pickedSalidaMaqId = String(
          salidaMaq?.MAQ_ID ?? salidaByCode?.MAQ_ID ?? maqList[0]?.MAQ_ID ?? '',
        );
        setDefaultSalidaMaqId(pickedSalidaMaqId);
        const fromCatalog = (Array.isArray(dSdi) ? dSdi : [])
          .map((row) => Number(row?.SDI_VALOR))
          .filter((v) => [5, 10, 20, 50].includes(v))
          .sort((a, b) => a - b);
        setDenominacionesDisponibles(fromCatalog.length ? fromCatalog : [5, 10, 20, 50]);
        if (pickedCobroMaqId || pickedEntradaMaqId || pickedSalidaMaqId) {
          const defaultAssist = cobroOnly
            ? pickedCobroMaqId
            : (entradaOnly ? pickedEntradaMaqId : (salidaOnly ? pickedSalidaMaqId : pickedCobroMaqId));
          setAssistMaqId((prev) => prev || defaultAssist);
          if (cobroOnly) setMaqId(pickedCobroMaqId);
          if (entradaOnly) {
            setVehicleForm((prev) => ({
              ...prev,
              MAQ_ID: String(prev.MAQ_ID || '').trim() ? prev.MAQ_ID : pickedEntradaMaqId,
            }));
          } else if (!cobroOnly && !salidaOnly && pickedEntradaMaqId) {
            setVehicleForm((prev) => ({
              ...prev,
              MAQ_ID: String(prev.MAQ_ID || '').trim() ? prev.MAQ_ID : pickedEntradaMaqId,
            }));
          }
          if (salidaOnly) {
            setExitMaqId((prev) => prev || pickedSalidaMaqId);
          }
        }
      } catch {
        setTipoVehiculo([]);
        setTiposCobro([]);
        setTiposPago([]);
        setTiposMaquina([]);
        setMaquinas([]);
        setMaquinasCobro([]);
        setMaquinasEntrada([]);
        setMaquinasSalida([]);
        setDenominacionesDisponibles([5, 10, 20, 50]);
        setDefaultCobroMaqId('');
        setDefaultEntradaMaqId('');
        setDefaultSalidaMaqId('');
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, [cobroOnly, entradaOnly, salidaOnly]);

  async function enviarAsistencia(motivoExtra) {
    const maqAsistencia = entradaOnly
      ? String(vehicleForm.MAQ_ID || '')
      : salidaOnly
        ? String(exitMaqId || '')
        : cobroOnly
          ? String(maqId || assistMaqId || '')
          : String(assistMaqId || '');

    if (!maqAsistencia) {
      setAssistMsg('Selecciona la máquina activa para asociar la asistencia.');
      return;
    }
    setAssistMsg('');
    try {
      const res = await fetch(`${API_BASE}/alerta/solicitud-asistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MAQ_ID: maqAsistencia,
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

  /** Limpia solo los datos del vehículo del modal de entrada; mantiene la máquina seleccionada. */
  function clearEntryVehicleFormInputs() {
    setVehicleForm((p) => ({
      ...p,
      VEH_PLACA: '',
      VEH_MODELO: '',
      VEH_COLOR: '',
      TVE_ID: '',
    }));
  }

  function applyAutocompletado() {
    const generated = generateVehicleData();
    const defaultTve = String(tipoVehiculo?.[0]?.TVE_ID ?? '');
    const poolEntrada = maquinasEntrada.length > 0 ? maquinasEntrada : maquinas;
    const currentMaq = String(vehicleForm.MAQ_ID || '').trim();
    const selectedMaqId =
      currentMaq ||
      String(defaultEntradaMaqId || pickDefaultEntradaMaqId(maquinasEntrada, maquinas));
    setVehicleForm({
      VEH_PLACA: generated.VEH_PLACA,
      VEH_MODELO: generated.VEH_MODELO,
      VEH_COLOR: generated.VEH_COLOR,
      TVE_ID: defaultTve,
      MAQ_ID: selectedMaqId || String(poolEntrada?.[0]?.MAQ_ID ?? ''),
    });
  }

  async function submitGenerateTicket() {
    if (!vehicleForm.VEH_PLACA || !vehicleForm.TVE_ID || !vehicleForm.MAQ_ID) {
      setMsg('Para generar ticket debes ingresar placa, tipo de vehículo y máquina.');
      if (entradaOnly) {
        setEntryNotice({ text: 'Completa placa, tipo de vehículo y máquina de entrada.', severity: 'warn' });
        setEntryKioskState('notice');
      }
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
      setShowEntryVehicleModal(false);
      setVehicleForm({
        VEH_PLACA: '',
        VEH_MODELO: '',
        VEH_COLOR: '',
        TVE_ID: '',
        MAQ_ID: pickDefaultEntradaMaqId(maquinasEntrada, maquinas),
      });
      setMsg('Ticket de entrada generado correctamente.');
      if (entradaOnly) setEntryKioskState('ticket_ready');
    } catch (err) {
      setMsg(`Error: ${String(err?.message || err)}`);
      if (entradaOnly) {
        setEntryNotice({ text: String(err?.message || err), severity: 'error' });
        setEntryKioskState('notice');
        setShowEntryVehicleModal(false);
      }
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
      if (entradaOnly && !String(vehicleForm.MAQ_ID || '').trim()) {
        setMsg('Selecciona la máquina de entrada antes de cargar el tag.');
        if (entradaOnly) {
          setEntryNotice({ text: 'Selecciona la máquina de entrada antes de cargar el tag.', severity: 'warn' });
          setEntryKioskState('notice');
        }
        return;
      }
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
        body: JSON.stringify(
          entradaOnly
            ? { MEM_CODIGO: memCodigo, MAQ_ID: vehicleForm.MAQ_ID }
            : { MEM_CODIGO: memCodigo },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setTagValidationDone(data);
      setMsg('Acceso concedido.');
      if (entradaOnly) {
        setEntryWelcomeName(getTagWelcomeName(data));
        setEntryKioskState('tag_welcome');
      }
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
      if (entradaOnly) {
        setEntryNotice({ text: txt || 'No se pudo validar el tag.', severity: 'error' });
        setEntryKioskState('notice');
      }
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
    const recibido = isCardPaymentSelected ? Number(montoTotalCalculado) : Number(montoRecibido);
    if (!isCardPaymentSelected) {
      if (!montoRecibido.trim() || !Number.isFinite(recibido) || recibido < 0) {
        setMsg('El monto recibido debe ser un número mayor o igual a cero.');
        return;
      }
      if (recibido < montoTotalCalculado) {
        setMsg('El efectivo ingresado debe ser mayor o igual al monto total.');
        return;
      }
    } else {
      const numero = String(cardSim.numero || '').replace(/\D/g, '');
      if (!numero) {
        setMsg('Ingresa el número de tarjeta.');
        return;
      }
      if (numero.length !== 16) {
        setMsg('El número de tarjeta debe tener 16 dígitos.');
        return;
      }
      if (!String(cardSim.nombre || '').trim()) {
        setMsg('Ingresa el nombre del titular de la tarjeta.');
        return;
      }
      const expRaw = String(cardSim.exp || '');
      const expMatch = expRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!expMatch) {
        setMsg('La fecha de vencimiento debe tener formato MM/AA válido.');
        return;
      }
      const expMonth = Number(expMatch[1]);
      const expYear = 2000 + Number(expMatch[2]);
      const now = new Date();
      const nowMonth = now.getMonth() + 1;
      const nowYear = now.getFullYear();
      if (expYear < nowYear || (expYear === nowYear && expMonth < nowMonth)) {
        setMsg('La tarjeta está vencida.');
        return;
      }
      const cvv = String(cardSim.cvv || '').replace(/\D/g, '');
      if (cvv.length !== 3) {
        setMsg('El CVV debe tener exactamente.');
        return;
      }
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
      const tieneBilletes = !isCardPaymentSelected && Object.values(billetes).some((n) => n > 0);
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
      setMaqId(cobroOnly ? String(defaultCobroMaqId || '') : '');
      setMontoRecibido('');
      setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
      resetCardSimulator();
    } catch (err) {
      setMsg(`Error: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function buscarMembresiasParaPago() {
    const q = String(memPayQ || '').trim();
    if (q.length < 2) {
      setMsg('Escribe al menos 2 caracteres de la placa.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(
        `${API_BASE}/membresia/payment-candidates/search?${new URLSearchParams({ q })}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const list = Array.isArray(data) ? data : [];
      setMemPayList(list);
      setMemPaySelected(null);
      setMemPayDone(null);
      if (!list.length) setMsg('No se encontraron membresías con esa placa.');
    } catch (e) {
      setMsg(`Error: ${String(e?.message || e)}`);
      setMemPayList([]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmarPagoMembresia() {
    if (!memPaySelected?.MEM_ID) {
      setMsg('Selecciona una membresía de la lista.');
      return;
    }
    if (!memPayTpaId) {
      setMsg('No hay tipo de pago con tarjeta disponible para membresías.');
      return;
    }
    const monto = Number(memPaySelected.TME_PRECIO ?? 0);
    if (!(monto > 0)) {
      setMsg('No se pudo leer el monto del plan.');
      return;
    }
    const tipoPago = tiposPago.find((t) => String(t?.TPA_ID) === String(memPayTpaId));
    const pagoTarjeta = /tarjeta|card|credito|cr[eé]dito|debito|d[eé]bito/i.test(
      String(tipoPago?.TPA_TIPO || ''),
    );
    if (!pagoTarjeta) {
      setMsg('Para pago de membresía solo se permite tarjeta.');
      return;
    }
    const recibido = monto;
    {
      const numero = String(memPayCardSim.numero || '').replace(/\D/g, '');
      if (!numero) {
        setMsg('Ingresa el número de tarjeta.');
        return;
      }
      if (numero.length !== 16) {
        setMsg('El número de tarjeta debe tener 16 dígitos.');
        return;
      }
      if (!String(memPayCardSim.nombre || '').trim()) {
        setMsg('Ingresa el nombre del titular de la tarjeta.');
        return;
      }
      const expRaw = String(memPayCardSim.exp || '');
      const expMatch = expRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!expMatch) {
        setMsg('La fecha de vencimiento debe tener formato MM/AA válido.');
        return;
      }
      const expMonth = Number(expMatch[1]);
      const expYear = 2000 + Number(expMatch[2]);
      const now = new Date();
      const nowMonth = now.getMonth() + 1;
      const nowYear = now.getFullYear();
      if (expYear < nowYear || (expYear === nowYear && expMonth < nowMonth)) {
        setMsg('La tarjeta está vencida.');
        return;
      }
      const cvv = String(memPayCardSim.cvv || '').replace(/\D/g, '');
      if (cvv.length !== 3) {
        setMsg('El CVV debe tener exactamente 3 dígitos.');
        return;
      }
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/membresia/${memPaySelected.MEM_ID}/register-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TPA_ID: Number(memPayTpaId),
          PAG_MONTO_RECIBIDO: recibido,
          PAG_VUELTO: Math.max(0, recibido - monto),
          REACTIVATE_IF_SUSPENDED: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMemPayDone(data);
      setMemPayList([]);
      setMemPaySelected(null);
      setMemPayTpaId('');
      setMemPayRecibido('');
      setMemPayBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
      resetMemPayCardSimulator();
      setMemPayQ('');
      setMsg('');
    } catch (e) {
      setMsg(`Error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  function resetProcess() {
    setQuote(null);
    setCheckoutDone(null);
    setMsg('');
    setTcoId('');
    setMaqId(cobroOnly ? String(defaultCobroMaqId || '') : '');
    setNit('');
    setCf(false);
    setMontoRecibido('');
    setEntryTicketDone(null);
    setTagValidationDone(null);
    setTagExitValidationDone(null);
    setExitValidationDone(null);
    setExitMaqId('');
    setShowGenerateForm(entradaOnly);
    setShowEntryVehicleModal(false);
    setEntryKioskState('idle');
    setEntryNotice({ text: '', severity: 'warn' });
    setEntryWelcomeName('');
    setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    resetCardSimulator();
    setMemPayQ('');
    setMemPayList([]);
    setMemPaySelected(null);
    setMemPayTpaId('');
    setMemPayRecibido('');
    setMemPayDone(null);
    setMemPayBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    resetMemPayCardSimulator();
  }

  function downloadReceiptAndReset() {
    if (!checkoutDone?.TIC_ID) return;
    window.open(`${API_BASE}/ticket/${checkoutDone.TIC_ID}/comprobante.pdf`, '_blank');
    resetProcess();
  }

  function downloadEntryTicketAndResetKiosk() {
    if (!entryTicketDone?.TIC_ID) return;
    window.open(`${API_BASE}/ticket/${entryTicketDone.TIC_ID}/entrada.pdf`, '_blank');
    setEntryTicketDone(null);
    setEntryKioskState('idle');
  }

  useEffect(() => {
    if (!entradaOnly || entryKioskState !== 'notice') return;
    const t = setTimeout(() => {
      setEntryKioskState('idle');
      setEntryNotice({ text: '', severity: 'warn' });
    }, 4000);
    return () => clearTimeout(t);
  }, [entradaOnly, entryKioskState]);

  useEffect(() => {
    if (!entradaOnly || entryKioskState !== 'tag_welcome') return;
    const t = setTimeout(() => {
      setTagValidationDone(null);
      setEntryWelcomeName('');
      setEntryKioskState('idle');
    }, 5000);
    return () => clearTimeout(t);
  }, [entradaOnly, entryKioskState]);

  return (
    <div
      className={
        embeddedInAdmin
          ? 'ops-shell ops-shell--embedded'
          : `admin-page ops-page-public${entradaOnly ? ' ops-page-public--entry' : ''}`
      }
      style={{ maxWidth: embeddedInAdmin ? '100%' : 1040, margin: '12px auto', padding: 16 }}
    >
      {!entradaOnly ? (
        <>
          <header className={`admin-page-header ${embeddedInAdmin ? 'ops-top-row' : 'ops-page-header'}`}>
            <h1 className="admin-page-title">
              {embeddedInAdmin
                ? 'Operación en cabina'
                : cobroOnly
                  ? 'Máquina de cobro'
                  : entradaOnly
                    ? 'Máquina de entrada'
                    : salidaOnly
                      ? 'Máquina de salida'
                      : 'Consulta de ticket'}
            </h1>
            {!embeddedInAdmin && !onlyKiosk ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link to="/maquina-entrada" className="ops-header-auth-link">
                  Ir a máquina de entrada
                </Link>
                <Link to="/maquina-cobro" className="ops-header-auth-link">
                  Ir a máquina de cobro
                </Link>
                <Link to="/maquina-salida" className="ops-header-auth-link">
                  Ir a máquina de salida
                </Link>
                {user ? (
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
                )}
              </div>
            ) : null}
          </header>
          <p className="admin-page-desc">
            {cobroOnly
              ? 'Cobro de ticket: carga el PDF, tipo de cobro, NIT o CF y confirma. Membresía vencida: queda suspendida y no permite ingreso con tag hasta que renueves aquí en «Pagar membresía».'
              : entradaOnly
                ? 'Flujo de entrada: genera ticket para cliente esporádico o valida tag para cliente mensual.'
                : salidaOnly
                  ? 'Flujo de salida: valida tag de cliente mensual o verifica ticket pagado de cliente esporádico.'
                  : 'Puedes generar ticket de entrada o cargar ticket para continuar con el cobro.'}
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
        </>
      ) : null}

      {entradaOnly ? (
        <div className="ops-entry-config">
          <label>
            <span>Máquina de entrada</span>
            <select
              value={vehicleForm.MAQ_ID}
              onChange={(e) => setVehicleForm((p) => ({ ...p, MAQ_ID: e.target.value }))}
            >
              {(maquinasEntrada.length ? maquinasEntrada : maquinas).map((m) => (
                <option key={m.MAQ_ID} value={m.MAQ_ID}>
                  {machineLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {cobroOnly && !catalogLoading ? (
        <section className="admin-panel-block ops-panel-block" style={{ marginTop: 4 }}>
          <div className="admin-panel-head">
            <h2>Pagar membresía</h2>
            <p className="admin-panel-sub">
              Renueva el plan mensual desde caja: busca por placa, elige la membresía y completa el pago con tarjeta.
              Si el periodo venció, el sistema la suspende y el ingreso con tag queda bloqueado hasta pagar aquí.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <input
              type="text"
              placeholder="Placa (mín. 2 caracteres)"
              value={memPayQ}
              onChange={(e) => setMemPayQ(e.target.value.toUpperCase())}
              style={{ padding: '8px 10px', minWidth: 220 }}
            />
            <button type="button" className="admin-btn-primary" onClick={buscarMembresiasParaPago} disabled={loading}>
              Buscar
            </button>
          </div>
          {memPayList.length > 0 ? (
            <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              {memPayList.map((m) => {
                const id = m.MEM_ID ?? m.mem_id;
                const sel = String(memPaySelected?.MEM_ID ?? '') === String(id);
                const nom = [m.CLI_PRIMER_NOMBRE, m.CLI_PRIMER_APELLIDO].filter(Boolean).join(' ');
                const venc = m.MEM_FECHA_VENCIMIENTO
                  ? new Date(m.MEM_FECHA_VENCIMIENTO).toLocaleDateString('es-GT')
                  : '—';
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMemPaySelected(m);
                      setMemPayRecibido('');
                      setMemPayTpaId(String(memCardTipoPago?.TPA_ID || ''));
                      setMemPayBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
                      resetMemPayCardSimulator();
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '1px solid #eee',
                      background: sel ? '#ecfdf5' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>#{id}</strong> — {m.VEH_PLACA || '—'} — {nom || 'Cliente'} — {m.TME_TIPO || 'Plan'} — Q
                    {Number(m.TME_PRECIO ?? 0).toFixed(2)} — Vence {venc} — {m.EME_ESTADO || '—'}
                  </button>
                );
              })}
            </div>
          ) : null}
          {memPaySelected ? (
            <div style={{ marginTop: 14, padding: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fafafa' }}>
              <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                Monto del plan: <strong>Q{memMontoPlan.toFixed(2)}</strong>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {!hasMemPayTpaSeleccionado ? (
                  <div
                    style={{
                      width: '100%',
                      marginTop: 8,
                      border: '1px dashed #cbd5e1',
                      borderRadius: 8,
                      padding: 10,
                      background: '#f8fafc',
                      color: '#475569',
                    }}
                  >
                    No hay tipo de pago con tarjeta configurado en catálogo.
                  </div>
                ) : isMemPayCardSelected ? (
                  <div
                    style={{
                      width: '100%',
                      marginTop: 8,
                      border: '1px solid #dbeafe',
                      borderRadius: 8,
                      padding: 10,
                      background: '#f8fbff',
                    }}
                  >
                    <strong>Pago con tarjeta</strong>
                    <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#374151' }}>
                      Inserta los datos de tu tarjeta para realizar el cobro.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Número de tarjeta (16 dígitos)"
                        value={memPayCardSim.numero}
                        onChange={(e) =>
                          setMemPayCardSim((p) => ({
                            ...p,
                            numero: e.target.value.replace(/\D/g, '').slice(0, 16),
                          }))
                        }
                        style={{ padding: '8px 10px', minWidth: 220 }}
                      />
                      <input
                        type="text"
                        placeholder="Nombre en tarjeta"
                        value={memPayCardSim.nombre}
                        onChange={(e) =>
                          setMemPayCardSim((p) => ({ ...p, nombre: e.target.value }))
                        }
                        style={{ padding: '8px 10px', minWidth: 180 }}
                      />
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={memPayCardSim.exp}
                        onChange={(e) =>
                          setMemPayCardSim((p) => ({
                            ...p,
                            exp: (() => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                              if (digits.length <= 2) return digits;
                              return `${digits.slice(0, 2)}/${digits.slice(2)}`;
                            })(),
                          }))
                        }
                        style={{ padding: '8px 10px', minWidth: 100 }}
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        placeholder="CVV"
                        value={memPayCardSim.cvv}
                        onChange={(e) =>
                          setMemPayCardSim((p) => ({
                            ...p,
                            cvv: e.target.value.replace(/\D/g, '').slice(0, 3),
                          }))
                        }
                        style={{ padding: '8px 10px', minWidth: 90 }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      marginTop: 8,
                      border: '1px dashed #cbd5e1',
                      borderRadius: 8,
                      padding: 10,
                      background: '#f8fafc',
                      color: '#475569',
                    }}
                  >
                    El tipo de pago configurado para membresía no corresponde a tarjeta.
                  </div>
                )}
                <button type="button" className="admin-btn-primary" onClick={confirmarPagoMembresia} disabled={loading}>
                  Registrar pago
                </button>
              </div>
            </div>
          ) : null}
          {memPayDone ? (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #86efac',
                fontSize: 14,
              }}
            >
              <strong>Listo.</strong> Nueva vigencia hasta{' '}
              {memPayDone.MEM_FECHA_VENCIMIENTO
                ? new Date(memPayDone.MEM_FECHA_VENCIMIENTO).toLocaleString('es-GT')
                : '—'}
              {memPayDone.REACTIVATED ? ' (membresía reactivada).' : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {entradaOnly && !catalogLoading ? (
        <section className="ops-entry-kiosk-wrap" aria-label="Pantalla de máquina de entrada">
          <input
            ref={tagFileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setEntryKioskState('idle');
                return;
              }
              onLoadTagPdf(f);
            }}
          />

          <div
            className={`ops-entry-kiosk-screen${
              entryKioskState === 'notice' && entryNotice.severity === 'error'
                ? ' ops-entry-kiosk-screen--error'
                : ''
            }`}
          >
            <div className="ops-entry-kiosk-screen-inner">
              {entryKioskState === 'idle' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">P</div>
                  <h2>Bienvenido al Parqueo</h2>
                  <p className="ops-entry-kiosk-subtext ops-entry-kiosk-subtext--pulse">
                    Espacios disponibles: {espacioResumen?.disponibles ?? '—'} de {espacioResumen?.total ?? '—'}
                  </p>
                </div>
              ) : null}

              {entryKioskState === 'ticket_ready' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">✓</div>
                  <h2>¡Ticket generado!</h2>
                  <p className="ops-entry-kiosk-subtext">Por favor, tome su ticket</p>
                  <button
                    type="button"
                    className="admin-btn-primary ops-entry-kiosk-download"
                    onClick={downloadEntryTicketAndResetKiosk}
                  >
                    ⬇ Descargar Ticket
                  </button>
                </div>
              ) : null}

              {entryKioskState === 'tag_welcome' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">✓</div>
                  <h2>Bienvenido {entryWelcomeName || 'cliente'}</h2>
                  <p className="ops-entry-kiosk-subtext">Acceso concedido</p>
                </div>
              ) : null}

              {entryKioskState === 'notice' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">⚠</div>
                  <h2>Aviso</h2>
                  <p
                    className={`ops-entry-kiosk-subtext ${
                      entryNotice.severity === 'error'
                        ? 'ops-entry-kiosk-subtext--error'
                        : 'ops-entry-kiosk-subtext--warn'
                    }`}
                  >
                    {entryNotice.text || 'No se pudo completar la operación.'}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ops-entry-kiosk-controls">
            <button
              type="button"
              className="admin-btn-primary"
              disabled={entryKioskState !== 'idle' || loading || catalogLoading}
              onClick={() => {
                if (espacioResumen?.parqueoLleno) {
                  setEntryNotice({ text: 'Sin espacios disponibles.', severity: 'error' });
                  setEntryKioskState('notice');
                  return;
                }
                clearEntryVehicleFormInputs();
                setShowEntryVehicleModal(true);
              }}
            >
              Generar Ticket
            </button>
            <button
              type="button"
              className="admin-btn-primary"
              disabled={entryKioskState !== 'idle' || loading || catalogLoading}
              onClick={() => tagFileRef.current?.click()}
            >
              Cargar Tag
            </button>
          </div>
        </section>
      ) : null}

      {!entradaOnly ? <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {!onlyKiosk ? <span style={{ fontSize: 14 }}>Máquina para alertas de asistencia:</span> : null}
        {!onlyKiosk ? (
          <select
            value={assistMaqId}
            onChange={(e) => setAssistMaqId(e.target.value)}
            style={{ padding: '6px 10px', minWidth: 200 }}
          >
            <option value="">—</option>
            {maquinas.map((m) => (
              <option key={m.MAQ_ID} value={m.MAQ_ID}>
                {machineLabel(m)}
              </option>
            ))}
          </select>
        ) : null}
        {assistMsg ? <span style={{ fontSize: 13, color: '#065f46' }}>{assistMsg}</span> : null}
      </div> : null}
      {catalogLoading ? (
        <div className="ops-loader-wrap">
          <span className="ops-loader" aria-hidden="true" />
          <span>Cargando catálogos base...</span>
        </div>
      ) : null}

      {!cobroOnly && !salidaOnly && !entradaOnly ? <section className="admin-panel-block ops-panel-block">
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
      </section> : null}

      {!cobroOnly && !entradaOnly ? <section className="admin-panel-block ops-panel-block">
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
      </section> : null}

      {!cobroOnly && !entradaOnly ? <section className="admin-panel-block ops-panel-block">
        <div className="admin-panel-head">
          <h2>{salidaOnly ? 'Verificación de ticket pagado' : 'Salida cliente esporádico'}</h2>
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
            {(maquinasSalida.length ? maquinasSalida : maquinas).map((m) => (
              <option key={m.MAQ_ID} value={m.MAQ_ID}>
                {machineLabel(m)}
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
      </section> : null}

      <div className="ops-main-ticket-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!cobroOnly && !entradaOnly && !salidaOnly ? (
          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => { setShowGenerateForm((v) => !v); setMsg(''); }}
            disabled={loading || catalogLoading || espacioResumen?.parqueoLleno}
          >
            Generar Ticket
          </button>
        ) : null}
        {!entradaOnly && !salidaOnly ? (
          <button
            type="button"
            className={cobroOnly ? 'admin-btn-primary' : 'admin-btn-ghost'}
            onClick={() => fileRef.current?.click()}
            disabled={loading || catalogLoading}
            title="Selecciona el PDF del ticket para cotizar y completar el pago en el detalle de cobro."
          >
            {cobroOnly ? '1) Cargar ticket' : 'Pagar ticket'}
          </button>
        ) : null}
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

      {!entradaOnly && msg ? (
        <div style={{ marginTop: 12, padding: 10, border: '1px solid #e2b4b4', background: '#fff4f4', color: '#8a1f1f' }}>
          {msg}
        </div>
      ) : null}

      {entradaOnly && showEntryVehicleModal ? (
        <div className="ops-entry-modal-backdrop" role="dialog" aria-modal="true" aria-label="Ingreso de Vehículo">
          <div className="ops-entry-modal">
            <h3>Ingreso de Vehículo</h3>
            <div className="ops-entry-modal-grid">
              <input
                type="text"
                placeholder="Placa"
                value={vehicleForm.VEH_PLACA}
                onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_PLACA: e.target.value.toUpperCase() }))}
              />
              <input
                type="text"
                placeholder="Modelo"
                value={vehicleForm.VEH_MODELO}
                onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_MODELO: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Color"
                value={vehicleForm.VEH_COLOR}
                onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_COLOR: e.target.value }))}
              />
              <select
                value={vehicleForm.TVE_ID}
                onChange={(e) => setVehicleForm((p) => ({ ...p, TVE_ID: e.target.value }))}
              >
                <option value="">Selecciona tipo de vehículo</option>
                {tipoVehiculo.map((t) => (
                  <option key={t.TVE_ID} value={t.TVE_ID}>
                    {t.TVE_TIPO || `Tipo ${t.TVE_ID}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ops-entry-modal-actions">
              <button type="button" className="ops-entry-modal-btn ops-entry-modal-btn--soft" onClick={applyAutocompletado} disabled={loading}>Autocompletar</button>
              <button
                type="button"
                className="ops-entry-modal-btn ops-entry-modal-btn--cancel"
                onClick={() => {
                  clearEntryVehicleFormInputs();
                  setShowEntryVehicleModal(false);
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="button" className="admin-btn-primary" onClick={submitGenerateTicket} disabled={loading}>Confirmar</button>
            </div>
          </div>
        </div>
      ) : null}

      {!cobroOnly && !salidaOnly && !entradaOnly && showGenerateForm && (
        <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 8, padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>
            {entradaOnly ? 'Generación de ticket' : 'Generar ticket de entrada'}
          </h2>
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
                  {t.TVE_TIPO || `Tipo ${t.TVE_ID}`} ({t.TVE_ID})
                </option>
              ))}
            </select>
            {!entradaOnly ? (
              <select
                value={vehicleForm.MAQ_ID}
                onChange={(e) => setVehicleForm((p) => ({ ...p, MAQ_ID: e.target.value }))}
                style={{ padding: '8px 10px', minWidth: 220 }}
              >
                {maquinas.map((m) => (
                  <option key={m.MAQ_ID} value={m.MAQ_ID}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={vehicleForm.MAQ_ID}
                onChange={(e) => setVehicleForm((p) => ({ ...p, MAQ_ID: e.target.value }))}
                style={{ padding: '8px 10px', minWidth: 260 }}
              >
                {(maquinasEntrada.length ? maquinasEntrada : maquinas).map((m) => (
                  <option key={m.MAQ_ID} value={m.MAQ_ID}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={applyAutocompletado} disabled={loading}>Autocompletado</button>
            <button type="button" onClick={submitGenerateTicket} disabled={loading}>Confirmar</button>
          </div>
        </div>
      )}

      {!cobroOnly && !salidaOnly && !entradaOnly && entryTicketDone && (
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

      {!cobroOnly && !salidaOnly && !entradaOnly && tagValidationDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Acceso concedido</strong>
          <p style={{ margin: '6px 0' }}>Membresía: {tagValidationDone.MEM_ID}</p>
          <p style={{ margin: '6px 0' }}>Código: {tagValidationDone.MEM_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Placa: {tagValidationDone.VEH_PLACA || 'N/D'}</p>
        </div>
      )}

      {!cobroOnly && !entradaOnly && tagExitValidationDone && (
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

      {!cobroOnly && !entradaOnly && exitValidationDone && (
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
          {cobroOnly ? (
            <p style={{ margin: '6px 0', fontSize: 13, color: '#4b5563' }}>
              2) Selecciona tipo de cobro, 3) ingresa NIT o CF, 4) registra efectivo, 5) confirma pago.
            </p>
          ) : null}
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
          {Number(quote.recargoTicketExtraviado) > 0 ? (
            <p style={{ margin: '6px 0', fontSize: 13, color: '#b45309', background: '#fffbeb', padding: '8px 10px', borderRadius: 8, border: '1px solid #fcd34d' }}>
              Ticket en estado <strong>Extraviado</strong>: se suma un recargo de{' '}
              <strong>Q{Number(quote.recargoTicketExtraviado).toFixed(2)}</strong> al cobro por estadía
              {quote.montoEstadia != null ? (
                <>
                  {' '}
                  (estadía Q{Number(quote.montoEstadia).toFixed(2)} + recargo Q
                  {Number(quote.recargoTicketExtraviado).toFixed(2)}).
                </>
              ) : null}
            </p>
          ) : null}
          {quote.politicaMinimoSub1h?.aplicada ? (
            <p style={{ margin: '6px 0', fontSize: 13, color: '#444' }}>
              Cobro mínimo por estadía menor a 1 h: Q
              {Number(quote.politicaMinimoSub1h.quetzales ?? 5).toFixed(2)} (configuración del servidor
              {quote.politicaMinimoSub1h?.origen === 'runtime' ? ', panel admin' : ', .env'}).
            </p>
          ) : null}
          <hr />
          <h3 style={{ marginBottom: 8 }}>
            {cobroOnly ? 'Pasos de cobro' : 'Facturación (campos automáticos y manuales)'}
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={tcoId} onChange={(e) => setTcoId(e.target.value)} style={{ padding: '8px 10px', minWidth: 260 }}>
              <option value="">Selecciona tipo de cobro</option>
              {tiposCobro.map((t) => (
                <option key={t.TCO_ID} value={t.TCO_ID}>
                  {t.TCO_TIPO} ({t.TCO_ID})
                </option>
              ))}
            </select>
            {!cobroOnly ? (
              <select value={maqId} onChange={(e) => setMaqId(e.target.value)} style={{ padding: '8px 10px', minWidth: 220 }}>
                <option value="">Selecciona máquina de cobro</option>
                {maquinas.map((m) => (
                  <option key={m.MAQ_ID} value={m.MAQ_ID}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={maqId}
                onChange={(e) => setMaqId(e.target.value)}
                style={{ padding: '8px 10px', minWidth: 260 }}
              >
                <option value="">Selecciona máquina de cobro</option>
                {(maquinasCobro.length ? maquinasCobro : maquinas).map((m) => (
                  <option key={m.MAQ_ID} value={m.MAQ_ID}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            )}
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
            {!hasTipoCobroSeleccionado ? (
              <div
                style={{
                  width: '100%',
                  marginTop: 8,
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: 10,
                  background: '#f8fafc',
                  color: '#475569',
                }}
              >
                Selecciona un tipo de cobro para continuar con el ingreso de datos de pago.
              </div>
            ) : isCashPaymentSelected ? (
              <>
                <div style={{ width: '100%', marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>
                    Simulación de billetes (según denominaciones configuradas)
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {denominacionesDisponibles.map((d) => (
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
                  placeholder="Monto recibido"
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
              </>
            ) : isCardPaymentSelected ? (
              <div style={{ width: '100%', marginTop: 8, border: '1px solid #dbeafe', borderRadius: 8, padding: 10, background: '#f8fbff' }}>
                <strong>Simulador de pago con tarjeta</strong>
                <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#374151' }}>
                  Simulación local: los datos de tarjeta no se guardan ni se envían al backend.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Número de tarjeta (16 dígitos)"
                    value={cardSim.numero}
                    onChange={(e) =>
                      setCardSim((p) => ({
                        ...p,
                        numero: e.target.value.replace(/\D/g, '').slice(0, 16),
                      }))
                    }
                    style={{ padding: '8px 10px', minWidth: 220 }}
                  />
                  <input
                    type="text"
                    placeholder="Nombre en tarjeta"
                    value={cardSim.nombre}
                    onChange={(e) =>
                      setCardSim((p) => ({ ...p, nombre: e.target.value }))
                    }
                    style={{ padding: '8px 10px', minWidth: 180 }}
                  />
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={cardSim.exp}
                    onChange={(e) =>
                      setCardSim((p) => ({
                        ...p,
                        exp: (() => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (digits.length <= 2) return digits;
                          return `${digits.slice(0, 2)}/${digits.slice(2)}`;
                        })(),
                      }))
                    }
                    style={{ padding: '8px 10px', minWidth: 100 }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="CVV"
                    value={cardSim.cvv}
                    onChange={(e) =>
                      setCardSim((p) => ({
                        ...p,
                        cvv: e.target.value.replace(/\D/g, '').slice(0, 3),
                      }))
                    }
                    style={{ padding: '8px 10px', minWidth: 90 }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  marginTop: 8,
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: 10,
                  background: '#f8fafc',
                  color: '#475569',
                }}
              >
                Tipo de cobro seleccionado sin simulador visual específico.
              </div>
            )}
            <button type="button" onClick={submitCheckout} disabled={loading}>
              {cobroOnly ? 'Confirmar pago' : 'Continuar'}
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
