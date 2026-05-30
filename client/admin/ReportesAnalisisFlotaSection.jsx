import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  buildDoughnutOptions,
  buildLegendItems,
  createHorizontalGradient,
  formatNumber,
} from './reportChartUtils.js';
import { ReportChartCard, ReportLegend } from './ReportChartPrimitives.jsx';
import { ReportDetailNav } from './ReportCardMenu.jsx';

import { useReportFilter } from './ReportFilterContext.jsx';
// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}
function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function defaultRange() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 89);
  return { desde: ymd(desde), hasta: ymd(hasta) };
}
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
function fmtDuracion(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n < 0) return '—';
  const total = Math.round(n);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const SERIE_COLORS = [
  REPORT_PALETTE.blue,
  REPORT_PALETTE.teal,
  REPORT_PALETTE.amber,
  REPORT_PALETTE.violet,
  REPORT_PALETTE.green,
  REPORT_PALETTE.orange,
  REPORT_PALETTE.cyan,
];
const COLOR_OTRAS = REPORT_PALETTE.slate;
const HORAS = Array.from({ length: 24 }, (_, i) => i);

// Clave temporal según la agrupación elegida.
function claveDe(agrupacion, v) {
  if (agrupacion === 'dia') {
    return { key: String(v.diaSemana), label: DIAS[v.diaSemana], orden: (v.diaSemana + 6) % 7 };
  }
  if (agrupacion === 'mes') {
    return {
      key: `${v.anio}-${pad2(v.mes)}`,
      label: `${MESES[v.mes - 1]} ${v.anio}`,
      orden: v.anio * 12 + v.mes,
    };
  }
  return { key: String(v.hora), label: `${pad2(v.hora)}:00`, orden: v.hora };
}

function ordenarUnicos(lista) {
  return [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function mesKey(v) {
  return `${v.anio}-${pad2(v.mes)}`;
}

function mesLabel(key) {
  const [anio, mes] = String(key || '').split('-');
  const idx = Number(mes) - 1;
  if (!anio || idx < 0 || idx > 11) return key || '';
  return `${MESES[idx]} ${anio}`;
}

function contarPor(lista, keyFn) {
  const map = new Map();
  lista.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label)));
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ReportesAnalisisFlotaSection({ onBackToReports = null }) {
  const { filtros, setFiltro } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(null);

  const [agrupacion, setAgrupacion] = useState('hora');
  const [fTipoCliente, setFTipoCliente] = useState('Todos');
  const [fTipoVehiculo, setFTipoVehiculo] = useState('Todos');
  const [fMarca, setFMarca] = useState('Todos');
  const [fModelo, setFModelo] = useState('Todos');
  const [fColor, setFColor] = useState('Todos');
  const [fPlaca, setFPlaca] = useState('');
  const [fDiaSemana, setFDiaSemana] = useState('Todos');
  const [fMes, setFMes] = useState('Todos');
  const [fHoraIni, setFHoraIni] = useState('');
  const [fHoraFin, setFHoraFin] = useState('');
  const [fEstadiaMin, setFEstadiaMin] = useState('');
  const [fEstadiaMax, setFEstadiaMax] = useState('');

  function limpiarFiltros() {
    setFTipoCliente('Todos');
    setFTipoVehiculo('Todos');
    setFMarca('Todos');
    setFModelo('Todos');
    setFColor('Todos');
    setFPlaca('');
    setFDiaSemana('Todos');
    setFMes('Todos');
    setFHoraIni('');
    setFHoraFin('');
    setFEstadiaMin('');
    setFEstadiaMax('');
  }

  async function generar(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    setRaw(null);
    limpiarFiltros();
    try {
      const q = new URLSearchParams({ desde, hasta }).toString();
      const res = await fetch(`${API_BASE}/reportes/analisis-flota?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setRaw(json);
    } catch (err) {
      setError(err.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  function exportarPdf() {
    const params = { desde, hasta };
    if (fTipoCliente !== 'Todos') params.tipoCliente = fTipoCliente;
    if (fTipoVehiculo !== 'Todos') params.tipoVehiculo = fTipoVehiculo;
    if (fMarca !== 'Todos') params.marca = fMarca;
    if (fModelo !== 'Todos') params.modelo = fModelo;
    if (fColor !== 'Todos') params.color = fColor;
    if (fPlaca.trim()) params.placa = fPlaca.trim();
    if (fDiaSemana !== 'Todos') params.diaSemana = fDiaSemana;
    if (fMes !== 'Todos') params.mes = fMes;
    if (fHoraIni !== '') params.horaIni = fHoraIni;
    if (fHoraFin !== '') params.horaFin = fHoraFin;
    if (fEstadiaMin !== '') params.estadiaMin = fEstadiaMin;
    if (fEstadiaMax !== '') params.estadiaMax = fEstadiaMax;
    const q = new URLSearchParams(params).toString();
    window.open(`${API_BASE}/reportes/analisis-flota/pdf?${q}`, '_blank', 'noopener,noreferrer');
  }

  const visitas = useMemo(() => (Array.isArray(raw?.visitas) ? raw.visitas : []), [raw]);

  const tiposCliente = useMemo(() => ordenarUnicos(visitas.map((v) => v.tipoCliente)), [visitas]);
  const tiposVehiculo = useMemo(() => ordenarUnicos(visitas.map((v) => v.tipoVehiculo)), [visitas]);
  const marcas = useMemo(() => ordenarUnicos(visitas.map((v) => v.marca)), [visitas]);
  const modelos = useMemo(() => ordenarUnicos(visitas.map((v) => v.modelo)), [visitas]);
  const colores = useMemo(() => ordenarUnicos(visitas.map((v) => v.color)), [visitas]);
  const meses = useMemo(() => {
    const unicos = [...new Set(visitas.map((v) => mesKey(v)).filter(Boolean))];
    return unicos.sort((a, b) => a.localeCompare(b)).map((key) => ({ key, label: mesLabel(key) }));
  }, [visitas]);

  const visitasFiltradas = useMemo(() => {
    const hi = fHoraIni === '' ? null : Number(fHoraIni);
    const hf = fHoraFin === '' ? null : Number(fHoraFin);
    const lo = hi != null && hf != null ? Math.min(hi, hf) : hi;
    const up = hi != null && hf != null ? Math.max(hi, hf) : hf;
    const estMin = fEstadiaMin === '' ? null : Number(fEstadiaMin);
    const estMax = fEstadiaMax === '' ? null : Number(fEstadiaMax);
    const estLo = estMin != null && estMax != null ? Math.min(estMin, estMax) : estMin;
    const estUp = estMin != null && estMax != null ? Math.max(estMin, estMax) : estMax;
    const placa = fPlaca.trim().toLowerCase();
    return visitas.filter((v) => {
      if (fTipoCliente !== 'Todos' && v.tipoCliente !== fTipoCliente) return false;
      if (fTipoVehiculo !== 'Todos' && v.tipoVehiculo !== fTipoVehiculo) return false;
      if (fMarca !== 'Todos' && v.marca !== fMarca) return false;
      if (fModelo !== 'Todos' && v.modelo !== fModelo) return false;
      if (fColor !== 'Todos' && v.color !== fColor) return false;
      if (fDiaSemana !== 'Todos' && String(v.diaSemana) !== fDiaSemana) return false;
      if (fMes !== 'Todos' && mesKey(v) !== fMes) return false;
      if (placa && !String(v.placa || '').toLowerCase().includes(placa)) return false;
      if (lo != null && v.hora < lo) return false;
      if (up != null && v.hora > up) return false;
      if (estLo != null && (v.estadiaMin == null || v.estadiaMin < estLo)) return false;
      if (estUp != null && (v.estadiaMin == null || v.estadiaMin > estUp)) return false;
      return true;
    });
  }, [
    visitas,
    fTipoCliente,
    fTipoVehiculo,
    fMarca,
    fModelo,
    fColor,
    fPlaca,
    fDiaSemana,
    fMes,
    fHoraIni,
    fHoraFin,
    fEstadiaMin,
    fEstadiaMax,
  ]);

  // Ranking de marcas.
  const ranking = useMemo(() => {
    const map = new Map();
    visitasFiltradas.forEach((v) => map.set(v.marca, (map.get(v.marca) || 0) + 1));
    const total = visitasFiltradas.length;
    return [...map.entries()]
      .map(([marca, n]) => ({
        marca,
        visitas: n,
        porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.visitas - a.visitas || a.marca.localeCompare(b.marca));
  }, [visitasFiltradas]);

  // Composición de marcas por franja temporal.
  const franjas = useMemo(() => {
    const buckets = new Map();
    visitasFiltradas.forEach((v) => {
      const { key, label, orden } = claveDe(agrupacion, v);
      if (!buckets.has(key)) buckets.set(key, { key, label, orden, total: 0, marcas: new Map() });
      const b = buckets.get(key);
      b.total += 1;
      b.marcas.set(v.marca, (b.marcas.get(v.marca) || 0) + 1);
    });
    return [...buckets.values()]
      .sort((a, b) => a.orden - b.orden)
      .map((b) => {
        let marcaLider = '—';
        let visitasLider = 0;
        b.marcas.forEach((n, m) => {
          if (n > visitasLider) {
            visitasLider = n;
            marcaLider = m;
          }
        });
        return {
          ...b,
          marcaLider,
          visitasLider,
          porcentaje: b.total ? Math.round((visitasLider / b.total) * 1000) / 10 : 0,
        };
      });
  }, [visitasFiltradas, agrupacion]);

  // Combinaciones marca + color.
  const marcaColor = useMemo(() => {
    const map = new Map();
    visitasFiltradas.forEach((v) => {
      const key = `${v.marca} · ${v.color}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const total = visitasFiltradas.length;
    return [...map.entries()]
      .map(([combo, n]) => ({
        combo,
        visitas: n,
        porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.visitas - a.visitas);
  }, [visitasFiltradas]);

  // Estadía promedio y hora pico por marca.
  const rankingModelos = useMemo(() => {
    const map = new Map();
    visitasFiltradas.forEach((v) => {
      const key = `${v.marca} - ${v.modelo}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const total = visitasFiltradas.length;
    return [...map.entries()]
      .map(([combo, n]) => ({
        combo,
        visitas: n,
        porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.visitas - a.visitas || a.combo.localeCompare(b.combo));
  }, [visitasFiltradas]);

  const statsMarca = useMemo(() => {
    const map = new Map();
    visitasFiltradas.forEach((v) => {
      if (!map.has(v.marca)) {
        map.set(v.marca, { marca: v.marca, visitas: 0, estSuma: 0, estCount: 0, horas: Array(24).fill(0) });
      }
      const s = map.get(v.marca);
      s.visitas += 1;
      s.horas[v.hora] += 1;
      if (v.estadiaMin != null) {
        s.estSuma += v.estadiaMin;
        s.estCount += 1;
      }
    });
    return [...map.values()]
      .map((s) => {
        let horaPico = 0;
        let visitasHoraPico = 0;
        s.horas.forEach((n, h) => {
          if (n > visitasHoraPico) {
            visitasHoraPico = n;
            horaPico = h;
          }
        });
        return {
          marca: s.marca,
          visitas: s.visitas,
          estadiaPromedio: s.estCount ? fmtDuracion(s.estSuma / s.estCount) : '—',
          horaPico: visitasHoraPico > 0 ? `${pad2(horaPico)}:00` : '—',
          visitasHoraPico,
        };
      })
      .sort((a, b) => b.visitas - a.visitas);
  }, [visitasFiltradas]);

  // Reparto por tipo de cliente.
  const porTipoCliente = useMemo(() => {
    const map = new Map();
    visitasFiltradas.forEach((v) => map.set(v.tipoCliente, (map.get(v.tipoCliente) || 0) + 1));
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [visitasFiltradas]);

  const porDia = useMemo(() => contarPor(visitasFiltradas, (v) => DIAS[v.diaSemana]), [visitasFiltradas]);
  const porMes = useMemo(() => contarPor(visitasFiltradas, (v) => mesLabel(mesKey(v))), [visitasFiltradas]);

  // Hora pico global.
  const horaPicoGlobal = useMemo(() => {
    const horas = Array(24).fill(0);
    visitasFiltradas.forEach((v) => {
      horas[v.hora] += 1;
    });
    let h = 0;
    let max = 0;
    horas.forEach((n, i) => {
      if (n > max) {
        max = n;
        h = i;
      }
    });
    return max > 0 ? `${pad2(h)}:00` : '—';
  }, [visitasFiltradas]);

  // ── Datasets de gráficas ──────────────────────────────────────────────────

  const horaPicoNumero = horaPicoGlobal && horaPicoGlobal !== '—' ? Number(horaPicoGlobal.slice(0, 2)) : null;
  const marcaHoraPico = useMemo(() => {
    if (horaPicoNumero == null) return null;
    const rows = visitasFiltradas.filter((v) => v.hora === horaPicoNumero);
    return contarPor(rows, (v) => v.marca)[0] || null;
  }, [visitasFiltradas, horaPicoNumero]);
  const franjaMasDominante = franjas.reduce((best, row) => {
    if (!best) return row;
    if (row.porcentaje > best.porcentaje) return row;
    if (row.porcentaje === best.porcentaje && row.total > best.total) return row;
    return best;
  }, null);
  const diaMasActivo = useMemo(() => contarPor(visitasFiltradas, (v) => String(v.diaSemana))[0] || null, [visitasFiltradas]);
  const mesMasActivo = useMemo(() => contarPor(visitasFiltradas, (v) => mesKey(v))[0] || null, [visitasFiltradas]);
  const detalleFiltrado = useMemo(
    () =>
      [...visitasFiltradas]
        .sort((a, b) => `${b.fecha} ${pad2(b.hora)}`.localeCompare(`${a.fecha} ${pad2(a.hora)}`))
        .slice(0, 80),
    [visitasFiltradas]
  );

  const filtrosAplicados = [
    fPlaca.trim() ? { key: 'placa', label: `Placa: ${fPlaca.trim()}`, clear: () => setFPlaca('') } : null,
    fTipoCliente !== 'Todos' ? { key: 'tipoCliente', label: `Cliente: ${fTipoCliente}`, clear: () => setFTipoCliente('Todos') } : null,
    fTipoVehiculo !== 'Todos' ? { key: 'tipoVehiculo', label: `Tipo: ${fTipoVehiculo}`, clear: () => setFTipoVehiculo('Todos') } : null,
    fMarca !== 'Todos' ? { key: 'marca', label: `Marca: ${fMarca}`, clear: () => setFMarca('Todos') } : null,
    fModelo !== 'Todos' ? { key: 'modelo', label: `Modelo: ${fModelo}`, clear: () => setFModelo('Todos') } : null,
    fColor !== 'Todos' ? { key: 'color', label: `Color: ${fColor}`, clear: () => setFColor('Todos') } : null,
    fDiaSemana !== 'Todos' ? { key: 'dia', label: `Dia: ${DIAS[Number(fDiaSemana)]}`, clear: () => setFDiaSemana('Todos') } : null,
    fMes !== 'Todos' ? { key: 'mes', label: `Mes: ${mesLabel(fMes)}`, clear: () => setFMes('Todos') } : null,
    fHoraIni !== '' || fHoraFin !== ''
      ? { key: 'hora', label: `Hora: ${fHoraIni || '00'}:00-${fHoraFin || '23'}:59`, clear: () => { setFHoraIni(''); setFHoraFin(''); } }
      : null,
    fEstadiaMin !== '' || fEstadiaMax !== ''
      ? { key: 'estadia', label: `Estadia: ${fEstadiaMin || '0'}-${fEstadiaMax || 'sin max'} min`, clear: () => { setFEstadiaMin(''); setFEstadiaMax(''); } }
      : null,
  ].filter(Boolean);

  const rankingTop = ranking.slice(0, 12);
  const rankingChart = {
    labels: rankingTop.map((r) => r.marca),
    datasets: [
      {
        label: 'Visitas',
        data: rankingTop.map((r) => r.visitas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 26,
        backgroundColor(ctx) {
          return createHorizontalGradient(ctx.chart, '#93c5fd', REPORT_PALETTE.blue);
        },
      },
    ],
  };

  const topMarcasFranja = ranking.slice(0, 6).map((r) => r.marca);
  const usaOtras = ranking.length > topMarcasFranja.length;
  const franjaDatasets = topMarcasFranja.map((marca, idx) => ({
    label: marca,
    data: franjas.map((b) => b.marcas.get(marca) || 0),
    backgroundColor: SERIE_COLORS[idx % SERIE_COLORS.length],
    borderRadius: 4,
    borderSkipped: false,
    maxBarThickness: 40,
  }));
  if (usaOtras) {
    franjaDatasets.push({
      label: 'Otras',
      data: franjas.map((b) => {
        let usadas = 0;
        topMarcasFranja.forEach((m) => {
          usadas += b.marcas.get(m) || 0;
        });
        return Math.max(0, b.total - usadas);
      }),
      backgroundColor: COLOR_OTRAS,
      borderRadius: 4,
      borderSkipped: false,
      maxBarThickness: 40,
    });
  }
  const franjaChart = { labels: franjas.map((b) => b.label), datasets: franjaDatasets };

  const marcaColorTop = marcaColor.slice(0, 12);
  const marcaColorChart = {
    labels: marcaColorTop.map((r) => r.combo),
    datasets: [
      {
        label: 'Visitas',
        data: marcaColorTop.map((r) => r.visitas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 24,
        backgroundColor(ctx) {
          return createHorizontalGradient(ctx.chart, '#c4b5fd', REPORT_PALETTE.violet);
        },
      },
    ],
  };

  const modelosTop = rankingModelos.slice(0, 12);
  const modelosChart = {
    labels: modelosTop.map((r) => r.combo),
    datasets: [
      {
        label: 'Visitas',
        data: modelosTop.map((r) => r.visitas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 24,
        backgroundColor(ctx) {
          return createHorizontalGradient(ctx.chart, '#6ee7b7', REPORT_PALETTE.teal);
        },
      },
    ],
  };

  const tipoClienteColors = [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber, REPORT_PALETTE.rose];
  const tipoClienteChart = {
    labels: porTipoCliente.map((x) => x.label),
    datasets: [
      {
        data: porTipoCliente.map((x) => x.value),
        backgroundColor: porTipoCliente.map((_, i) => tipoClienteColors[i % tipoClienteColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const agrupacionLabel =
    agrupacion === 'dia' ? 'día de la semana' : agrupacion === 'mes' ? 'mes' : 'hora del día';
  const hayDatos = Boolean(raw) && visitas.length > 0;
  const hayFiltradas = visitasFiltradas.length > 0;
  const filtrosActivos =
    fTipoCliente !== 'Todos' ||
    fTipoVehiculo !== 'Todos' ||
    fMarca !== 'Todos' ||
    fModelo !== 'Todos' ||
    fColor !== 'Todos' ||
    fPlaca.trim() !== '' ||
    fDiaSemana !== 'Todos' ||
    fMes !== 'Todos' ||
    fHoraIni !== '' ||
    fHoraFin !== '' ||
    fEstadiaMin !== '' ||
    fEstadiaMax !== '';

  return (
    <>
      <ReportDetailNav
        eyebrow="Reportes"
        title="Analisis de marcas"
        backLabel="Volver a reportes"
        onBack={onBackToReports}
      />
      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">Análisis de marcas y franjas</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '-0.35rem' }}>
          Descubre qué marca de vehículo ingresa más según la hora, el día de la semana o el mes, y cruza los
          datos con tipo de cliente, tipo de vehículo y color. Todos los filtros se aplican al instante.
        </p>
        <form className="reporte-inc-form" onSubmit={generar}>
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={exportarPdf}
              disabled={loading || !hayDatos}
            >
              Exportar PDF
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="admin-banner admin-banner--error" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {raw && visitas.length === 0 && !error && (
        <p className="reporte-inc-empty">No hay entradas registradas en el rango seleccionado.</p>
      )}

      {hayDatos && (
        <>
          <section className="reporte-inc-card" style={{ marginTop: '1rem' }}>
            <div className="reporte-table-toolbar">
              <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Filtros cruzados</h3>
              <div className="reporte-table-toolbar__controls">
                <input
                  type="text"
                  value={fPlaca}
                  onChange={(e) => setFPlaca(e.target.value)}
                  className="reporte-table-input"
                  placeholder="Buscar placa..."
                />
                <select
                  value={fTipoCliente}
                  onChange={(e) => setFTipoCliente(e.target.value)}
                  className="reporte-table-input"
                >
                  <option value="Todos">Todos los clientes</option>
                  {tiposCliente.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={fTipoVehiculo}
                  onChange={(e) => setFTipoVehiculo(e.target.value)}
                  className="reporte-table-input"
                >
                  <option value="Todos">Todos los tipos de vehículo</option>
                  {tiposVehiculo.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select value={fMarca} onChange={(e) => setFMarca(e.target.value)} className="reporte-table-input">
                  <option value="Todos">Todas las marcas</option>
                  {marcas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={fModelo} onChange={(e) => setFModelo(e.target.value)} className="reporte-table-input">
                  <option value="Todos">Todos los modelos</option>
                  {modelos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={fColor} onChange={(e) => setFColor(e.target.value)} className="reporte-table-input">
                  <option value="Todos">Todos los colores</option>
                  {colores.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={fDiaSemana} onChange={(e) => setFDiaSemana(e.target.value)} className="reporte-table-input">
                  <option value="Todos">Todos los dias</option>
                  {DIAS.map((d, idx) => (
                    <option key={d} value={String(idx)}>{d}</option>
                  ))}
                </select>
                <select value={fMes} onChange={(e) => setFMes(e.target.value)} className="reporte-table-input">
                  <option value="Todos">Todos los meses</option>
                  {meses.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <select value={fHoraIni} onChange={(e) => setFHoraIni(e.target.value)} className="reporte-table-input">
                  <option value="">Hora desde</option>
                  {HORAS.map((h) => (
                    <option key={h} value={h}>{pad2(h)}:00</option>
                  ))}
                </select>
                <select value={fHoraFin} onChange={(e) => setFHoraFin(e.target.value)} className="reporte-table-input">
                  <option value="">Hora hasta</option>
                  {HORAS.map((h) => (
                    <option key={h} value={h}>{pad2(h)}:59</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={fEstadiaMin}
                  onChange={(e) => setFEstadiaMin(e.target.value)}
                  className="reporte-table-input reporte-table-input--short"
                  placeholder="Estadia min"
                />
                <input
                  type="number"
                  min="0"
                  value={fEstadiaMax}
                  onChange={(e) => setFEstadiaMax(e.target.value)}
                  className="reporte-table-input reporte-table-input--short"
                  placeholder="Estadia max"
                />
                {filtrosActivos && (
                  <button type="button" className="admin-btn-ghost" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
            {filtrosAplicados.length > 0 ? (
              <div className="reporte-filter-chips" aria-label="Filtros activos">
                {filtrosAplicados.map((filtro) => (
                  <button key={filtro.key} type="button" className="reporte-filter-chip" onClick={filtro.clear}>
                    {filtro.label} x
                  </button>
                ))}
              </div>
            ) : (
              <p className="reporte-filter-empty">Sin filtros activos. Combina placa, marca, modelo, dia, mes, hora y estadia.</p>
            )}
          </section>

          <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
            <article className="admin-kpi admin-kpi--spaces">
              <div className="admin-kpi-label">Visitas analizadas</div>
              <div className="admin-kpi-value">{formatNumber(visitasFiltradas.length)}</div>
              <div className="admin-kpi-hint">de {formatNumber(visitas.length)} en el período</div>
            </article>
            <article className="admin-kpi admin-kpi--alerts">
              <div className="admin-kpi-label">Marca líder</div>
              <div className="admin-kpi-value" style={{ fontSize: '1.2rem' }}>{ranking[0]?.marca || '—'}</div>
              <div className="admin-kpi-hint">
                {ranking[0] ? `${formatNumber(ranking[0].visitas)} visitas · ${ranking[0].porcentaje}%` : '—'}
              </div>
            </article>
            <article className="admin-kpi admin-kpi--alerts2">
              <div className="admin-kpi-label">Combinación líder</div>
              <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>{marcaColor[0]?.combo || '—'}</div>
              <div className="admin-kpi-hint">
                {marcaColor[0] ? `${formatNumber(marcaColor[0].visitas)} visitas` : '—'}
              </div>
            </article>
            <article className="admin-kpi admin-kpi--spaces">
              <div className="admin-kpi-label">Hora pico global</div>
              <div className="admin-kpi-value">{horaPicoGlobal}</div>
            </article>
          </div>

          {hayFiltradas ? (
            <section className="reporte-question-grid" aria-label="Preguntas rapidas del reporte">
              <button
                type="button"
                className="reporte-question-card"
                onClick={() => {
                  if (horaPicoNumero != null) {
                    setFHoraIni(String(horaPicoNumero));
                    setFHoraFin(String(horaPicoNumero));
                  }
                }}
                disabled={horaPicoNumero == null}
              >
                <span>Marca con mas entradas en hora pico</span>
                <strong>{marcaHoraPico ? `${marcaHoraPico.label} - ${formatNumber(marcaHoraPico.value)}` : 'Sin datos'} en {horaPicoGlobal}</strong>
              </button>
              <button
                type="button"
                className="reporte-question-card"
                onClick={() => {
                  if (diaMasActivo) setFDiaSemana(String(diaMasActivo.label));
                }}
                disabled={!diaMasActivo}
              >
                <span>Dia con mas movimiento</span>
                <strong>{diaMasActivo ? `${DIAS[Number(diaMasActivo.label)]} - ${formatNumber(diaMasActivo.value)} visitas` : 'Sin datos'}</strong>
              </button>
              <button
                type="button"
                className="reporte-question-card"
                onClick={() => {
                  if (mesMasActivo) setFMes(String(mesMasActivo.label));
                }}
                disabled={!mesMasActivo}
              >
                <span>Mes que concentra mas ingresos</span>
                <strong>{mesMasActivo ? `${mesLabel(mesMasActivo.label)} - ${formatNumber(mesMasActivo.value)}` : 'Sin datos'}</strong>
              </button>
              <button
                type="button"
                className="reporte-question-card"
                onClick={() => setAgrupacion('dia')}
                disabled={!franjaMasDominante}
              >
                <span>Franja con dominio mas claro</span>
                <strong>{franjaMasDominante ? `${franjaMasDominante.label}: ${franjaMasDominante.marcaLider}` : 'Sin datos'}</strong>
              </button>
            </section>
          ) : null}

          {!hayFiltradas && (
            <p className="reporte-inc-empty">Ningún registro coincide con los filtros seleccionados.</p>
          )}

          {hayFiltradas && (
            <>
              <div className="reporte-chart-grid">
                <ReportChartCard
                  title="Ranking de marcas"
                  description="Marcas con más entradas al parqueo. Haz clic en una barra para filtrar todo por esa marca."
                  insights={[
                    { label: 'Marca líder', value: ranking[0]?.marca || '—' },
                    { label: 'Marcas distintas', value: formatNumber(ranking.length) },
                  ]}
                >
                  <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                    <Bar
                      data={rankingChart}
                      options={buildCartesianOptions({
                        indexAxis: 'y',
                        showLegend: false,
                        maxTicksLimit: 12,
                        onClick: (_, elements, chart) => {
                          if (!elements?.length) return;
                          const label = chart.data.labels[elements[0].index];
                          if (label) setFMarca((prev) => (prev === label ? 'Todos' : String(label)));
                        },
                      })}
                    />
                  </div>
                </ReportChartCard>

                <ReportChartCard
                  title="Reparto por tipo de cliente"
                  description="Cómo se divide la afluencia filtrada entre clientes esporádicos y mensuales."
                >
                  <div className="reporte-chart-split">
                    <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                      <Doughnut data={tipoClienteChart} options={buildDoughnutOptions({})} />
                    </div>
                    <ReportLegend
                      items={buildLegendItems(
                        tipoClienteChart.labels,
                        tipoClienteChart.datasets[0].data,
                        tipoClienteChart.datasets[0].backgroundColor
                      )}
                    />
                  </div>
                </ReportChartCard>
              </div>

              <ReportChartCard
                title={`Marca líder por ${agrupacionLabel}`}
                description="Cada columna muestra la composición de marcas en esa franja; el segmento más alto es la marca dominante."
                insights={[
                  { label: 'Dia con mas visitas', value: porDia[0] ? `${porDia[0].label} (${formatNumber(porDia[0].value)})` : '—' },
                  { label: 'Mes con mas visitas', value: porMes[0] ? `${porMes[0].label} (${formatNumber(porMes[0].value)})` : '—' },
                ]}
                actions={
                  <select
                    value={agrupacion}
                    onChange={(e) => setAgrupacion(e.target.value)}
                    className="reporte-table-input"
                  >
                    <option value="hora">Por hora del día</option>
                    <option value="dia">Por día de la semana</option>
                    <option value="mes">Por mes</option>
                  </select>
                }
              >
                <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                  <Bar
                    data={franjaChart}
                    options={buildCartesianOptions({
                      stacked: true,
                      maxTicksLimit: 24,
                      legendPosition: 'bottom',
                    })}
                  />
                </div>
              </ReportChartCard>

              <ReportChartCard
                title="Top modelos por marca"
                description="Combinaciones marca-modelo con mas entradas dentro del filtro actual."
                insights={[
                  { label: 'Modelo lider', value: rankingModelos[0]?.combo || '—' },
                  { label: 'Modelos distintos', value: formatNumber(rankingModelos.length) },
                ]}
              >
                <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                  <Bar
                    data={modelosChart}
                    options={buildCartesianOptions({ indexAxis: 'y', showLegend: false, maxTicksLimit: 12 })}
                  />
                </div>
              </ReportChartCard>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>
                    Detalle de marca líder por {agrupacionLabel}
                  </h3>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Franja</th>
                        <th>Marca líder</th>
                        <th>Visitas de la marca</th>
                        <th>Total de la franja</th>
                        <th>% de dominio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {franjas.map((b) => (
                        <tr key={b.key}>
                          <td>{b.label}</td>
                          <td>{b.marcaLider}</td>
                          <td>{b.visitasLider}</td>
                          <td>{b.total}</td>
                          <td>{b.porcentaje}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ReportChartCard
                title="Top combinaciones marca + color"
                description="Las combinaciones de marca y color más frecuentes entre los vehículos que ingresan."
                insights={[
                  { label: 'Combinación líder', value: marcaColor[0]?.combo || '—' },
                  { label: 'Combinaciones distintas', value: formatNumber(marcaColor.length) },
                ]}
              >
                <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                  <Bar
                    data={marcaColorChart}
                    options={buildCartesianOptions({ indexAxis: 'y', showLegend: false, maxTicksLimit: 12 })}
                  />
                </div>
              </ReportChartCard>

              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>
                    Estadía promedio y hora pico por marca
                  </h3>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Marca</th>
                        <th>Visitas</th>
                        <th>Estadía promedio</th>
                        <th>Hora pico</th>
                        <th>Visitas en la hora pico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsMarca.map((r) => (
                        <tr key={r.marca}>
                          <td>{r.marca}</td>
                          <td>{r.visitas}</td>
                          <td>{r.estadiaPromedio}</td>
                          <td>{r.horaPico}</td>
                          <td>{r.visitasHoraPico}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="reporte-inc-table-wrap">
                <div className="reporte-table-toolbar">
                  <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>
                    Muestra filtrada de entradas
                  </h3>
                  <span className="reporte-filter-empty">Mostrando hasta 80 registros recientes del filtro actual</span>
                </div>
                <div className="crudx-table-scroll">
                  <table className="crudx-table reporte-inc-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Placa</th>
                        <th>Marca / modelo</th>
                        <th>Color</th>
                        <th>Tipo vehiculo</th>
                        <th>Cliente</th>
                        <th>Estadia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleFiltrado.map((v, index) => (
                        <tr key={`${v.placa}-${v.fecha}-${v.hora}-${index}`}>
                          <td>{v.fecha}</td>
                          <td>{pad2(v.hora)}:00</td>
                          <td>{v.placa}</td>
                          <td>{v.marca} / {v.modelo}</td>
                          <td>{v.color}</td>
                          <td>{v.tipoVehiculo}</td>
                          <td>{v.tipoCliente}</td>
                          <td>{v.estadiaMin == null ? 'Sin salida' : fmtDuracion(v.estadiaMin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!raw && !loading && !error && (
        <p className="reporte-inc-empty">
          Selecciona un rango de fechas y presiona «Generar reporte» para comenzar el análisis.
        </p>
      )}
    </>
  );
}
