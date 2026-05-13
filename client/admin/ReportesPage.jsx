import { useEffect, useMemo, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { API_BASE } from '../config.js';
import ReportesOperativosMaquinasSection from './ReportesOperativosMaquinasSection.jsx';
import ReportesFinancierosSection from './ReportesFinancierosSection.jsx';
import ReportesMembresiasClientesSection from './ReportesMembresiasClientesSection.jsx';
import ReportesAfluenciaSection from './ReportesAfluenciaSection.jsx';

ChartJS.register(ArcElement, Tooltip, Legend);

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

function TiempoEstadiaPieChart({ rows, onPieClick }) {
  const items = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      dia: r.diaSemana,
      valor: Number(r.cantidadRegistros || 0),
    }))
    .filter((r) => r.valor > 0);

  const total = items.reduce((s, x) => s + x.valor, 0);
  const palette = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316'];

  if (!total) {
    return (
      <p className="admin-muted" style={{ margin: 0 }}>Sin datos para graficar</p>
    );
  }

  const chartData = {
    labels: items.map((x) => x.dia),
    datasets: [
      {
        data: items.map((x) => x.valor),
        backgroundColor: items.map((_, i) => palette[i % palette.length]),
        borderColor: '#ffffff',
        borderWidth: 1.5,
      },
    ],
  };

  const percentLabelPlugin = {
    id: 'percentLabelPlugin',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const dataset = chart.data.datasets[0];
      const vals = dataset.data || [];
      const sum = vals.reduce((s, n) => s + Number(n || 0), 0);
      if (!sum) return;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px Inter, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      meta.data.forEach((arc, i) => {
        const value = Number(vals[i] || 0);
        if (value <= 0) return;
        const pct = `${Math.round((value / sum) * 100)}%`;
        const p = arc.getProps(['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'], true);
        const angle = (p.startAngle + p.endAngle) / 2;
        const radius = (p.innerRadius + p.outerRadius) / 2;
        const x = p.x + Math.cos(angle) * radius;
        const y = p.y + Math.sin(angle) * radius;
        ctx.fillText(pct, x, y);
      });
      ctx.restore();
    },
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.raw || 0);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${context.label}: ${value} (${pct}%)`;
          },
        },
      },
    },
    onClick: (event, elements, chart) => {
      if (elements && elements.length > 0 && onPieClick) {
        const dataIndex = elements[0].index;
        const labelClicked = chart.data.labels[dataIndex];
        onPieClick(labelClicked);
      }
    },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '18px', alignItems: 'center' }}>
      <div style={{ height: 170 }}>
        <Pie data={chartData} options={options} plugins={[percentLabelPlugin]} />
      </div>
      <div>
        {items.map((item, i) => {
          const pct = Math.round((item.valor / total) * 100);
          return (
            <div key={item.dia} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 2, background: palette[i % palette.length], display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {item.dia}: {item.valor} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportesPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [seccion, setSeccion] = useState('movimiento');
  const [tabMov, setTabMov] = useState('frecuencia');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataByTab, setDataByTab] = useState({
    frecuencia: null,
    entradas_salidas: null,
    tiempo_estadia: null,
  });
  
  // Estados para filtros dinámicos locales
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('Todos');
  const [filtroDia, setFiltroDia] = useState('');

  const data = dataByTab[tabMov];

  useEffect(() => {
    // Al cambiar de pestaña se limpia el resultado para evitar mezclar estructuras de datos.
    setError('');
    setDataByTab({
      frecuencia: null,
      entradas_salidas: null,
      tiempo_estadia: null,
    });
    setFiltroPlaca('');
    setFiltroTipoCliente('Todos');
    setFiltroDia('');
  }, [tabMov, seccion]);

  const generar = async () => {
    setError('');
    setLoading(true);
    setDataByTab((prev) => ({ ...prev, [tabMov]: null }));
    try {
      const q = new URLSearchParams({ desde, hasta });
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
    const q = new URLSearchParams({ desde, hasta });
    const pathByTab = {
      frecuencia: '/reportes/movimiento-vehicular/frecuencia/pdf',
      entradas_salidas: '/reportes/movimiento-vehicular/entradas-salidas/pdf',
      tiempo_estadia: '/reportes/movimiento-vehicular/tiempo-estadia/pdf',
    };
    window.open(`${API_BASE}${pathByTab[tabMov]}?${q}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Reportes</h1>
        <p className="admin-page-desc">
          Estructura de 5 secciones. Secciones activas: movimiento vehicular, operativos de máquinas, financieros, membresías/clientes y afluencia.
        </p>
      </header>

      <div className="reporte-tabs" role="tablist" aria-label="Secciones de reportes">
        <button type="button" role="tab" aria-selected={seccion === 'movimiento'} className={`reporte-tab-btn${seccion === 'movimiento' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('movimiento')}>
          1) Movimiento vehicular
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'operativos'} className={`reporte-tab-btn${seccion === 'operativos' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('operativos')}>
          2) Reportes operativos de máquinas
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'financieros'} className={`reporte-tab-btn${seccion === 'financieros' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('financieros')}>
          3) Reportes financieros
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'membresias_clientes'} className={`reporte-tab-btn${seccion === 'membresias_clientes' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('membresias_clientes')}>
          4) Membresías y clientes
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'afluencia'} className={`reporte-tab-btn${seccion === 'afluencia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setSeccion('afluencia')}>
          5) Reporte de afluencia
        </button>
      </div>

      {seccion === 'movimiento' ? (
        <>
          <div className="reporte-tabs" role="tablist" aria-label="Reportes de movimiento vehicular">
            <button type="button" role="tab" aria-selected={tabMov === 'frecuencia'} className={`reporte-tab-btn${tabMov === 'frecuencia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('frecuencia')}>
              Vehículos frecuentes
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'entradas_salidas'} className={`reporte-tab-btn${tabMov === 'entradas_salidas' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('entradas_salidas')}>
              Entradas y salidas
            </button>
            <button type="button" role="tab" aria-selected={tabMov === 'tiempo_estadia'} className={`reporte-tab-btn${tabMov === 'tiempo_estadia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTabMov('tiempo_estadia')}>
              Tiempo promedio de estadía
            </button>
          </div>

          <section className="reporte-inc-card">
            <h2 className="reporte-inc-card__title">
              {tabMov === 'frecuencia'
                ? 'Reporte de vehículos con mayor frecuencia de visitas'
                : tabMov === 'entradas_salidas'
                  ? 'Reporte de entradas y salidas por rango de fechas'
                  : 'Reporte de tiempo promedio de estadía'}
            </h2>
            <form
              className="reporte-inc-form"
              onSubmit={(e) => {
                e.preventDefault();
                generar();
              }}
            >
              <label className="reporte-inc-field">
                <span>Fecha inicio</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
              </label>
              <label className="reporte-inc-field">
                <span>Fecha fin</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
              </label>
              <div className="reporte-inc-form__actions">
                <button type="submit" className="admin-btn-primary" disabled={loading}>
                  {loading ? 'Generando…' : 'Generar reporte'}
                </button>
                <button type="button" className="admin-btn-ghost" onClick={exportarPdf} disabled={loading || !desde || !hasta}>
                  Exportar PDF
                </button>
              </div>
            </form>
          </section>

          {error ? (
            <div className="admin-banner admin-banner--error" role="alert">
              {error}
            </div>
          ) : null}

          {tabMov === 'frecuencia' && data ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts">
                      <div className="admin-kpi-label">Vehículos en el rango</div>
                      <div className="admin-kpi-value">{data.totalVehiculos}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Top destacados</div>
                      <div className="admin-kpi-value">{Math.min(10, data.top10?.length || 0)}</div>
                    </article>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Top 10 vehículos más frecuentes</h3>
                      <input 
                        type="text" 
                        placeholder="Buscar placa..." 
                        value={filtroPlaca}
                        onChange={(e) => setFiltroPlaca(e.target.value)}
                        className="admin-input"
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Placa</th>
                            <th>Modelo</th>
                            <th>Color</th>
                            <th>Tipo de cliente</th>
                            <th>Visitas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.top10) ? data.top10 : [])
                            .filter(r => r.placa?.toLowerCase().includes(filtroPlaca.toLowerCase()))
                            .map((r, i) => (
                              <tr key={`${r.placa}-${i}`}>
                                <td>{i + 1}</td>
                                <td>{r.placa}</td>
                                <td>{r.modelo}</td>
                                <td>{r.color}</td>
                                <td>{r.tipoCliente}</td>
                                <td>{r.visitas}</td>
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
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de flujo vehicular</h3>
                      
                      {/* Controles de Filtro Dinámico */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          placeholder="Buscar placa..." 
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <select 
                          value={filtroTipoCliente} 
                          onChange={(e) => setFiltroTipoCliente(e.target.value)}
                          className="admin-input"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                          <option value="Todos">Todos los clientes</option>
                          <option value="Esporádico">Esporádico</option>
                          <option value="Mensual">Mensual</option>
                        </select>
                      </div>
                    </div>

                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Tipo cliente</th>
                            <th>Referencia</th>
                            <th>Placa</th>
                            <th>Hora de entrada</th>
                            <th>Hora de salida</th>
                            <th>Tiempo de estadía</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.detalle) ? data.detalle : [])
                            .filter(r => {
                              const matchPlaca = r.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
                              const matchTipo = filtroTipoCliente === 'Todos' || r.tipoCliente === filtroTipoCliente;
                              return matchPlaca && matchTipo;
                            })
                            .map((r, i) => (
                              <tr key={`${r.referencia}-${i}`}>
                                <td>{r.tipoCliente}</td>
                                <td>{r.referencia}</td>
                                <td>{r.placa}</td>
                                <td>{r.horaEntrada ? new Date(r.horaEntrada).toLocaleString('es-GT') : '—'}</td>
                                <td>{r.horaSalida ? new Date(r.horaSalida).toLocaleString('es-GT') : '—'}</td>
                                <td>{r.tiempoEstadia}</td>
                                <td>{r.estadoTicket}</td>
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
                      <div className="admin-kpi-label">Máximo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.maximo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.maximo ? `${data.maximo.placa} · ${new Date(data.maximo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                    <article className="admin-kpi admin-kpi--alerts2">
                      <div className="admin-kpi-label">Mínimo</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
                        {data.minimo?.etiqueta || '—'}
                      </div>
                      <div className="admin-kpi-hint">{data.minimo ? `${data.minimo.placa} · ${new Date(data.minimo.fecha).toLocaleString('es-GT')}` : '—'}</div>
                    </article>
                  </div>
                  <div className="reporte-inc-chart-wrap">
                    <h3 className="reporte-inc-subtitle">
                      Distribución de registros por día de la semana (¡Haz clic en un segmento!)
                    </h3>
                    <TiempoEstadiaPieChart rows={data.promedioPorDiaSemana} onPieClick={setFiltroDia} />
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Promedio por día de la semana</h3>
                      {filtroDia && (
                        <button 
                          type="button" 
                          className="admin-btn-ghost" 
                          onClick={() => setFiltroDia('')}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                          Quitar filtro: {filtroDia} ✖
                        </button>
                      )}
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead>
                          <tr>
                            <th>Día</th>
                            <th>Promedio</th>
                            <th>Registros</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(data.promedioPorDiaSemana) ? data.promedioPorDiaSemana : [])
                            .filter(r => !filtroDia || r.diaSemana === filtroDia)
                            .map((r) => (
                              <tr key={r.diaSemana}>
                                <td>{r.diaSemana}</td>
                                <td>{r.promedioEtiqueta}</td>
                                <td>{r.cantidadRegistros}</td>
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
        </>
      ) : null}

      {seccion === 'operativos' ? <ReportesOperativosMaquinasSection /> : null}
      {seccion === 'financieros' ? <ReportesFinancierosSection /> : null}
      {seccion === 'membresias_clientes' ? <ReportesMembresiasClientesSection /> : null}
      {seccion === 'afluencia' ? <ReportesAfluenciaSection /> : null}
    </div>
  );
}
