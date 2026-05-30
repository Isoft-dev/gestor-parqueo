import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { API_BASE } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { filterOperativeMachines } from '../utils/machineStatus.js';
import { getPlateValidationMessage, normalizePlateInput, PLATE_MAX_LENGTH } from '../utils/plate.js';
import { getFieldPlaceholder, sanitizeFieldValue, sanitizeSearchValue } from '../utils/fieldValidation.js';

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

function generateVehicleData(modelos = [], colores = []) {
  const modelo = randomFrom(modelos);
  const color = randomFrom(colores);
  return {
    VEH_PLACA: generateRandomPlate(),
    MOD_ID: modelo?.MOD_ID != null ? String(modelo.MOD_ID) : '',
    COL_ID: color?.COL_ID != null ? String(color.COL_ID) : '',
  };
}

function modeloVehiculoOptionLabel(modelo) {
  const marca = String(modelo?.MAR_NOMBRE || '').trim();
  const nombre = String(modelo?.MOD_NOMBRE || '').trim();
  const tipo = String(modelo?.TVE_TIPO || '').trim();
  const parts = [marca, nombre].filter(Boolean);
  const base = parts.join(' ');
  return tipo ? `${base} - ${tipo}` : base || `Modelo ${modelo?.MOD_ID ?? ''}`;
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

function pickDefaultCobroMaqId(cobroList, maqList) {
  const pool = Array.isArray(cobroList) && cobroList.length > 0 ? cobroList : (Array.isArray(maqList) ? maqList : []);
  if (!pool.length) return '';
  const hasOne = pool.some((m) => String(m?.MAQ_ID) === '1');
  if (hasOne) return '1';
  const sorted = [...pool].sort((a, b) => Number(a?.MAQ_ID) - Number(b?.MAQ_ID));
  return String(sorted[0]?.MAQ_ID ?? '');
}

const ASSISTANCE_OVERLAY_MS = 4000;
const QUOTE_REFRESH_MS = 30000;

function getRoundedMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function getStayMinutesFromQuote(quote, nowMs = Date.now()) {
  const entryAt = quote?.ticket?.TIC_FECHA_HORA_ENTRADA;
  if (entryAt) {
    const entryMs = new Date(entryAt).getTime();
    if (Number.isFinite(entryMs)) {
      return Math.max(0, Math.round((nowMs - entryMs) / (1000 * 60)));
    }
  }
  return getRoundedMinutes(quote?.estadia?.minutosTotales);
}

function formatStayDuration(totalMinutes) {
  const mins = getRoundedMinutes(totalMinutes);
  const hours = Math.floor(mins / 60);
  const remainingMinutes = mins % 60;
  return `${hours} h (${remainingMinutes} min)`;
}

async function fetchTicketQuoteByCodigo(ticCodigo) {
  const res = await fetch(`${API_BASE}/ticket/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ TIC_CODIGO: ticCodigo }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export default function TicketLoaderPage({ embeddedInAdmin = false, cobroOnly = false, entradaOnly = false, salidaOnly = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const fromLogin = location.state?.fromLogin === true;
  const isPublicKiosk = !embeddedInAdmin && (entradaOnly || cobroOnly || salidaOnly);
  const showBackToLogin = isPublicKiosk && (!user || fromLogin);
  const fileRef = useRef(null);
  const tagFileRef = useRef(null);
  const memPayTagFileRef = useRef(null);
  const salidaFileRef = useRef(null);
  const tagSalidaFileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState(null);
  const [modelosVehiculo, setModelosVehiculo] = useState([]);
  const [coloresVehiculo, setColoresVehiculo] = useState([]);
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
    MOD_ID: '',
    COL_ID: '',
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
  const [quoteNowMs, setQuoteNowMs] = useState(() => Date.now());
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
  /** Flujo UI máquina de cobro (solo presentación; la lógica sigue en quote / submitCheckout / membresía). */
  const [cobroUiStep, setCobroUiStep] = useState('idle');
  const [cobroErrorText, setCobroErrorText] = useState('');
  /** Validación de tarjeta (simulador): overlay rojo en la pantallita, mismo patrón que errores del kiosco. */
  const [cobroCardScreenError, setCobroCardScreenError] = useState(null);
  /** Kiosco máquina de salida (solo presentación). */
  const [salidaKioskState, setSalidaKioskState] = useState('idle'); // idle | processing | success | error
  const [salidaKioskNotice, setSalidaKioskNotice] = useState({ text: '', severity: 'error' }); // warn | error
  const [assistOverlay, setAssistOverlay] = useState(null);
  const montoTotalCalculado = Number(quote?.montoTotal || 0);
  const horasCalculadas = Number(
    quote?.estadia?.horasCobradas ?? quote?.estadia?.horasFacturables ?? 0,
  );
  const totalStayMinutes = getStayMinutesFromQuote(quote, quoteNowMs);
  const facturableStayMinutes = getRoundedMinutes(quote?.estadia?.minutosFacturables);
  const totalStayLabel = formatStayDuration(totalStayMinutes);
  const facturableStayLabel = formatStayDuration(facturableStayMinutes);
  const showFacturableStay = quote != null && facturableStayMinutes !== totalStayMinutes;
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
  const _isMemPayCashSelected = /efectivo|cash/i.test(
    String(tipoPagoMemSeleccionado?.TPA_TIPO || ''),
  );
  const memMoraReactivacion = Number(memPaySelected?.MEM_MORA_REACTIVACION ?? 0);
  const memTotalPagar = Number(memPaySelected?.MEM_TOTAL_A_PAGAR ?? (memMontoPlan + memMoraReactivacion));
  const memRequiereReactivacion = Number(memPaySelected?.MEM_REQUIERE_REACTIVACION ?? 0) === 1 || memMoraReactivacion > 0;
  const memPayRecibidoNum = Number(String(memPayRecibido || '').replace(',', '.'));
  const _sumaMemPayBilletes = denominacionesDisponibles.reduce(
    (acc, d) => acc + Number(memPayBilletes[d] || 0) * Number(d),
    0,
  );
  const _memPayVueltoCalculado =
    Number.isFinite(memPayRecibidoNum) && memPayRecibidoNum >= memTotalPagar
      ? Number((memPayRecibidoNum - memTotalPagar).toFixed(2))
      : 0;
  const selectedModeloVehiculo = modelosVehiculo.find(
    (modelo) => String(modelo?.MOD_ID) === String(vehicleForm.MOD_ID || ''),
  ) || null;

  function cobroShortTicketCode(code) {
    const s = String(code || '');
    if (s.length <= 20) return s;
    return `${s.slice(0, 12)}…${s.slice(-6)}`;
  }

  function cobroPickEfectivoTcoId() {
    const t = tiposCobro.find((x) => /efectivo|cash/i.test(String(x?.TCO_TIPO || '')));
    return t ? String(t.TCO_ID) : '';
  }

  function cobroPickTarjetaTcoId() {
    const t = tiposCobro.find((x) =>
      /tarjeta|card|credito|cr[eé]dito|debito|d[eé]bito/i.test(String(x?.TCO_TIPO || '')),
    );
    return t ? String(t.TCO_ID) : '';
  }

  function cobroAddDenominacion(d) {
    setBilletes((b) => {
      const currentSum = denominacionesDisponibles.reduce(
        (acc, x) => acc + Number(b[x] || 0) * Number(x),
        0,
      );
      if (currentSum >= montoTotalCalculado) return b;
      const nb = { ...b, [d]: Number(b[d] || 0) + 1 };
      const sum = denominacionesDisponibles.reduce(
        (acc, x) => acc + Number(nb[x] || 0) * Number(x),
        0,
      );
      setMontoRecibido(sum.toFixed(2));
      return nb;
    });
  }

  function cobroNitKeypadDigit(ch) {
    setCf(false);
    setNit((prev) => `${String(prev || '')}${ch}`.replace(/\D/g, '').slice(0, 15));
  }

  function cobroNitKeypadDel() {
    setNit((prev) => String(prev || '').slice(0, -1));
  }

  function cobroConfirmNitKiosk() {
    if (cf) return;
    if (!String(nit || '').trim()) {
      setMsg('Ingrese NIT o seleccione CF.');
      return;
    }
    setCobroUiStep('pago_metodo');
    setMsg('');
  }

  function cobroPressCf() {
    setCf(true);
    setNit('');
    setCobroUiStep('pago_metodo');
    setMsg('');
  }

  function cobroGoEfectivo() {
    const id = cobroPickEfectivoTcoId();
    if (!id) {
      setMsg('No hay tipo de cobro en efectivo configurado.');
      return;
    }
    setTcoId(id);
    setMontoRecibido('');
    setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    setCobroUiStep('pago_efectivo');
    setMsg('');
    setCobroCardScreenError(null);
  }

  function cobroGoTarjeta() {
    const id = cobroPickTarjetaTcoId();
    if (!id) {
      setMsg('No hay tipo de cobro con tarjeta configurado.');
      return;
    }
    setTcoId(id);
    setMontoRecibido(String(montoTotalCalculado.toFixed(2)));
    resetCardSimulator();
    setCobroUiStep('pago_tarjeta');
    setMsg('');
    setCobroCardScreenError(null);
  }

  function cobroCancelToPaymentMethod() {
    resetCardSimulator();
    setMontoRecibido('');
    setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    setTcoId('');
    setCobroUiStep('pago_metodo');
    setMsg('');
    setCobroCardScreenError(null);
  }

  function onMontoRecibidoChange(raw) {
    const normalized = String(raw ?? '').replace(/,/g, '.');
    setMontoRecibido(sanitizeFieldValue('COB_MONTO_RECIBIDO', normalized, { fieldType: 'number' }));
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

  function getMachineById(maqIdValue) {
    const targetId = String(maqIdValue || '').trim();
    if (!targetId) return null;
    return (
      maquinas.find((m) => String(m?.MAQ_ID) === targetId)
      || maquinasCobro.find((m) => String(m?.MAQ_ID) === targetId)
      || maquinasEntrada.find((m) => String(m?.MAQ_ID) === targetId)
      || maquinasSalida.find((m) => String(m?.MAQ_ID) === targetId)
      || null
    );
  }

  function getAssistScreenForMachine(maqIdValue) {
    const machine = getMachineById(maqIdValue);
    const tipoRaw = tiposMaquina.find((t) => String(t?.TMA_ID) === String(machine?.TMA_ID))?.TMA_TIPO;
    if (isTipoMaquinaCobro(tipoRaw)) return 'cobro';
    if (isTipoMaquinaEntrada(tipoRaw)) return 'entrada';
    if (isTipoMaquinaSalida(tipoRaw)) return 'salida';
    if (cobroOnly) return 'cobro';
    if (entradaOnly) return 'entrada';
    if (salidaOnly) return 'salida';
    return null;
  }

  function showAssistOverlay({ maqIdValue, ok, message }) {
    const screen = getAssistScreenForMachine(maqIdValue);
    if (!screen) return;
    const machine = getMachineById(maqIdValue);
    const machineName = machine ? machineLabel(machine) : 'la máquina activa';
    setAssistOverlay({
      screen,
      tone: ok ? 'success' : 'error',
      title: ok ? 'Asistencia solicitada' : 'No se pudo enviar',
      text: ok
        ? `Se notificó asistencia para ${machineName}.`
        : (message || 'No se pudo enviar la solicitud de asistencia.'),
    });
  }

  function renderAssistOverlay(screen) {
    if (!assistOverlay || assistOverlay.screen !== screen) return null;
    const iconClassName = assistOverlay.tone === 'error'
      ? 'ops-kiosk-overlay-icon ops-kiosk-overlay-icon--error'
      : 'ops-kiosk-overlay-icon ops-kiosk-overlay-icon--success';
    const textClassName = assistOverlay.tone === 'error'
      ? 'ops-kiosk-overlay-subtext ops-kiosk-overlay-subtext--error'
      : 'ops-kiosk-overlay-subtext';
    return (
      <div className={`ops-kiosk-overlay ops-kiosk-overlay--${assistOverlay.tone}`}>
        <div className="ops-kiosk-overlay-state">
          <div className={iconClassName} aria-hidden="true">
            {assistOverlay.tone === 'error' ? '!' : 'A'}
          </div>
          <h2>{assistOverlay.title}</h2>
          <p className={textClassName}>{assistOverlay.text}</p>
        </div>
      </div>
    );
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
    const ticCodigo = String(quote?.ticket?.TIC_CODIGO || '').trim();
    if (!ticCodigo || checkoutDone?.COB_ID) return undefined;

    let cancelled = false;
    const refreshQuote = async () => {
      try {
        const data = await fetchTicketQuoteByCodigo(ticCodigo);
        if (!cancelled) {
          setQuote(data);
          setQuoteNowMs(Date.now());
        }
      } catch {
        if (!cancelled) setQuoteNowMs(Date.now());
      }
    };

    const timer = window.setInterval(() => {
      setQuoteNowMs(Date.now());
      refreshQuote();
    }, QUOTE_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [quote?.ticket?.TIC_CODIGO, checkoutDone?.COB_ID]);

  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      try {
        const [rModelo, rColor, rCobro, rMaq, rSdi, rTma, rTpa] = await Promise.all([
          fetch(`${API_BASE}/modelo-vehiculo`),
          fetch(`${API_BASE}/color-vehiculo`),
          fetch(`${API_BASE}/tipo-cobro`),
          fetch(`${API_BASE}/maquina`),
          fetch(`${API_BASE}/saldo-disponible`),
          fetch(`${API_BASE}/tipo-maquina`),
          fetch(`${API_BASE}/tipo-pago`),
        ]);
        const [dModelo, dColor, dCobro, dMaq, dSdi, dTma, dTpa] = await Promise.all([
          rModelo.json(),
          rColor.json(),
          rCobro.json(),
          rMaq.json(),
          rSdi.json(),
          rTma.json(),
          rTpa.json(),
        ]);
        if (!rModelo.ok) throw new Error(dModelo.error || rModelo.statusText);
        if (!rColor.ok) throw new Error(dColor.error || rColor.statusText);
        if (!rCobro.ok) throw new Error(dCobro.error || rCobro.statusText);
        if (!rMaq.ok) throw new Error(dMaq.error || rMaq.statusText);
        if (!rSdi.ok) throw new Error(dSdi.error || rSdi.statusText);
        if (!rTma.ok) throw new Error(dTma.error || rTma.statusText);
        setTiposPago(rTpa.ok && Array.isArray(dTpa) ? dTpa : []);
        setModelosVehiculo(Array.isArray(dModelo) ? dModelo : []);
        setColoresVehiculo(Array.isArray(dColor) ? dColor : []);
        setTiposCobro(Array.isArray(dCobro) ? dCobro : []);
        setTiposMaquina(Array.isArray(dTma) ? dTma : []);
        const maqList = Array.isArray(dMaq) ? dMaq : [];
        const operativeMaqList = filterOperativeMachines(maqList);
        setMaquinas(operativeMaqList);

        const tipoById = new Map(
          (Array.isArray(dTma) ? dTma : []).map((t) => [String(t.TMA_ID), t]),
        );
        const cobroList = operativeMaqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaCobro(tipo?.TMA_TIPO);
        });
        setMaquinasCobro(cobroList);
        const pickedCobroMaqId = pickDefaultCobroMaqId(cobroList, operativeMaqList);
        setDefaultCobroMaqId(pickedCobroMaqId);

        const entradaList = operativeMaqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaEntrada(tipo?.TMA_TIPO);
        });
        setMaquinasEntrada(entradaList);
        const pickedEntradaMaqId = pickDefaultEntradaMaqId(entradaList, operativeMaqList);
        setDefaultEntradaMaqId(pickedEntradaMaqId);
        const salidaMaq = operativeMaqList.find((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaSalida(tipo?.TMA_TIPO);
        });
        const salidaList = operativeMaqList.filter((m) => {
          const tipo = tipoById.get(String(m.TMA_ID));
          return isTipoMaquinaSalida(tipo?.TMA_TIPO);
        });
        setMaquinasSalida(salidaList);
        const salidaByCode = operativeMaqList.find((m) =>
          String(m.MAQ_CODIGO || '').toLowerCase().includes('sal'),
        );
        const pickedSalidaMaqId = String(
          salidaMaq?.MAQ_ID ?? salidaByCode?.MAQ_ID ?? operativeMaqList[0]?.MAQ_ID ?? '',
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
          if (cobroOnly) {
            setMaqId((prev) => (String(prev || '').trim() ? prev : pickedCobroMaqId));
          }
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
          if (pickedSalidaMaqId) {
            setExitMaqId((prev) => (String(prev || '').trim() ? prev : pickedSalidaMaqId));
          }
        }
      } catch {
        setModelosVehiculo([]);
        setColoresVehiculo([]);
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
      ? String(vehicleForm.MAQ_ID || defaultEntradaMaqId || pickDefaultEntradaMaqId(maquinasEntrada, maquinas) || '')
      : salidaOnly
        ? String(exitMaqId || defaultSalidaMaqId || maquinasSalida[0]?.MAQ_ID || '')
        : cobroOnly
          ? String(maqId || assistMaqId || '')
          : String(assistMaqId || '');

    if (!maqAsistencia) {
      showAssistOverlay({
        maqIdValue: '',
        ok: false,
        message: 'Selecciona la maquina activa para solicitar asistencia.',
      });
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
      showAssistOverlay({
        maqIdValue: maqAsistencia,
        ok: true,
      });
      setAssistMsg(
        data?.ALE_ID != null
          ? `Solicitud registrada (alerta #${data.ALE_ID}). Revisa gestión de alertas.`
          : 'Solicitud enviada al panel.',
      );
    } catch (e) {
      const errorText = `No se pudo enviar: ${String(e?.message || e)}`;
      setAssistMsg(errorText);
      showAssistOverlay({
        maqIdValue: maqAsistencia,
        ok: false,
        message: errorText,
      });
    }
  }

  /** Limpia solo los datos del vehículo del modal de entrada; mantiene la máquina seleccionada. */
  function clearEntryVehicleFormInputs() {
    setVehicleForm((p) => ({
      ...p,
      VEH_PLACA: '',
      MOD_ID: '',
      COL_ID: '',
    }));
  }

  function applyAutocompletado() {
    const generated = generateVehicleData(modelosVehiculo, coloresVehiculo);
    const poolEntrada = maquinasEntrada.length > 0 ? maquinasEntrada : maquinas;
    const currentMaq = String(vehicleForm.MAQ_ID || '').trim();
    const selectedMaqId =
      currentMaq ||
      String(defaultEntradaMaqId || pickDefaultEntradaMaqId(maquinasEntrada, maquinas));
    setVehicleForm({
      VEH_PLACA: generated.VEH_PLACA,
      MOD_ID: generated.MOD_ID,
      COL_ID: generated.COL_ID,
      MAQ_ID: selectedMaqId || String(poolEntrada?.[0]?.MAQ_ID ?? ''),
    });
  }

  async function submitGenerateTicket() {
    if (!vehicleForm.VEH_PLACA || !vehicleForm.MOD_ID || !vehicleForm.COL_ID || !vehicleForm.MAQ_ID) {
      setMsg('Para generar ticket debes ingresar placa, modelo, color y máquina.');
      if (entradaOnly) {
        setEntryNotice({ text: 'Completa placa, modelo, color y máquina de entrada.', severity: 'warn' });
        setEntryKioskState('notice');
      }
      return;
    }
    const placaNormalizada = normalizePlateInput(vehicleForm.VEH_PLACA);
    const plateValidationMessage = getPlateValidationMessage(placaNormalizada);
    if (plateValidationMessage) {
      setMsg(plateValidationMessage);
      if (entradaOnly) {
        setEntryNotice({ text: plateValidationMessage, severity: 'warn' });
        setEntryKioskState('notice');
      }
      setVehicleForm((p) => ({ ...p, VEH_PLACA: placaNormalizada }));
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/ticket/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          VEH_PLACA: placaNormalizada,
          MOD_ID: vehicleForm.MOD_ID,
          COL_ID: vehicleForm.COL_ID,
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
        MOD_ID: '',
        COL_ID: '',
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
    setCobroCardScreenError(null);
    setQuote(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const ticCodigo = extractTicketCodeFromPdfText(pdfText);
      if (!ticCodigo) {
        setMsg('Ticket no reconocido: no se pudo extraer TIC_CODIGO del PDF.');
        if (cobroOnly) {
          setCobroUiStep('error');
          setCobroErrorText('No se pudo extraer el código del ticket del PDF.');
        }
        return;
      }

      const data = await fetchTicketQuoteByCodigo(ticCodigo);
      setQuote(data);
      setQuoteNowMs(Date.now());
      setCheckoutDone(null);
      setMsg('');
      if (cobroOnly) {
        setCobroUiStep('ticket_nit');
        setCobroErrorText('');
      }
    } catch (err) {
      const txt = String(err?.message || '');
      if (/ya saldado/i.test(txt)) {
        setMsg('El ticket ya está saldado. Carga un ticket diferente para continuar.');
        setQuote(null);
        if (cobroOnly) {
          setCobroUiStep('error');
          setCobroErrorText('El ticket ya está saldado.');
        }
        return;
      }
      if (/no reconocido/i.test(txt)) {
        setMsg('Ticket no reconocido.');
        setQuote(null);
        if (cobroOnly) {
          setCobroUiStep('error');
          setCobroErrorText('Ticket no reconocido.');
        }
        return;
      }
      setMsg(`Error: ${txt}`);
      setQuote(null);
      if (cobroOnly) {
        setCobroUiStep('error');
        setCobroErrorText(txt || 'No se pudo cargar el ticket.');
      }
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
    if (salidaOnly) {
      setSalidaKioskState('processing');
      setSalidaKioskNotice({ text: '', severity: 'error' });
    }
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const memCodigo = extractMemCodeFromPdfText(pdfText);
      if (!memCodigo) {
        const t = 'Tag no reconocido: no se pudo extraer MEM_CODIGO del PDF.';
        setMsg(t);
        if (salidaOnly) {
          setSalidaKioskState('error');
          setSalidaKioskNotice({ text: t, severity: 'error' });
        }
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
      if (salidaOnly) {
        setSalidaKioskState('success');
        setMsg('');
      }
    } catch (err) {
      const txt = String(err?.message || '');
      let friendly = '';
      if (/tag no reconocido/i.test(txt)) {
        friendly = 'Tag no reconocido.';
        setMsg(friendly);
      } else if (/ingreso activo asociado/i.test(txt)) {
        friendly = 'No se encontró un ingreso activo asociado.';
        setMsg(friendly);
      } else {
        friendly = `Error: ${txt}`;
        setMsg(friendly);
      }
      setTagExitValidationDone(null);
      if (salidaOnly) {
        setSalidaKioskState('error');
        setSalidaKioskNotice({ text: friendly || txt, severity: 'error' });
      }
    } finally {
      setLoading(false);
      if (tagSalidaFileRef.current) tagSalidaFileRef.current.value = '';
    }
  }

  async function onLoadExitPdf(file) {
    if (!exitMaqId) {
      const t = 'Selecciona la máquina de salida antes de cargar el ticket.';
      setMsg(t);
      if (salidaOnly) {
        setSalidaKioskState('error');
        setSalidaKioskNotice({ text: t, severity: 'warn' });
      }
      return;
    }
    setLoading(true);
    setMsg('');
    setExitValidationDone(null);
    if (salidaOnly) {
      setSalidaKioskState('processing');
      setSalidaKioskNotice({ text: '', severity: 'error' });
    }
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const ticCodigo = extractTicketCodeFromPdfText(pdfText);
      if (!ticCodigo) {
        const t = 'Ticket no reconocido: no se pudo extraer TIC_CODIGO del PDF.';
        setMsg(t);
        if (salidaOnly) {
          setSalidaKioskState('error');
          setSalidaKioskNotice({ text: t, severity: 'error' });
        }
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
      if (salidaOnly) {
        setSalidaKioskState('success');
        setMsg('');
      }
    } catch (err) {
      const txt = String(err?.message || '');
      let friendly = '';
      if (/no reconocido/i.test(txt)) {
        friendly = 'Ticket no reconocido.';
        setMsg(friendly);
      } else if (/no esta pagado/i.test(txt)) {
        friendly = 'Salida bloqueada: el ticket no está pagado. Dirígete a la máquina de cobro.';
        setMsg(friendly);
      } else if (/gracia superado|solicita asistencia/i.test(txt)) {
        friendly = 'Salida bloqueada: superó el tiempo de gracia. Solicita asistencia.';
        setMsg(friendly);
      } else {
        friendly = `Error: ${txt}`;
        setMsg(friendly);
      }
      setExitValidationDone(null);
      if (salidaOnly) {
        setSalidaKioskState('error');
        setSalidaKioskNotice({ text: friendly || txt, severity: 'error' });
      }
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
        setCobroCardScreenError('Ingresa el número de tarjeta.');
        return;
      }
      if (numero.length !== 16) {
        setCobroCardScreenError('El número de tarjeta debe tener 16 dígitos.');
        return;
      }
      if (!String(cardSim.nombre || '').trim()) {
        setCobroCardScreenError('Ingresa el nombre del titular de la tarjeta.');
        return;
      }
      const expRaw = String(cardSim.exp || '');
      const expMatch = expRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!expMatch) {
        setCobroCardScreenError('La fecha de vencimiento debe tener formato MM/AA válido.');
        return;
      }
      const expMonth = Number(expMatch[1]);
      const expYear = 2000 + Number(expMatch[2]);
      const now = new Date();
      const nowMonth = now.getMonth() + 1;
      const nowYear = now.getFullYear();
      if (expYear < nowYear || (expYear === nowYear && expMonth < nowMonth)) {
        setCobroCardScreenError('La tarjeta está vencida.');
        return;
      }
      const cvv = String(cardSim.cvv || '').replace(/\D/g, '');
      if (cvv.length !== 3) {
        setCobroCardScreenError('El CVV debe tener exactamente 3 dígitos.');
        return;
      }
    }
    setLoading(true);
    setMsg('');
    setCobroCardScreenError(null);
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
      if (cobroOnly) {
        setCobroUiStep('success');
        setCobroErrorText('');
      }
      setNit('');
      setCf(false);
      setTcoId('');
      setMaqId(cobroOnly ? String(defaultCobroMaqId || '') : '');
      setMontoRecibido('');
      setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
      resetCardSimulator();
    } catch (err) {
      setMsg(`Error: ${String(err?.message || err)}`);
      if (cobroOnly) {
        setCobroUiStep('error');
        setCobroErrorText(String(err?.message || err));
      }
    } finally {
      setLoading(false);
    }
  }

  function selectMembresiaParaPago(membresia) {
    setMemPaySelected(membresia);
    setMemPayRecibido('');
    setMemPayTpaId(String(memCardTipoPago?.TPA_ID || ''));
    setMemPayBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    resetMemPayCardSimulator();
    setCobroCardScreenError(null);
    setCobroUiStep('mem_tarjeta');
  }

  async function onLoadMemPayTagPdf(file) {
    setLoading(true);
    setMsg('');
    setCobroCardScreenError(null);
    setMemPayList([]);
    setMemPaySelected(null);
    setMemPayDone(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfText = await decodePdfText(buffer);
      const memCodigo = extractMemCodeFromPdfText(pdfText);
      if (!memCodigo) {
        setMsg('Tag no reconocido: no se pudo extraer MEM_CODIGO del PDF.');
        return;
      }

      const res = await fetch(
        `${API_BASE}/membresia/payment-candidates/tag/${encodeURIComponent(memCodigo)}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      selectMembresiaParaPago(data);
      setMsg('');
    } catch (e) {
      const txt = String(e?.message || e);
      if (/tag no reconocido/i.test(txt)) setMsg('Tag no reconocido.');
      else setMsg(`Error: ${txt}`);
      setMemPaySelected(null);
    } finally {
      setLoading(false);
      if (memPayTagFileRef.current) memPayTagFileRef.current.value = '';
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
    const monto = Number(memPaySelected.MEM_TOTAL_A_PAGAR ?? memPaySelected.TME_PRECIO ?? 0);
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
        setCobroCardScreenError('Ingresa el número de tarjeta.');
        return;
      }
      if (numero.length !== 16) {
        setCobroCardScreenError('El número de tarjeta debe tener 16 dígitos.');
        return;
      }
      if (!String(memPayCardSim.nombre || '').trim()) {
        setCobroCardScreenError('Ingresa el nombre del titular de la tarjeta.');
        return;
      }
      const expRaw = String(memPayCardSim.exp || '');
      const expMatch = expRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
      if (!expMatch) {
        setCobroCardScreenError('La fecha de vencimiento debe tener formato MM/AA válido.');
        return;
      }
      const expMonth = Number(expMatch[1]);
      const expYear = 2000 + Number(expMatch[2]);
      const now = new Date();
      const nowMonth = now.getMonth() + 1;
      const nowYear = now.getFullYear();
      if (expYear < nowYear || (expYear === nowYear && expMonth < nowMonth)) {
        setCobroCardScreenError('La tarjeta está vencida.');
        return;
      }
      const cvv = String(memPayCardSim.cvv || '').replace(/\D/g, '');
      if (cvv.length !== 3) {
        setCobroCardScreenError('El CVV debe tener exactamente 3 dígitos.');
        return;
      }
    }
    setLoading(true);
    setMsg('');
    setCobroCardScreenError(null);
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
      setMsg('');
      if (cobroOnly) {
        setCobroUiStep('success');
        setCobroErrorText('');
      }
    } catch (e) {
      setMsg(`Error: ${String(e?.message || e)}`);
      if (cobroOnly) {
        setCobroUiStep('error');
        setCobroErrorText(String(e?.message || e));
      }
    } finally {
      setLoading(false);
    }
  }

  function resetProcess() {
    setCobroUiStep('idle');
    setCobroErrorText('');
    setQuote(null);
    setCheckoutDone(null);
    setMsg('');
    setCobroCardScreenError(null);
    setTcoId('');
    setMaqId(cobroOnly ? String(defaultCobroMaqId || '') : '');
    setNit('');
    setCf(false);
    setMontoRecibido('');
    setEntryTicketDone(null);
    setTagValidationDone(null);
    setTagExitValidationDone(null);
    setExitValidationDone(null);
    setExitMaqId(String(defaultSalidaMaqId || ''));
    setShowGenerateForm(entradaOnly);
    setShowEntryVehicleModal(false);
    setEntryKioskState('idle');
    setEntryNotice({ text: '', severity: 'warn' });
    setEntryWelcomeName('');
    setSalidaKioskState('idle');
    setSalidaKioskNotice({ text: '', severity: 'error' });
    setBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
    resetCardSimulator();
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

  useEffect(() => {
    if (!cobroOnly || cobroUiStep !== 'error') return;
    const t = setTimeout(() => {
      resetProcess();
    }, 4000);
    return () => clearTimeout(t);
  }, [cobroOnly, cobroUiStep]);

  useEffect(() => {
    if (!cobroOnly || cobroUiStep !== 'success' || !memPayDone || checkoutDone) return;
    const t = setTimeout(() => {
      resetProcess();
    }, 4000);
    return () => clearTimeout(t);
  }, [cobroOnly, cobroUiStep, memPayDone, checkoutDone]);

  useEffect(() => {
    if (!cobroCardScreenError) return;
    if (cobroUiStep !== 'pago_tarjeta' && cobroUiStep !== 'mem_tarjeta') return;
    const t = setTimeout(() => setCobroCardScreenError(null), 4000);
    return () => clearTimeout(t);
  }, [cobroCardScreenError, cobroUiStep]);

  useEffect(() => {
    if (!salidaOnly || salidaKioskState !== 'success') return;
    const t = setTimeout(() => {
      setSalidaKioskState('idle');
      setExitValidationDone(null);
      setTagExitValidationDone(null);
      setSalidaKioskNotice({ text: '', severity: 'error' });
    }, 4000);
    return () => clearTimeout(t);
  }, [salidaOnly, salidaKioskState]);

  useEffect(() => {
    if (!salidaOnly || salidaKioskState !== 'error') return;
    const t = setTimeout(() => {
      setSalidaKioskState('idle');
      setSalidaKioskNotice({ text: '', severity: 'error' });
      setMsg('');
    }, 4000);
    return () => clearTimeout(t);
  }, [salidaOnly, salidaKioskState]);

  useEffect(() => {
    if (!assistOverlay) return;
    const t = setTimeout(() => {
      setAssistOverlay(null);
    }, ASSISTANCE_OVERLAY_MS);
    return () => clearTimeout(t);
  }, [assistOverlay]);

  const cobroBottomDisabled =
    cobroOnly && (cobroUiStep !== 'idle' || loading || catalogLoading);
  const cobroCashIngresado = sumaBilletes;
  const cobroCashVuelto =
    cobroCashIngresado >= montoTotalCalculado
      ? Number((cobroCashIngresado - montoTotalCalculado).toFixed(2))
      : 0;

  return (
    <div
      className={
        embeddedInAdmin
          ? `ops-shell ops-shell--embedded${cobroOnly ? ' ops-shell--cobro' : ''}${entradaOnly ? ' ops-shell--entry' : ''}${salidaOnly ? ' ops-shell--salida' : ''}`
          : `admin-page ops-page-public${entradaOnly ? ' ops-page-public--entry' : cobroOnly ? ' ops-page-public--cobro' : salidaOnly ? ' ops-page-public--salida' : ''}`
      }
      style={{
        maxWidth: embeddedInAdmin ? '100%' : entradaOnly || cobroOnly || salidaOnly ? '100%' : 1040,
        margin: embeddedInAdmin || entradaOnly || cobroOnly || salidaOnly ? 0 : '12px auto',
        padding:
          entradaOnly || cobroOnly || salidaOnly
            ? embeddedInAdmin
              ? 16
              : cobroOnly
                ? undefined
                : 0
            : 16,
      }}
    >
      {showBackToLogin ? (
        <Link to="/login" className="ops-kiosk-nav-login">
          ← Volver al login
        </Link>
      ) : null}

      {!entradaOnly && !cobroOnly && !salidaOnly ? (
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

      {salidaOnly ? (
        <div className="ops-entry-config">
          <label>
            <span>Máquina de salida</span>
            <select value={exitMaqId} onChange={(e) => setExitMaqId(e.target.value)}>
              {(maquinasSalida.length ? maquinasSalida : maquinas).map((m) => (
                <option key={m.MAQ_ID} value={m.MAQ_ID}>
                  {machineLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {cobroOnly && !catalogLoading ? (
        <>
          {/* Mismo patrón que máquina de entrada: hijo directo de la página para que en admin el absolute sea respecto al panel, no al bloque centrado. */}
          <div className="ops-cobro-config">
            <label>
              <span>Máquina de cobro</span>
              <select value={maqId} onChange={(e) => setMaqId(e.target.value)}>
                {(maquinasCobro.length ? maquinasCobro : maquinas).map((m) => (
                  <option key={m.MAQ_ID} value={m.MAQ_ID}>
                    {machineLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ops-cobro-kiosk-root">
          <div className="ops-cobro-split">
            <div className="ops-cobro-left">
              <div
                className={`ops-cobro-screen${
                  cobroUiStep === 'error'
                    ? ' ops-cobro-screen--error'
                    : cobroUiStep === 'success'
                      ? ' ops-cobro-screen--success'
                      : ''
                }`}
              >
                <div
                  className={`ops-cobro-screen-inner${
                    quote && (cobroUiStep === 'ticket_nit' || cobroUiStep === 'pago_metodo' || cobroUiStep === 'pago_efectivo' || cobroUiStep === 'pago_tarjeta')
                      ? ' ops-cobro-screen-inner--receipt'
                      : memPaySelected && (cobroUiStep === 'mem_tarjeta' || cobroUiStep === 'success')
                        ? ' ops-cobro-screen-inner--receipt'
                        : ''
                  }`}
                >
                  {cobroUiStep === 'idle' ? (
                    <div className="ops-cobro-state">
                      <div className="ops-cobro-icon" aria-hidden="true">
                        C
                      </div>
                      <h2>Bienvenido a Caja</h2>
                      <p className="ops-cobro-subtext ops-cobro-subtext--pulse">
                        Espacios disponibles: {espacioResumen?.disponibles ?? '—'} de {espacioResumen?.total ?? '—'}
                      </p>
                    </div>
                  ) : null}

                  {cobroUiStep === 'error' ? (
                    <div className="ops-cobro-state">
                      <div className="ops-cobro-icon ops-cobro-icon--warn" aria-hidden="true">!</div>
                      <h2>No se pudo completar</h2>
                      <p className="ops-cobro-subtext ops-cobro-subtext--error">
                        {cobroErrorText || msg || 'Intente de nuevo.'}
                      </p>
                    </div>
                  ) : null}

                  {cobroUiStep === 'success' ? (
                    <div className="ops-cobro-state">
                      <div className="ops-cobro-icon ops-cobro-icon--success" aria-hidden="true">
                        ✓
                      </div>
                      <h2>¡Pago exitoso!</h2>
                      {checkoutDone && Number(checkoutDone.COB_VUELTO) > 0 ? (
                        <p className="ops-cobro-subtext">Vuelto: Q{Number(checkoutDone.COB_VUELTO).toFixed(2)}</p>
                      ) : null}
                      {memPayDone?.MEM_FECHA_VENCIMIENTO ? (
                        <p className="ops-cobro-subtext">
                          Vigencia hasta {new Date(memPayDone.MEM_FECHA_VENCIMIENTO).toLocaleString('es-GT')}
                          {memPayDone.REACTIVATED ? ' (reactivada).' : null}
                        </p>
                      ) : null}
                      {checkoutDone?.TIC_ID ? (
                        <p className="ops-cobro-subtext" style={{ marginTop: 12 }}>
                          Use el panel derecho para descargar el comprobante.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {cobroUiStep === 'ticket_nit' && quote ? (
                    String(nit || '').length > 0 && !cf ? (
                      <div className="ops-cobro-state">
                        <h2>¿Cómo desea facturar?</h2>
                        <p className="ops-cobro-subtext">Ingrese NIT con el teclado o seleccione CF</p>
                        <p className="ops-cobro-nit-live">NIT: {nit}_</p>
                      </div>
                    ) : (
                      <div className="ops-cobro-receipt">
                        <div className="ops-cobro-receipt-title">ðŸŽ« DETALLE DEL TICKET</div>
                        <hr />
                        <div className="ops-cobro-receipt-row">
                          <span>Ticket</span>
                          <span>{cobroShortTicketCode(quote.ticket?.TIC_CODIGO)}</span>
                        </div>
                        <div className="ops-cobro-receipt-row">
                          <span>Placa</span>
                          <span>{quote.ticket?.VEH_PLACA || 'N/D'}</span>
                        </div>
                        <div className="ops-cobro-receipt-row">
                          <span>Entrada</span>
                          <span>
                            {quote.ticket?.TIC_FECHA_HORA_ENTRADA
                              ? new Date(quote.ticket.TIC_FECHA_HORA_ENTRADA).toLocaleString('es-GT')
                              : 'N/D'}
                          </span>
                        </div>
                        <div className="ops-cobro-receipt-row">
                          <span>Estadía</span>
                          <span>{totalStayLabel}</span>
                        </div>
                        {showFacturableStay ? (
                          <div className="ops-cobro-receipt-row">
                            <span>Tiempo facturable</span>
                            <span>{facturableStayLabel}</span>
                          </div>
                        ) : null}
                        <div className="ops-cobro-receipt-row">
                          <span>Tarifa</span>
                          <span>
                            Q{quote.tarifa?.TAR_PRECIO} / hora ({quote.tarifa?.TAR_TIPO || '—'})
                          </span>
                        </div>
                        {Number(quote.recargoTicketExtraviado) > 0 ? (
                          <div className="ops-cobro-receipt-row" style={{ color: '#fbbf24' }}>
                            <span>Recargo extraviado</span>
                            <span>Q{Number(quote.recargoTicketExtraviado).toFixed(2)}</span>
                          </div>
                        ) : null}
                        <div className="ops-cobro-receipt-total">TOTAL A PAGAR: Q{montoTotalCalculado.toFixed(2)}</div>
                      </div>
                    )
                  ) : null}

                  {cobroUiStep === 'pago_metodo' && quote ? (
                    <div className="ops-cobro-state">
                      <h2>Seleccione forma de pago</h2>
                      <p className="ops-cobro-subtext">Efectivo o Tarjeta</p>
                      <div className="ops-cobro-receipt" style={{ marginTop: 14 }}>
                        <div className="ops-cobro-receipt-row">
                          <span>Total</span>
                          <span>Q{montoTotalCalculado.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {cobroUiStep === 'pago_efectivo' && quote ? (
                    <div className="ops-cobro-receipt">
                      <div className="ops-cobro-receipt-title">EFECTIVO</div>
                      <hr />
                      <div className="ops-cobro-receipt-row">
                        <span>Total a pagar</span>
                        <span>Q{montoTotalCalculado.toFixed(2)}</span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Ingresado</span>
                        <span>Q{cobroCashIngresado.toFixed(2)}</span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Vuelto</span>
                        <span>Q{cobroCashVuelto.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : null}

                  {cobroUiStep === 'pago_tarjeta' && quote ? (
                    <div className="ops-cobro-state">
                      <h2>Pago con tarjeta</h2>
                      <p className="ops-cobro-subtext">Complete los datos en el panel derecho</p>
                      <p className="ops-cobro-receipt-total" style={{ marginTop: 16 }}>
                        TOTAL: Q{montoTotalCalculado.toFixed(2)}
                      </p>
                    </div>
                  ) : null}

                  {cobroUiStep === 'mem_buscar' ? (
                    <div className="ops-cobro-state">
                      <div className="ops-cobro-icon" aria-hidden="true">
                        M
                      </div>
                      <h2>Pagar membresía</h2>
                      <p className="ops-cobro-subtext">Cargue el tag de membresía en el panel derecho</p>
                    </div>
                  ) : null}

                  {cobroUiStep === 'mem_tarjeta' && memPaySelected ? (
                    <div className="ops-cobro-receipt">
                      <div className="ops-cobro-receipt-title">MEMBRESÍA</div>
                      <hr />
                      <div className="ops-cobro-receipt-row">
                        <span>Titular</span>
                        <span>
                          {[memPaySelected.CLI_PRIMER_NOMBRE, memPaySelected.CLI_PRIMER_APELLIDO]
                            .filter(Boolean)
                            .join(' ') || '—'}
                        </span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Placa</span>
                        <span>{memPaySelected.VEH_PLACA || '—'}</span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Plan</span>
                        <span>{memPaySelected.TME_TIPO || '—'}</span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Estado</span>
                        <span>{memPaySelected.EME_ESTADO || '—'}</span>
                      </div>
                      <div className="ops-cobro-receipt-row">
                        <span>Membresía</span>
                        <span>Q{memMontoPlan.toFixed(2)}</span>
                      </div>
                      {memRequiereReactivacion ? (
                        <div className="ops-cobro-receipt-row" style={{ color: '#fbbf24' }}>
                          <span>Mora de reactivación</span>
                          <span>Q{memMoraReactivacion.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="ops-cobro-receipt-total">TOTAL: Q{memTotalPagar.toFixed(2)}</div>
                    </div>
                  ) : null}
                </div>
                {renderAssistOverlay('cobro')}
                {cobroCardScreenError && (cobroUiStep === 'pago_tarjeta' || cobroUiStep === 'mem_tarjeta') ? (
                  <div className="ops-cobro-card-error-overlay" role="alert" aria-live="assertive">
                    <div className="ops-cobro-state">
                      <div className="ops-cobro-icon ops-cobro-icon--error" aria-hidden="true">
                        ✕
                      </div>
                      <h2>No se pudo completar</h2>
                      <p className="ops-cobro-subtext ops-cobro-subtext--error">{cobroCardScreenError}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ops-entry-kiosk-controls ops-cobro-bottom-btns">
                <input
                  id="cobro-ticket-upload"
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="ops-cobro-sr-file"
                  aria-label="Seleccionar PDF del ticket"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLoadPdf(f);
                  }}
                />
                {cobroBottomDisabled ? (
                  <button type="button" className="admin-btn-primary ops-cobro-bottom-action" disabled>
                    Pagar Ticket
                  </button>
                ) : (
                  <label htmlFor="cobro-ticket-upload" className="admin-btn-primary ops-cobro-upload-label ops-cobro-bottom-action">
                    Pagar Ticket
                  </label>
                )}
                <button
                  type="button"
                  className="admin-btn-primary ops-cobro-bottom-action"
                  disabled={cobroBottomDisabled}
                  onClick={() => {
                    setMemPayList([]);
                    setMemPaySelected(null);
                    setMemPayDone(null);
                    setCheckoutDone(null);
                    setMemPayTpaId('');
                    setMemPayRecibido('');
                    setMemPayBilletes({ 5: 0, 10: 0, 20: 0, 50: 0 });
                    resetMemPayCardSimulator();
                    setCobroUiStep('mem_buscar');
                    setMsg('');
                    setCobroCardScreenError(null);
                  }}
                >
                  Pagar Membresía
                </button>
              </div>
            </div>

            <div className="ops-cobro-right">
              {cobroUiStep === 'success' && checkoutDone ? (
                checkoutDone.TIC_ID ? (
                  <>
                    <p className="ops-cobro-right-hint">
                      Pulse «Descargar comprobante» para abrir el PDF y volver al inicio.
                    </p>
                    <div className="ops-cobro-card-actions">
                      <button
                        type="button"
                        className="ops-cobro-physical-btn ops-cobro-physical-btn--wide"
                        onClick={() => downloadReceiptAndReset()}
                      >
                        ⬇ Descargar comprobante
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="ops-cobro-right-hint">No hay referencia de ticket para generar el comprobante.</p>
                    <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={() => resetProcess()}>
                      Volver al inicio
                    </button>
                  </>
                )
              ) : null}

              {cobroUiStep === 'success' && memPayDone && !checkoutDone ? (
                <p className="ops-cobro-right-hint">Pago registrado. Volviendo al inicio…</p>
              ) : null}

              {cobroUiStep === 'idle' ? (
                <p className="ops-cobro-right-hint">Seleccione una opción en los botones inferiores</p>
              ) : null}

              {cobroUiStep === 'ticket_nit' && quote ? (
                <>
                  <p className="ops-cobro-right-hint">Facturación: CF o NIT</p>
                  <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={cobroPressCf}>
                    CF — Consumidor final
                  </button>
                  <div className="ops-cobro-keypad" role="group" aria-label="Teclado NIT">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="ops-cobro-physical-btn"
                        onClick={() => cobroNitKeypadDigit(d)}
                      >
                        {d}
                      </button>
                    ))}
                    <button type="button" className="ops-cobro-physical-btn" onClick={cobroNitKeypadDel}>
                      DEL
                    </button>
                    <button type="button" className="ops-cobro-physical-btn" onClick={() => cobroNitKeypadDigit('0')}>
                      0
                    </button>
                    <button type="button" className="ops-cobro-physical-btn" onClick={cobroConfirmNitKiosk}>
                      OK
                    </button>
                  </div>
                </>
              ) : null}

              {cobroUiStep === 'pago_metodo' && quote ? (
                <div className="ops-cobro-pay-row">
                  <p className="ops-cobro-right-hint">Forma de pago</p>
                  <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={cobroGoEfectivo}>
                    ðŸ’µ Efectivo
                  </button>
                  <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={cobroGoTarjeta}>
                    ðŸ’³ Tarjeta
                  </button>
                </div>
              ) : null}

              {cobroUiStep === 'pago_efectivo' && quote ? (
                <>
                  <p className="ops-cobro-right-hint">Seleccione billetes / monedas</p>
                  <div className="ops-cobro-bill-grid">
                    {denominacionesDisponibles.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="ops-cobro-physical-btn"
                        disabled={cobroCashIngresado >= montoTotalCalculado}
                        onClick={() => cobroAddDenominacion(d)}
                      >
                        Q{d}
                      </button>
                    ))}
                  </div>
                  <div className="ops-cobro-cash-totals">
                    <div>
                      <span>Ingresado</span>
                      <span>Q{cobroCashIngresado.toFixed(2)}</span>
                    </div>
                    <div>
                      <span>Vuelto</span>
                      <span>Q{cobroCashVuelto.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="ops-cobro-card-actions">
                    <button
                      type="button"
                      className="ops-cobro-physical-btn ops-cobro-physical-btn--wide"
                      disabled={loading || cobroCashIngresado < montoTotalCalculado}
                      onClick={() => submitCheckout()}
                    >
                      ✓ Confirmar pago
                    </button>
                    <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={cobroCancelToPaymentMethod}>
                      ✕ Cancelar
                    </button>
                  </div>
                </>
              ) : null}

              {cobroUiStep === 'pago_tarjeta' && quote ? (
                <>
                  <p className="ops-cobro-right-hint">Datos de tarjeta</p>
                  <div className="ops-cobro-card-form">
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
                    />
                    <input
                      type="text"
                      placeholder="Nombre en tarjeta"
                      value={cardSim.nombre}
                      onChange={(e) => setCardSim((p) => ({ ...p, nombre: sanitizeSearchValue('nombre', e.target.value) }))}
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
                    />
                  </div>
                  <div className="ops-cobro-card-actions">
                    <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" disabled={loading} onClick={() => submitCheckout()}>
                      ✓ Confirmar pago
                    </button>
                    <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={cobroCancelToPaymentMethod}>
                      ✕ Cancelar
                    </button>
                  </div>
                </>
              ) : null}

              {cobroUiStep === 'mem_buscar' ? (
                <>
                  <p className="ops-cobro-right-hint">Escanee o cargue el tag del cliente</p>
                  <input
                    ref={memPayTagFileRef}
                    type="file"
                    accept="application/pdf"
                    className="ops-cobro-sr-file"
                    aria-label="Seleccionar PDF del tag de membresía"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLoadMemPayTagPdf(f);
                    }}
                  />
                  <div className="ops-cobro-card-actions">
                    <button
                      type="button"
                      className="ops-cobro-physical-btn ops-cobro-physical-btn--wide"
                      onClick={() => memPayTagFileRef.current?.click()}
                      disabled={loading}
                    >
                      Cargar Tag
                    </button>
                  </div>
                  {memPayList.length > 0 ? (
                    <div className="ops-cobro-mem-list" role="listbox" aria-label="Membresías encontradas">
                      {memPayList.map((m) => {
                        const id = m.MEM_ID ?? m.mem_id;
                        const nom = [m.CLI_PRIMER_NOMBRE, m.CLI_PRIMER_APELLIDO].filter(Boolean).join(' ');
                        const venc = m.MEM_FECHA_VENCIMIENTO
                          ? new Date(m.MEM_FECHA_VENCIMIENTO).toLocaleDateString('es-GT')
                          : '—';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              selectMembresiaParaPago(m);
                            }}
                          >
                            <strong>#{id}</strong> — {m.VEH_PLACA || '—'} — {nom || 'Cliente'} — {m.TME_TIPO || 'Plan'} — Q
                            {Number(m.MEM_TOTAL_A_PAGAR ?? m.TME_PRECIO ?? 0).toFixed(2)}
                            {Number(m.MEM_MORA_REACTIVACION ?? 0) > 0 ? ' con mora' : ''} — Vence {venc} — {m.EME_ESTADO || '—'}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="ops-cobro-card-actions" style={{ marginTop: 12 }}>
                    <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={() => resetProcess()}>
                      ✕ Cancelar
                    </button>
                  </div>
                </>
              ) : null}

              {cobroUiStep === 'mem_tarjeta' && memPaySelected ? (
                <>
                  {!hasMemPayTpaSeleccionado ? (
                    <p className="ops-cobro-right-hint">No hay tipo de pago con tarjeta en catálogo.</p>
                  ) : isMemPayCardSelected ? (
                    <>
                      <p className="ops-cobro-right-hint">Pago con tarjeta</p>
                      <div className="ops-cobro-card-form">
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
                        />
                        <input
                          type="text"
                          placeholder="Nombre en tarjeta"
                          value={memPayCardSim.nombre}
                          onChange={(e) => setMemPayCardSim((p) => ({ ...p, nombre: sanitizeSearchValue('nombre', e.target.value) }))}
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
                        />
                      </div>
                      <div className="ops-cobro-card-actions">
                        <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" disabled={loading} onClick={confirmarPagoMembresia}>
                          ✓ Confirmar pago
                        </button>
                        <button type="button" className="ops-cobro-physical-btn ops-cobro-physical-btn--wide" onClick={() => resetProcess()}>
                          ✕ Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="ops-cobro-right-hint">El tipo de pago configurado no es tarjeta.</p>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {cobroOnly && msg && cobroUiStep !== 'error' && cobroUiStep !== 'success' ? (
            <p className="ops-cobro-msg-banner" role="status">
              {msg}
            </p>
          ) : null}
          {loading ? (
            <div className="ops-loader-wrap" style={{ justifyContent: 'center', width: '100%' }}>
              <span className="ops-loader" aria-hidden="true" />
              <span>Procesando…</span>
            </div>
          ) : null}
          </div>
        </>
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
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">!</div>
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
            {renderAssistOverlay('entrada')}
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

      {salidaOnly && !catalogLoading ? (
        <section className="ops-entry-kiosk-wrap" aria-label="Pantalla de máquina de salida">
          <input
            ref={salidaFileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setSalidaKioskState('idle');
                return;
              }
              onLoadExitPdf(f);
            }}
          />
          <input
            ref={tagSalidaFileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setSalidaKioskState('idle');
                return;
              }
              onLoadTagExitPdf(f);
            }}
          />

          <div
            className={`ops-entry-kiosk-screen${
              salidaKioskState === 'error' && salidaKioskNotice.severity === 'error'
                ? ' ops-entry-kiosk-screen--error'
                : ''
            }`}
          >
            <div className="ops-entry-kiosk-screen-inner">
              {salidaKioskState === 'idle' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon" aria-hidden="true">
                    ⇨
                  </div>
                  <h2>Hasta pronto</h2>
                  <p className="ops-entry-kiosk-subtext ops-entry-kiosk-subtext--pulse">
                    Espacios disponibles: {espacioResumen?.disponibles ?? '—'} de {espacioResumen?.total ?? '—'}
                  </p>
                </div>
              ) : null}

              {salidaKioskState === 'processing' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-loader" aria-hidden="true">
                    <span className="ops-loader" />
                  </div>
                  <h2>Validando…</h2>
                </div>
              ) : null}

              {salidaKioskState === 'success' ? (
                <div className="ops-entry-kiosk-state">
                  <div className="ops-entry-kiosk-icon ops-entry-kiosk-icon--success" aria-hidden="true">
                    ✓
                  </div>
                  <h2>¡Puede salir!</h2>
                  <p className="ops-entry-kiosk-subtext">Barrera abierta — Buen viaje</p>
                </div>
              ) : null}

              {salidaKioskState === 'error' ? (
                <div className="ops-entry-kiosk-state">
                  <div
                    className={`ops-entry-kiosk-icon${
                      salidaKioskNotice.severity === 'error' ? ' ops-entry-kiosk-icon--error' : ' ops-entry-kiosk-icon--warn'
                    }`}
                    aria-hidden="true"
                  >
                    {salidaKioskNotice.severity === 'error' ? '✕' : '⚠'}
                  </div>
                  <h2>{salidaKioskNotice.severity === 'error' ? 'No se pudo completar' : 'Aviso'}</h2>
                  <p
                    className={`ops-entry-kiosk-subtext ${
                      salidaKioskNotice.severity === 'error'
                        ? 'ops-entry-kiosk-subtext--error'
                        : 'ops-entry-kiosk-subtext--warn'
                    }`}
                  >
                    {salidaKioskNotice.text || 'No se pudo completar la operación.'}
                  </p>
                </div>
              ) : null}
            </div>
            {renderAssistOverlay('salida')}
          </div>

          <div className="ops-entry-kiosk-controls">
            <button
              type="button"
              className="admin-btn-primary"
              disabled={salidaKioskState !== 'idle' || loading || catalogLoading}
              onClick={() => salidaFileRef.current?.click()}
            >
              Cargar Ticket
            </button>
            <button
              type="button"
              className="admin-btn-primary"
              disabled={salidaKioskState !== 'idle' || loading || catalogLoading}
              onClick={() => tagSalidaFileRef.current?.click()}
            >
              Cargar Tag
            </button>
          </div>
        </section>
      ) : null}

      {!entradaOnly && !cobroOnly && !salidaOnly ? <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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

      {!cobroOnly && !entradaOnly && !salidaOnly ? <section className="admin-panel-block ops-panel-block">
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

      {!cobroOnly && !entradaOnly && !salidaOnly ? <section className="admin-panel-block ops-panel-block">
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

      {!cobroOnly ? (
      <div className="ops-main-ticket-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!entradaOnly && !salidaOnly && !cobroOnly ? (
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
            className="admin-btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={loading || catalogLoading}
            title="Selecciona el PDF del ticket para cotizar y completar el pago en el detalle de cobro."
          >
            Pagar ticket
          </button>
        ) : null}
      </div>
      ) : null}

      {!cobroOnly ? (
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
      ) : null}
      {loading && !cobroOnly && !salidaOnly ? <span style={{ marginLeft: 10 }}>Procesando...</span> : null}

      {!entradaOnly && !cobroOnly && !salidaOnly && msg ? (
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
                placeholder={getFieldPlaceholder('VEH_PLACA')}
                value={vehicleForm.VEH_PLACA}
                maxLength={PLATE_MAX_LENGTH}
                onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_PLACA: normalizePlateInput(e.target.value) }))}
              />
              <select
                value={vehicleForm.MOD_ID}
                onChange={(e) => setVehicleForm((p) => ({ ...p, MOD_ID: e.target.value }))}
              >
                <option value="">Selecciona modelo</option>
                {modelosVehiculo.map((modelo) => (
                  <option key={modelo.MOD_ID} value={modelo.MOD_ID}>
                    {modeloVehiculoOptionLabel(modelo)}
                  </option>
                ))}
              </select>
              <select
                value={vehicleForm.COL_ID}
                onChange={(e) => setVehicleForm((p) => ({ ...p, COL_ID: e.target.value }))}
              >
                <option value="">Selecciona color</option>
                {coloresVehiculo.map((color) => (
                  <option key={color.COL_ID} value={color.COL_ID}>
                    {color.COL_NOMBRE || `Color ${color.COL_ID}`}
                  </option>
                ))}
              </select>
            </div>
            {selectedModeloVehiculo ? (
              <p className="ops-entry-modal-helper">
                Marca: {selectedModeloVehiculo.MAR_NOMBRE || 'N/D'} | Tipo: {selectedModeloVehiculo.TVE_TIPO || 'N/D'}
              </p>
            ) : null}
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
              placeholder={getFieldPlaceholder('VEH_PLACA')}
              value={vehicleForm.VEH_PLACA}
              maxLength={PLATE_MAX_LENGTH}
              onChange={(e) => setVehicleForm((p) => ({ ...p, VEH_PLACA: normalizePlateInput(e.target.value) }))}
              style={{ padding: '8px 10px', minWidth: 160 }}
            />
            <select
              value={vehicleForm.MOD_ID}
              onChange={(e) => setVehicleForm((p) => ({ ...p, MOD_ID: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 220 }}
            >
              <option value="">Selecciona modelo</option>
              {modelosVehiculo.map((modelo) => (
                <option key={modelo.MOD_ID} value={modelo.MOD_ID}>
                  {modeloVehiculoOptionLabel(modelo)}
                </option>
              ))}
            </select>
            <select
              value={vehicleForm.COL_ID}
              onChange={(e) => setVehicleForm((p) => ({ ...p, COL_ID: e.target.value }))}
              style={{ padding: '8px 10px', minWidth: 180 }}
            >
              <option value="">Selecciona color</option>
              {coloresVehiculo.map((color) => (
                <option key={color.COL_ID} value={color.COL_ID}>
                  {color.COL_NOMBRE || `Color ${color.COL_ID}`}
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
            {selectedModeloVehiculo ? (
              <div style={{ width: '100%', color: '#475569', fontSize: 13 }}>
                Marca: {selectedModeloVehiculo.MAR_NOMBRE || 'N/D'} | Tipo: {selectedModeloVehiculo.TVE_TIPO || 'N/D'}
              </div>
            ) : null}
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

      {!cobroOnly && !entradaOnly && !salidaOnly && tagExitValidationDone && (
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

      {!cobroOnly && !entradaOnly && !salidaOnly && exitValidationDone && (
        <div style={{ marginTop: 14, border: '1px solid #b6dfbc', background: '#f4fff6', borderRadius: 8, padding: 14 }}>
          <strong>Salida autorizada</strong>
          <p style={{ margin: '6px 0' }}>Ticket: {exitValidationDone.TIC_CODIGO}</p>
          <p style={{ margin: '6px 0' }}>Minutos desde pago: {exitValidationDone.minutesSincePayment}</p>
          <p style={{ margin: '6px 0' }}>Gracia permitida (min): {exitValidationDone.graceMinutes}</p>
        </div>
      )}

      {quote && !cobroOnly ? (
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
            <strong>Tiempo de estadía:</strong> {totalStayLabel}
          </p>
          {showFacturableStay ? (
            <p style={{ margin: '6px 0' }}>
              <strong>Tiempo facturable:</strong> {facturableStayLabel}
            </p>
          ) : null}
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
          <h3 style={{ marginBottom: 8 }}>Facturación (campos automáticos y manuales)</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={tcoId} onChange={(e) => setTcoId(e.target.value)} style={{ padding: '8px 10px', minWidth: 260 }}>
              <option value="">Selecciona tipo de cobro</option>
              {tiposCobro.map((t) => (
                <option key={t.TCO_ID} value={t.TCO_ID}>
                  {t.TCO_TIPO} ({t.TCO_ID})
                </option>
              ))}
            </select>
            <select value={maqId} onChange={(e) => setMaqId(e.target.value)} style={{ padding: '8px 10px', minWidth: 220 }}>
              <option value="">Selecciona máquina de cobro</option>
              {maquinas.map((m) => (
                <option key={m.MAQ_ID} value={m.MAQ_ID}>
                  {machineLabel(m)}
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
              placeholder={getFieldPlaceholder('COB_NIT')}
              value={nit}
              disabled={cf}
              onChange={(e) => setNit(sanitizeFieldValue('COB_NIT', e.target.value))}
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
                  placeholder={getFieldPlaceholder('COB_MONTO_RECIBIDO')}
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
                      setCardSim((p) => ({ ...p, nombre: sanitizeSearchValue('nombre', e.target.value) }))
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
              Continuar
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
            Campos automáticos: horas, monto total y vuelto. Campo manual: monto recibido.
          </p>
        </div>
      ) : null}

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

      {checkoutDone && !cobroOnly ? (
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
      ) : null}
    </div>
  );
}


