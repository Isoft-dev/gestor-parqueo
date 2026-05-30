import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_BASE } from '../config.js';
import ReportesOperativosMaquinasSection from './ReportesOperativosMaquinasSection.jsx';
import ReportesFinancierosSection from './ReportesFinancierosSection.jsx';
import ReportesMembresiasClientesSection from './ReportesMembresiasClientesSection.jsx';
import ReportesAfluenciaSection from './ReportesAfluenciaSection.jsx';
import ReportesPerfilFlotaSection from './ReportesPerfilFlotaSection.jsx';
import ReportesAnalisisFlotaSection from './ReportesAnalisisFlotaSection.jsx';
import HelpHint from '../components/HelpHint.jsx';
import { ReportCardMenu, ReportDetailNav } from './ReportCardMenu.jsx';
import {
  REPORT_PALETTE,
  buildCartesianOptions,
  buildDoughnutOptions,
  buildLegendItems,
  createCenterTextPlugin,
  createHorizontalGradient,
  createVerticalGradient,
  formatNumber,
  clickedLabel,
} from './reportChartUtils.js';
import { ReportChartCard, ReportLegend } from './ReportChartPrimitives.jsx';
import { descargarExcel, hojaResumen } from './reportExcelUtils.js';
import { ReportFilterProvider, useReportFilter } from './ReportFilterContext.jsx';
import GlobalSlicerBar from './GlobalSlicerBar.jsx';
import ReportesDashboard from './ReportesDashboard.jsx';
import SavedViews from './SavedViews.jsx';

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 29);
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


function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HORAS_DIA = Array.from({ length: 24 }, (_, i) => i);
const REPORT_SECTION_CARDS = [
  { id: 'movimiento', badge: 'MOV', eyebrow: 'Flujo vehicular', label: 'Movimiento vehicular', summary: 'Frecuencia de visitas, entradas, salidas y estadia por rangos de fecha.', traits: ['Fechas', 'Placa', 'Horas'], icon: 'car', tone: 'ocean' },
  { id: 'operativos', badge: 'OPS', eyebrow: 'Maquinas', label: 'Reportes operativos', summary: 'Alertas, mantenimientos, recargas e incidentes por maquina o estado.', traits: ['Maquina', 'Estado', 'Tipo'], icon: 'machine', tone: 'steel' },
  { id: 'financieros', badge: 'FIN', eyebrow: 'Ingresos', label: 'Reportes financieros', summary: 'Cobros, pagos de membresia e ingresos por tipo de cliente.', traits: ['Rango', 'Metodo', 'PDF'], icon: 'money', tone: 'mint' },
  { id: 'membresias_clientes', badge: 'MEM', eyebrow: 'Clientes', label: 'Membresias y clientes', summary: 'Mora, estados de membresia e historial de pagos por cliente.', traits: ['Mora', 'Estado', 'Cliente'], icon: 'users', tone: 'sunset' },
  { id: 'afluencia', badge: 'AFL', eyebrow: 'Demanda', label: 'Afluencia', summary: 'Volumen de visitas por hora, dia, semana, mes o resumen anual.', traits: ['Hora', 'Dia', 'Anual'], icon: 'calendar', tone: 'ocean' },
  { id: 'perfil_flota', badge: 'PER', eyebrow: 'Perfil', label: 'Perfil de flota', summary: 'Mapa de calor y distribucion geografica para entender patrones de uso.', traits: ['Heatmap', 'Geografia', 'Clientes'], icon: 'map', tone: 'mint' },
  { id: 'analisis_flota', badge: 'MAR', eyebrow: 'Marcas', label: 'Analisis de marcas', summary: 'Marcas, modelos, colores y horarios con filtros cruzados.', traits: ['Marca', 'Modelo', 'Hora'], icon: 'brand', tone: 'sunset' },
];

const MOVEMENT_REPORT_CARDS = [
  { id: 'frecuencia', badge: 'TOP', eyebrow: 'Visitas', label: 'Vehiculos frecuentes', summary: 'Identifica las placas con mas visitas y filtra por tipo, marca, color o fecha.', traits: ['Placa', 'Marca', 'Color'], icon: 'car', tone: 'ocean' },
  { id: 'entradas_salidas', badge: 'E/S', eyebrow: 'Flujo', label: 'Entradas y salidas', summary: 'Compara volumen de ingresos y egresos por dia u hora dentro del rango.', traits: ['Dia', 'Hora', 'Tipo'], icon: 'clock', tone: 'mint' },
  { id: 'tiempo_estadia', badge: 'TMP', eyebrow: 'Estadia', label: 'Tiempo promedio', summary: 'Revisa permanencia promedio y detecta vehiculos o tipos con mayor estadia.', traits: ['Promedio', 'Placa', 'Dia'], icon: 'chart', tone: 'sunset' },
];

function ReportesPageContent() {
  const [seccion, setSeccion] = useState('');
  const { filtros, setFiltro, limpiarDimensiones } = useReportFilter();
  const desde = filtros.desde;
  const hasta = filtros.hasta;
  const [tabMov, setTabMov] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataByTab, setDataByTab] = useState({
    frecuencia: null,
    entradas_salidas: null,
    tiempo_estadia: null,
  });

  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('Todos');
  const [filtroColor, setFiltroColor] = useState('Todos');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroFechaFlujo, setFiltroFechaFlujo] = useState('');
  const [filtroHoraIni, setFiltroHoraIni] = useState('');
  const [filtroHoraFin, setFiltroHoraFin] = useState('');
  const [filtroDiaSemana, setFiltroDiaSemana] = useState('Todos');

  const data = dataByTab[tabMov];

  useEffect(() => {
    setError('');
    setDataByTab({
      frecuencia: null,
      entradas_salidas: null,
      tiempo_estadia: null,
    });
    setFiltroPlaca('');
    setFiltroMarca('Todos');
    setFiltroColor('Todos');
    setFiltroDia('');
    setFiltroFechaFlujo('');
    setFiltroHoraIni('');
    setFiltroHoraFin('');
    setFiltroDiaSemana('Todos');
    limpiarDimensiones();
  }, [tabMov, seccion]);

  const generar = async () => {
    setError('');
    setLoading(true);
    setDataByTab((prev) => ({ ...prev, [tabMov]: null }));
    try {
      const extras = {};
      if (filtros.tipoVehiculo !== 'Todos') extras.tipoVehiculo = filtros.tipoVehiculo;
      if (filtros.tipoCliente  !== 'Todos') extras.tipoCliente  = filtros.tipoCliente;
      const q = new URLSearchParams({ desde, hasta, ...extras });
      const pathByTab = {
        frecuencia: '/reportes/movimiento-vehicular/frecuencia',
        entradas_salidas: '/reportes/movimiento-vehicular/entradas-salidas',
        tiempo_estadia: '/reportes/movimiento-vehicular/tiempo-estadia',
      };
      const res = await fetch(`${API_BASE}${pathByTab[tabMov]}?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setDataByTab((prev) => ({ ...prev, [tabMov]: json }));
    } catch (e) {
      setError(e.message || 'No se pudo obtener el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportarPdf = () => {
    const extras = {};
    if (filtros.tipoVehiculo !== 'Todos') extras.tipoVehiculo = filtros.tipoVehiculo;
    if (filtros.tipoCliente  !== 'Todos') extras.tipoCliente  = filtros.tipoCliente;
    const q = new URLSearchParams({ desde, hasta, ...extras });
    const pathByTab = {
      frecuencia: '/reportes/movimiento-vehicular/frecuencia/pdf',
      entradas_salidas: '/reportes/movimiento-vehicular/entradas-salidas/pdf',
      tiempo_estadia: '/reportes/movimiento-vehicular/tiempo-estadia/pdf',
    };
    window.open(`${API_BASE}${pathByTab[tabMov]}?${q}`, '_blank', 'noopener,noreferrer');
  };

  const exportarExcel = async () => {
    if (!data) return;
    setError('');
    try {
      const rango = `${desde} a ${hasta}`;
      if (tabMov === 'frecuencia') {
        const columnas = [
          { key: 'placa', header: 'Placa' },
          { key: 'marca', header: 'Marca' },
          { key: 'modelo', header: 'Modelo' },
          { key: 'tipoVehiculo', header: 'Tipo de vehículo' },
          { key: 'color', header: 'Color' },
          { key: 'tipoCliente', header: 'Tipo de cliente' },
          { key: 'visitas', header: 'Visitas' },
        ];
        await descargarExcel({
          nombreArchivo: `reporte-vehiculos-frecuencia-${desde}-${hasta}`,
          hojas: [
            hojaResumen('Resumen', [
              { etiqueta: 'Reporte', valor: 'Vehículos más frecuentes' },
              { etiqueta: 'Rango de fechas', valor: rango },
              { etiqueta: 'Vehículos en el rango', valor: data.totalVehiculos ?? 0 },
            ]),
            { nombre: 'Top 10', filas: Array.isArray(data.top10) ? data.top10 : [], columnas },
            { nombre: 'Detalle', filas: Array.isArray(data.detalle) ? data.detalle : [], columnas },
          ],
        });
      } else if (tabMov === 'entradas_salidas') {
        await descargarExcel({
          nombreArchivo: `reporte-entradas-salidas-${desde}-${hasta}`,
          hojas: [
            hojaResumen('Resumen', [
              { etiqueta: 'Reporte', valor: 'Entradas y salidas' },
              { etiqueta: 'Rango de fechas', valor: rango },
              { etiqueta: 'Total entradas', valor: data.totalEntradas ?? 0 },
              { etiqueta: 'Total salidas', valor: data.totalSalidas ?? 0 },
              { etiqueta: 'Total registros', valor: data.totalRegistros ?? 0 },
            ]),
            {
              nombre: 'Detalle',
              filas: Array.isArray(data.detalle) ? data.detalle : [],
              columnas: [
                { key: 'tipoCliente', header: 'Tipo de cliente' },
                { key: 'referencia', header: 'Referencia' },
                { key: 'placa', header: 'Placa' },
                { key: 'tipoVehiculo', header: 'Tipo de vehículo' },
                { key: 'horaEntrada', header: 'Hora de entrada' },
                { key: 'horaSalida', header: 'Hora de salida' },
                { key: 'tiempoEstadia', header: 'Tiempo de estadía' },
                { key: 'estadoTicket', header: 'Estado' },
              ],
            },
          ],
        });
      } else if (tabMov === 'tiempo_estadia') {
        const hojas = [
          hojaResumen('Resumen', [
            { etiqueta: 'Reporte', valor: 'Tiempo promedio de estadía' },
            { etiqueta: 'Rango de fechas', valor: rango },
            { etiqueta: 'Promedio general', valor: data.promedioGeneral?.etiqueta ?? '—' },
            { etiqueta: 'Máximo', valor: data.maximo?.etiqueta ?? '—' },
            { etiqueta: 'Mínimo', valor: data.minimo?.etiqueta ?? '—' },
            { etiqueta: 'Total registros', valor: data.totalRegistros ?? 0 },
          ]),
          {
            nombre: 'Por día de la semana',
            filas: Array.isArray(data.promedioPorDiaSemana) ? data.promedioPorDiaSemana : [],
            columnas: [
              { key: 'diaSemana', header: 'Día' },
              { key: 'promedioEtiqueta', header: 'Promedio' },
              { key: 'promedioMinutos', header: 'Promedio (min)' },
              { key: 'cantidadRegistros', header: 'Registros' },
            ],
          },
        ];
        if (Array.isArray(data.promedioPorTipoVehiculo) && data.promedioPorTipoVehiculo.length) {
          hojas.push({
            nombre: 'Por tipo de vehículo',
            filas: data.promedioPorTipoVehiculo,
            columnas: [
              { key: 'tipo', header: 'Tipo de vehículo' },
              { key: 'promedioEtiqueta', header: 'Promedio' },
              { key: 'cantidadRegistros', header: 'Registros' },
            ],
          });
        }
        await descargarExcel({
          nombreArchivo: `reporte-tiempo-estadia-${desde}-${hasta}`,
          hojas,
        });
      }
    } catch (e) {
      setError(e.message || 'No se pudo exportar a Excel.');
    }
  };

  const topFrecuencia = useMemo(() => (Array.isArray(data?.top10) ? data.top10 : []), [data]);
  const detalleFrecuencia = useMemo(() => (Array.isArray(data?.detalle) ? data.detalle : []), [data]);
  const distribucionFrecuencia = useMemo(() => {
    const byTipo = new Map();
    detalleFrecuencia.forEach((row) => {
      const key = row.tipoCliente || 'Sin clasificar';
      byTipo.set(key, (byTipo.get(key) || 0) + 1);
    });
    return [...byTipo.entries()].map(([label, value]) => ({ label, value }));
  }, [detalleFrecuencia]);

  const tiposVehiculoFrecuencia = useMemo(() => {
    const s = new Set(detalleFrecuencia.map((r) => r.tipoVehiculo).filter(Boolean));
    return [...s].sort();
  }, [detalleFrecuencia]);
  const marcasFrecuencia = useMemo(() => {
    const s = new Set(detalleFrecuencia.map((r) => r.marca).filter(Boolean));
    return [...s].sort();
  }, [detalleFrecuencia]);
  const coloresFrecuencia = useMemo(() => {
    const s = new Set(detalleFrecuencia.map((r) => r.color).filter((c) => c && c !== '—'));
    return [...s].sort();
  }, [detalleFrecuencia]);
  const filasFrecuencia = detalleFrecuencia.filter((row) => {
    const matchPlaca = row.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
    const matchTipo = filtros.tipoCliente === 'Todos' || row.tipoCliente === filtros.tipoCliente;
    const matchTipoV = filtros.tipoVehiculo === 'Todos' || row.tipoVehiculo === filtros.tipoVehiculo;
    const matchMarca = filtroMarca === 'Todos' || row.marca === filtroMarca;
    const matchColor = filtroColor === 'Todos' || row.color === filtroColor;
    return matchPlaca && matchTipo && matchTipoV && matchMarca && matchColor;
  });

  const frecuenciaBarData = {
    labels: topFrecuencia.map((row) => row.placa),
    datasets: [
      {
        label: 'Visitas',
        data: topFrecuencia.map((row) => Number(row.visitas || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 24,
        backgroundColor(context) {
          return createHorizontalGradient(
            context.chart,
            '#93c5fd',
            REPORT_PALETTE.blue
          );
        },
      },
    ],
  };

  const frecuenciaPieColors = [REPORT_PALETTE.blue, REPORT_PALETTE.teal, REPORT_PALETTE.amber, REPORT_PALETTE.violet];
  const frecuenciaPieData = {
    labels: distribucionFrecuencia.map((item) => item.label),
    datasets: [
      {
        data: distribucionFrecuencia.map((item) => item.value),
        backgroundColor: distribucionFrecuencia.map((_, index) => frecuenciaPieColors[index % frecuenciaPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const frecuenciaPiePlugins = [
    createCenterTextPlugin([
      { text: formatNumber(detalleFrecuencia.length), color: '#0f172a' },
      { text: 'vehiculos', color: '#64748b' },
    ]),
  ];

  const flujoPorDia = useMemo(() => {
    const rows = Array.isArray(data?.detalle) ? data.detalle : [];
    const byDay = new Map();
    rows.forEach((row) => {
      const entrada = dateOnly(row.horaEntrada);
      const salida = dateOnly(row.horaSalida);
      if (entrada) {
        const current = byDay.get(entrada) || { label: entrada, entradas: 0, salidas: 0 };
        current.entradas += 1;
        byDay.set(entrada, current);
      }
      if (salida) {
        const current = byDay.get(salida) || { label: salida, entradas: 0, salidas: 0 };
        current.salidas += 1;
        byDay.set(salida, current);
      }
    });
    return [...byDay.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const flujoTipoCliente = useMemo(() => {
    const rows = Array.isArray(data?.detalle) ? data.detalle : [];
    const byTipo = new Map();
    rows.forEach((row) => {
      const key = row.tipoCliente || 'Sin clasificar';
      byTipo.set(key, (byTipo.get(key) || 0) + 1);
    });
    return [...byTipo.entries()].map(([label, value]) => ({ label, value }));
  }, [data]);

  const flujoBarData = {
    labels: flujoPorDia.map((row) => row.label),
    datasets: [
      {
        label: 'Entradas',
        data: flujoPorDia.map((row) => row.entradas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#7dd3fc', REPORT_PALETTE.blue);
        },
      },
      {
        label: 'Salidas',
        data: flujoPorDia.map((row) => row.salidas),
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 28,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#86efac', REPORT_PALETTE.green);
        },
      },
    ],
  };

  const flujoPieColors = [REPORT_PALETTE.blue, REPORT_PALETTE.green, REPORT_PALETTE.amber];
  const flujoPieData = {
    labels: flujoTipoCliente.map((item) => item.label),
    datasets: [
      {
        data: flujoTipoCliente.map((item) => item.value),
        backgroundColor: flujoTipoCliente.map((_, index) => flujoPieColors[index % flujoPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const tiposVehiculoFlujo = useMemo(() => {
    const rows = Array.isArray(data?.detalle) ? data.detalle : [];
    const s = new Set(rows.map((r) => r.tipoVehiculo).filter(Boolean));
    return [...s].sort();
  }, [data]);
  const flujoHoraLo =
    filtroHoraIni !== '' && filtroHoraFin !== ''
      ? Math.min(Number(filtroHoraIni), Number(filtroHoraFin))
      : filtroHoraIni !== ''
        ? Number(filtroHoraIni)
        : null;
  const flujoHoraHi =
    filtroHoraIni !== '' && filtroHoraFin !== ''
      ? Math.max(Number(filtroHoraIni), Number(filtroHoraFin))
      : filtroHoraFin !== ''
        ? Number(filtroHoraFin)
        : null;
  const filasFlujo = (Array.isArray(data?.detalle) ? data.detalle : []).filter((row) => {
    const matchPlaca = row.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
    const matchTipo = filtros.tipoCliente === 'Todos' || row.tipoCliente === filtros.tipoCliente;
    const matchTipoV = filtros.tipoVehiculo === 'Todos' || row.tipoVehiculo === filtros.tipoVehiculo;
    const matchFecha =
      !filtroFechaFlujo ||
      dateOnly(row.horaEntrada) === filtroFechaFlujo ||
      dateOnly(row.horaSalida) === filtroFechaFlujo;
    const entradaDate = row.horaEntrada ? new Date(row.horaEntrada) : null;
    const entradaValida = Boolean(entradaDate) && !Number.isNaN(entradaDate.getTime());
    const horaEntrada = entradaValida ? entradaDate.getHours() : null;
    const matchHora =
      horaEntrada == null ||
      ((flujoHoraLo == null || horaEntrada >= flujoHoraLo) &&
        (flujoHoraHi == null || horaEntrada <= flujoHoraHi));
    const matchDiaSemana =
      filtroDiaSemana === 'Todos' ||
      (entradaValida && DIAS_SEMANA[entradaDate.getDay()] === filtroDiaSemana);
    return matchPlaca && matchTipo && matchTipoV && matchFecha && matchHora && matchDiaSemana;
  });

  const tiempoRows = Array.isArray(data?.promedioPorDiaSemana) ? data.promedioPorDiaSemana : [];
  const tiempoTotales = tiempoRows.reduce((sum, row) => sum + Number(row.cantidadRegistros || 0), 0);
  const tiempoPieColors = [
    REPORT_PALETTE.blue,
    REPORT_PALETTE.cyan,
    REPORT_PALETTE.teal,
    REPORT_PALETTE.green,
    REPORT_PALETTE.amber,
    REPORT_PALETTE.orange,
    REPORT_PALETTE.violet,
  ];

  const tiempoPieData = {
    labels: tiempoRows.map((row) => row.diaSemana),
    datasets: [
      {
        data: tiempoRows.map((row) => Number(row.cantidadRegistros || 0)),
        backgroundColor: tiempoRows.map((_, index) => tiempoPieColors[index % tiempoPieColors.length]),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const tiempoBarData = {
    labels: tiempoRows.map((row) => row.diaSemana),
    datasets: [
      {
        label: 'Promedio (min)',
        data: tiempoRows.map((row) => Number(row.promedioMinutos || 0)),
        borderRadius: 12,
        borderSkipped: false,
        maxBarThickness: 34,
        backgroundColor(context) {
          return createVerticalGradient(context.chart, '#c4b5fd', REPORT_PALETTE.violet);
        },
      },
    ],
  };

  const filasTiempo = tiempoRows.filter((row) => !filtroDia || row.diaSemana === filtroDia);
  const diaMasCargado = tiempoRows.reduce(
    (best, row) => (Number(row.cantidadRegistros || 0) > Number(best?.cantidadRegistros || 0) ? row : best),
    null
  );

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-header__title-main">
          <h1 className="admin-page-title">Reportes</h1>
          <HelpHint label="Mostrar ayuda de reportes" title="Guia de reportes">
            <p>
              Este modulo concentra paneles visuales, filtros cruzados y graficas interactivas para
              cada seccion activa.
            </p>
            <p>Usa las pestanas superiores para cambiar entre movimiento, operacion, finanzas y afluencia.</p>
          </HelpHint>
        </div>
      </header>

      <GlobalSlicerBar onGenerar={seccion === 'movimiento' && tabMov ? generar : undefined} loading={loading} seccion={seccion} />

      <SavedViews />

      <ReportesDashboard />

      {!seccion ? (
        <ReportCardMenu
          ariaLabel="Secciones de reportes"
          items={REPORT_SECTION_CARDS}
          onSelect={(id) => {
            setSeccion(id);
            setTabMov('');
          }}
        />
      ) : null}

      {seccion === 'movimiento' ? (
        <>
          <ReportDetailNav
            eyebrow="Reportes"
            title="Movimiento vehicular"
            backLabel="Volver a reportes"
            onBack={() => {
              setSeccion('');
              setTabMov('');
            }}
          />
          <ReportCardMenu
            ariaLabel="Reportes de movimiento vehicular"
            items={MOVEMENT_REPORT_CARDS}
            onSelect={setTabMov}
          />

          {tabMov ? <section className="reporte-inc-card">
            <h2 className="reporte-inc-card__title">
              {tabMov === 'frecuencia'
                ? 'Reporte de vehiculos con mayor frecuencia de visitas'
                : tabMov === 'entradas_salidas'
                  ? 'Reporte de entradas y salidas por rango de fechas'
                  : 'Reporte de tiempo promedio de estadia'}
            </h2>
            <form
              className="reporte-inc-form"
              onSubmit={(e) => {
                e.preventDefault();
                generar();
              }}
            >
              <div className="reporte-inc-form__actions">
                <button type="submit" className="admin-btn-primary" disabled={loading}>
                  {loading ? 'Generando...' : 'Generar reporte'}
                </button>
                <button type="button" className="admin-btn-ghost" onClick={exportarPdf} disabled={loading || !desde || !hasta}>
                  Exportar PDF
                </button>
                <button type="button" className="admin-btn-ghost" onClick={exportarExcel} disabled={loading || !data}>
                  Exportar Excel
                </button>
              </div>
            </form>
          </section> : null}

          {error ? (
            <div className="admin-banner admin-banner--error" role="alert">
              {error}
            </div>
          ) : null}

          {tabMov === 'frecuencia' && data ? (
            <>
              {!detalleFrecuencia.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {detalleFrecuencia.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Vehiculos en el rango</div>
                      <div className="admin-kpi-value">{data.totalVehiculos}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Total vehículos</div>
                      <div className="admin-kpi-value">{detalleFrecuencia.length}</div>
                    </article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Ranking visual del top 10"
                      description="Haz clic en una barra para filtrar la tabla por placa."
                      insights={[
                        {
                          label: 'Placa lider',
                          value: topFrecuencia[0]?.placa || '—',
                        },
                        {
                          label: 'Max. visitas',
                          value: formatNumber(topFrecuencia[0]?.visitas || 0),
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={frecuenciaBarData}
                          options={buildCartesianOptions({
                            indexAxis: 'y',
                            showLegend: false,
                            maxTicksLimit: 10,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroPlaca(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Composicion por tipo de cliente"
                      description="Cada segmento resume cuantos vehiculos entraron en el ranking general."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={frecuenciaPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltro('tipoCliente', label);
                              },
                            })}
                            plugins={frecuenciaPiePlugins}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            frecuenciaPieData.labels,
                            frecuenciaPieData.datasets[0].data,
                            frecuenciaPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Todos los vehículos del período</h3>
                      <div className="reporte-table-toolbar__controls">
                        <input
                          type="text"
                          placeholder="Buscar placa..."
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select value={filtros.tipoCliente} onChange={(e) => setFiltro('tipoCliente', e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los clientes</option>
                          {distribucionFrecuencia.map((item) => (
                            <option key={item.label} value={item.label}>{item.label}</option>
                          ))}
                        </select>
                        <select value={filtros.tipoVehiculo} onChange={(e) => setFiltro('tipoVehiculo', e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los tipos</option>
                          {tiposVehiculoFrecuencia.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todas las marcas</option>
                          {marcasFrecuencia.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={filtroColor} onChange={(e) => setFiltroColor(e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los colores</option>
                          {coloresFrecuencia.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Placa</th>
                            <th>Marca / Modelo</th>
                            <th>Tipo</th>
                            <th>Color</th>
                            <th>Tipo de cliente</th>
                            <th>Visitas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filasFrecuencia.map((row, index) => (
                            <tr key={`${row.placa}-${index}`}>
                              <td>{index + 1}</td>
                              <td>{row.placa}</td>
                              <td>{row.marca !== '—' ? `${row.marca} ${row.modelo}` : row.modelo}</td>
                              <td>{row.tipoVehiculo}</td>
                              <td>{row.color}</td>
                              <td>{row.tipoCliente}</td>
                              <td>{row.visitas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tabMov === 'entradas_salidas' && data ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Total entradas</div>
                      <div className="admin-kpi-value">{data.totalEntradas}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--spaces">
                      <div className="admin-kpi-label">Total salidas</div>
                      <div className="admin-kpi-value">{data.totalSalidas}</div>
                    </article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Flujo diario"
                      description="Haz clic sobre una columna para concentrarte en ese dia."
                      insights={[
                        {
                          label: 'Dias con actividad',
                          value: formatNumber(flujoPorDia.length),
                        },
                        {
                          label: 'Pico de flujo',
                          value: flujoPorDia.reduce(
                            (best, row) => {
                              const total = row.entradas + row.salidas;
                              return total > best.total ? { label: row.label, total } : best;
                            },
                            { label: '—', total: 0 }
                          ).label,
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={flujoBarData}
                          options={buildCartesianOptions({
                            maxTicksLimit: 10,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroFechaFlujo(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Mix de clientes"
                      description="Selecciona un segmento para dejar solo ese perfil en la tabla."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={flujoPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltro('tipoCliente', label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(data.totalRegistros || 0), color: '#0f172a' },
                                { text: 'registros', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            flujoPieData.labels,
                            flujoPieData.datasets[0].data,
                            flujoPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-inc-table-wrap">
                    <div className="reporte-table-toolbar">
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de flujo vehicular</h3>
                      <div className="reporte-table-toolbar__controls">
                        <input
                          type="text"
                          placeholder="Buscar placa..."
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input reporte-table-input"
                        />
                        <select value={filtros.tipoCliente} onChange={(e) => setFiltro('tipoCliente', e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los clientes</option>
                          {flujoTipoCliente.map((item) => (
                            <option key={item.label} value={item.label}>{item.label}</option>
                          ))}
                        </select>
                        <select value={filtros.tipoVehiculo} onChange={(e) => setFiltro('tipoVehiculo', e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los tipos</option>
                          {tiposVehiculoFlujo.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={filtroDiaSemana} onChange={(e) => setFiltroDiaSemana(e.target.value)} className="reporte-table-input">
                          <option value="Todos">Todos los días</option>
                          {DIAS_SEMANA.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={filtroHoraIni} onChange={(e) => setFiltroHoraIni(e.target.value)} className="reporte-table-input">
                          <option value="">Hora desde</option>
                          {HORAS_DIA.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                        </select>
                        <select value={filtroHoraFin} onChange={(e) => setFiltroHoraFin(e.target.value)} className="reporte-table-input">
                          <option value="">Hora hasta</option>
                          {HORAS_DIA.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:59</option>)}
                        </select>
                        {filtroFechaFlujo ? (
                          <button type="button" className="admin-btn-ghost" onClick={() => setFiltroFechaFlujo('')}>
                            Fecha: {filtroFechaFlujo} x
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Tipo cliente</th>
                            <th>Referencia</th>
                            <th>Placa</th>
                            <th>Tipo de vehículo</th>
                            <th>Hora de entrada</th>
                            <th>Hora de salida</th>
                            <th>Tiempo de estadia</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filasFlujo.map((row, index) => (
                            <tr key={`${row.referencia}-${index}`}>
                              <td>{row.tipoCliente}</td>
                              <td>{row.referencia}</td>
                              <td>{row.placa}</td>
                              <td>{row.tipoVehiculo ?? '—'}</td>
                              <td>{row.horaEntrada ? new Date(row.horaEntrada).toLocaleString('es-GT') : '—'}</td>
                              <td>{row.horaSalida ? new Date(row.horaSalida).toLocaleString('es-GT') : '—'}</td>
                              <td>{row.tiempoEstadia}</td>
                              <td>{row.estadoTicket}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tabMov === 'tiempo_estadia' && data ? (
            <>
              {!data.totalRegistros ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.totalRegistros > 0 ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces">
                      <div className="admin-kpi-label">Promedio general</div>
                      <div className="admin-kpi-value">{data.promedioGeneral?.etiqueta || '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Maximo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.maximo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.maximo ? `${data.maximo.placa} · ${new Date(data.maximo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Minimo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.minimo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.minimo ? `${data.minimo.placa} · ${new Date(data.minimo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                  </div>

                  <div className="reporte-chart-grid">
                    <ReportChartCard
                      title="Distribucion de registros por dia"
                      description="Haz clic en un segmento para filtrar la tabla por dia de la semana."
                    >
                      <div className="reporte-chart-split">
                        <div className="reporte-chart-canvas reporte-chart-canvas--donut">
                          <Doughnut
                            data={tiempoPieData}
                            options={buildDoughnutOptions({
                              onClick: (_, elements, chart) => {
                                const label = clickedLabel(elements, chart);
                                if (label) setFiltroDia(label);
                              },
                            })}
                            plugins={[
                              createCenterTextPlugin([
                                { text: formatNumber(tiempoTotales), color: '#0f172a' },
                                { text: 'registros', color: '#64748b' },
                              ]),
                            ]}
                          />
                        </div>
                        <ReportLegend
                          items={buildLegendItems(
                            tiempoPieData.labels,
                            tiempoPieData.datasets[0].data,
                            tiempoPieData.datasets[0].backgroundColor
                          )}
                        />
                      </div>
                    </ReportChartCard>

                    <ReportChartCard
                      title="Promedio de estadia por dia"
                      description="Cada barra muestra la permanencia media en minutos."
                      insights={[
                        {
                          label: 'Dia mas cargado',
                          value: diaMasCargado?.diaSemana || '—',
                        },
                        {
                          label: 'Registros del dia lider',
                          value: formatNumber(diaMasCargado?.cantidadRegistros || 0),
                        },
                      ]}
                    >
                      <div className="reporte-chart-canvas reporte-chart-canvas--wide">
                        <Bar
                          data={tiempoBarData}
                          options={buildCartesianOptions({
                            showLegend: false,
                            onClick: (_, elements, chart) => {
                              const label = clickedLabel(elements, chart);
                              if (label) setFiltroDia(label);
                            },
                          })}
                        />
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="reporte-chart-grid" style={{ marginTop: '1.25rem' }}>
                    <div className="reporte-inc-table-wrap" style={{ margin: 0 }}>
                      <div className="reporte-table-toolbar">
                        <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Promedio por dia de la semana</h3>
                        <div className="reporte-table-toolbar__controls">
                          {filtroDia ? (
                            <button type="button" className="admin-btn-ghost" onClick={() => setFiltroDia('')}>
                              Quitar filtro: {filtroDia} x
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="crudx-table-scroll">
                        <table className="crudx-table reporte-inc-table">
                          <thead>
                            <tr>
                              <th>Dia</th>
                              <th>Promedio</th>
                              <th>Registros</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filasTiempo.map((row) => (
                              <tr key={row.diaSemana}>
                                <td>{row.diaSemana}</td>
                                <td>{row.promedioEtiqueta}</td>
                                <td>{row.cantidadRegistros}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {(data?.promedioPorTipoVehiculo?.length > 0) && (
                      <div className="reporte-inc-table-wrap" style={{ margin: 0 }}>
                        <div className="reporte-table-toolbar">
                          <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Promedio por tipo de vehículo</h3>
                        </div>
                        <div className="crudx-table-scroll">
                          <table className="crudx-table reporte-inc-table">
                            <thead>
                              <tr>
                                <th>Tipo de vehículo</th>
                                <th>Promedio</th>
                                <th>Registros</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.promedioPorTipoVehiculo.map((row) => (
                                <tr key={row.tipo}>
                                  <td>{row.tipo}</td>
                                  <td>{row.promedioEtiqueta}</td>
                                  <td>{row.cantidadRegistros}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {seccion === 'operativos' ? <ReportesOperativosMaquinasSection onBackToReports={() => setSeccion('')} /> : null}
      {seccion === 'financieros' ? <ReportesFinancierosSection onBackToReports={() => setSeccion('')} /> : null}
      {seccion === 'membresias_clientes' ? <ReportesMembresiasClientesSection onBackToReports={() => setSeccion('')} /> : null}
      {seccion === 'afluencia' ? <ReportesAfluenciaSection onBackToReports={() => setSeccion('')} /> : null}
      {seccion === 'perfil_flota' ? <ReportesPerfilFlotaSection onBackToReports={() => setSeccion('')} /> : null}
      {seccion === 'analisis_flota' ? <ReportesAnalisisFlotaSection onBackToReports={() => setSeccion('')} /> : null}
    </div>
  );
}


/**
 * ReportesPage — wrapper que provee el contexto global de filtros
 * y renderiza el contenido principal del módulo de reportes.
 */
export default function ReportesPage() {
  return (
    <ReportFilterProvider>
      <ReportesPageContent />
    </ReportFilterProvider>
  );
}
