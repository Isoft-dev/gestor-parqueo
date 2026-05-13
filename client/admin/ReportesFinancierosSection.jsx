import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { API_BASE } from '../config.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend);

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

export default function ReportesFinancierosSection() {
  const initial = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState('cobros_maquina');
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [mesInicio, setMesInicio] = useState(initial.desde.slice(0, 7));
  const [mesFin, setMesFin] = useState(initial.hasta.slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Estados para filtros interactivos
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroReferencia, setFiltroReferencia] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMaquina, setFiltroMaquina] = useState('');

  useEffect(() => {
    // Al cambiar de subpestaña se oculta el reporte anterior.
    setError('');
    setData(null);
    setFiltroFecha('');
    setFiltroReferencia('');
    setFiltroMes('');
    setFiltroPlaca('');
    setFiltroMaquina('');
  }, [tab]);

  const generate = async () => {
    setError('');
    setData(null);
    setLoading(true);
    try {
      const q = new URLSearchParams(
        tab === 'pagos_membresia'
          ? { mes_inicio: mesInicio, mes_fin: mesFin }
          : { desde, hasta }
      );
      const pathByTab = {
        cobros_maquina: '/reportes/financieros/cobros-maquina',
        pagos_membresia: '/reportes/financieros/pagos-membresia-mes',
        ingresos_tipo: '/reportes/financieros/ingresos-tipo-cliente',
        ingresos_totales: '/reportes/financieros/ingresos-totales',
      };
      const res = await fetch(`${API_BASE}${pathByTab[tab]}?${q}`, { cache: 'no-store' });
      const json = await parseJsonSafe(res);
      if (!res.ok) throw new Error(json.error || json.message || res.statusText);
      setData(json);
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    const q = new URLSearchParams(
      tab === 'pagos_membresia'
        ? { mes_inicio: mesInicio, mes_fin: mesFin }
        : { desde, hasta }
    );
    const pathByTab = {
      cobros_maquina: '/reportes/financieros/cobros-maquina/pdf',
      pagos_membresia: '/reportes/financieros/pagos-membresia-mes/pdf',
      ingresos_tipo: '/reportes/financieros/ingresos-tipo-cliente/pdf',
      ingresos_totales: '/reportes/financieros/ingresos-totales/pdf',
    };
    window.open(`${API_BASE}${pathByTab[tab]}?${q}`, '_blank', 'noopener,noreferrer');
  };

  const lineData = {
    labels: (data?.porMes || []).map((x) => x.anioMes),
    datasets: [
      {
        label: 'Monto recaudado',
        data: (data?.porMes || []).map((x) => Number(x.montoTotalRecaudado || 0)),
        borderColor: '#2563eb',
        backgroundColor: '#93c5fd',
        tension: 0.25,
      },
    ],
  };

  const pieTipoData = {
    labels: ['Esporádico', 'Membresía'],
    datasets: [
      {
        data: [Number(data?.esporadico?.totalRecaudado || 0), Number(data?.mensual?.totalRecaudado || 0)],
        backgroundColor: ['#0ea5e9', '#22c55e'],
      },
    ],
  };

  const barTotalesData = {
    labels: (data?.ingresosPorDia || []).map((x) => x.fecha),
    datasets: [
      {
        label: 'Esporádico',
        data: (data?.ingresosPorDia || []).map((x) => Number(x.ingresoEsporadico || 0)),
        backgroundColor: '#0ea5e9',
      },
      {
        label: 'Membresía',
        data: (data?.ingresosPorDia || []).map((x) => Number(x.ingresoMensual || 0)),
        backgroundColor: '#22c55e',
      },
    ],
  };

  return (
    <>
      <div className="reporte-tabs" role="tablist" aria-label="Subreportes financieros">
        <button type="button" role="tab" aria-selected={tab === 'cobros_maquina'} className={`reporte-tab-btn${tab === 'cobros_maquina' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('cobros_maquina')}>
          Cobros por máquina
        </button>
        <button type="button" role="tab" aria-selected={tab === 'pagos_membresia'} className={`reporte-tab-btn${tab === 'pagos_membresia' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('pagos_membresia')}>
          Pagos membresías por mes
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ingresos_tipo'} className={`reporte-tab-btn${tab === 'ingresos_tipo' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('ingresos_tipo')}>
          Ingresos por tipo cliente
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ingresos_totales'} className={`reporte-tab-btn${tab === 'ingresos_totales' ? ' reporte-tab-btn--active' : ''}`} onClick={() => setTab('ingresos_totales')}>
          Ingresos totales
        </button>
      </div>

      <section className="reporte-inc-card">
        <h2 className="reporte-inc-card__title">
          {tab === 'cobros_maquina'
            ? 'Reporte de cobros procesados por máquina'
            : tab === 'pagos_membresia'
              ? 'Reporte de pagos de membresías por mes'
              : tab === 'ingresos_tipo'
                ? 'Reporte de ingresos por tipo de cliente'
                : 'Reporte de ingresos totales por rango de fechas'}
        </h2>
        <form
          className="reporte-inc-form"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          {tab === 'pagos_membresia' ? (
            <>
              <label className="reporte-inc-field">
                <span>Mes inicio</span>
                <input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} required />
              </label>
              <label className="reporte-inc-field">
                <span>Mes fin</span>
                <input type="month" value={mesFin} onChange={(e) => setMesFin(e.target.value)} required />
              </label>
            </>
          ) : (
            <>
              <label className="reporte-inc-field">
                <span>Fecha inicio</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
              </label>
              <label className="reporte-inc-field">
                <span>Fecha fin</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
              </label>
            </>
          )}
          <div className="reporte-inc-form__actions">
            <button type="submit" className="admin-btn-primary" disabled={loading}>
              {loading ? 'Generando…' : 'Generar reporte'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={exportPdf} disabled={loading}>
              Exportar PDF
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {data == null ? null : (
        <>
          {tab === 'cobros_maquina' ? (
            <>
              {!data.detalle?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalle?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Transacciones</div><div className="admin-kpi-value">{data.totalTransacciones}</div></article>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Cobrado</div><div className="admin-kpi-value">Q{Number(data.totalCobrado || 0).toFixed(2)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Vuelto</div><div className="admin-kpi-value">Q{Number(data.totalVuelto || 0).toFixed(2)}</div></article>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle por máquina</h3>
                      <input 
                        type="text" 
                        placeholder="Buscar máquina..." 
                        value={filtroMaquina}
                        onChange={(e) => setFiltroMaquina(e.target.value)}
                        className="admin-input"
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Máquina</th><th>Transacciones</th><th>Monto cobrado</th><th>Vuelto</th><th>Promedio</th><th>Automáticas</th></tr></thead>
                        <tbody>
                          {(data.detalle || [])
                            .filter(r => r.maquina?.toLowerCase().includes(filtroMaquina.toLowerCase()))
                            .map((r) => (
                              <tr key={String(r.maquinaId)}>
                                <td>{r.maquina}</td><td>{r.totalTransacciones}</td><td>Q{Number(r.montoTotalCobrado || 0).toFixed(2)}</td><td>Q{Number(r.montoTotalVuelto || 0).toFixed(2)}</td><td>Q{Number(r.promedioCobro || 0).toFixed(2)}</td><td>{r.transaccionesAutomaticas}</td>
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

          {tab === 'pagos_membresia' ? (
            <>
              {!data.porMes?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.porMes?.length ? (
                <>
                  <div className="reporte-inc-chart-wrap">
                    <h3 className="reporte-inc-subtitle">Tendencia mensual de recaudación (¡Haz clic en un punto para filtrar!)</h3>
                    <div style={{ height: 280 }}>
                      <Line 
                        data={lineData} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false,
                          onClick: (event, elements, chart) => {
                            if (elements.length > 0) {
                              const dataIndex = elements[0].index;
                              const labelClicked = chart.data.labels[dataIndex];
                              setFiltroMes(labelClicked);
                            }
                          }
                        }} 
                      />
                    </div>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <h3 className="reporte-inc-subtitle">Resumen mensual</h3>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Mes</th><th>Membresías pagadas</th><th>Monto recaudado</th><th>Promedio pago</th></tr></thead>
                        <tbody>
                          {data.porMes.map((r) => (
                            <tr key={r.anioMes}><td>{r.anioMes}</td><td>{r.membresiasPagadas}</td><td>Q{Number(r.montoTotalRecaudado || 0).toFixed(2)}</td><td>Q{Number(r.promedioPagoMembresia || 0).toFixed(2)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de pagos</h3>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {filtroMes && (
                          <button 
                            type="button" 
                            className="admin-btn-ghost" 
                            onClick={() => setFiltroMes('')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                          >
                            Quitar filtro: {filtroMes} ✖
                          </button>
                        )}
                        <input 
                          type="text" 
                          placeholder="Buscar por placa..." 
                          value={filtroPlaca}
                          onChange={(e) => setFiltroPlaca(e.target.value)}
                          className="admin-input"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Cliente</th><th>Placa</th><th>Fecha pago</th><th>Monto</th><th>Método pago</th></tr></thead>
                        <tbody>
                          {(data.detalle || [])
                            .filter(r => {
                              const matchPlaca = r.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
                              const matchMes = filtroMes ? (r.fechaPago || '').startsWith(filtroMes) : true;
                              return matchPlaca && matchMes;
                            })
                            .map((r) => (
                              <tr key={String(r.id)}><td>{r.cliente}</td><td>{r.placa}</td><td>{r.fechaPago ? new Date(r.fechaPago).toLocaleString('es-GT') : '—'}</td><td>Q{Number(r.monto || 0).toFixed(2)}</td><td>{r.metodoPago}</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'ingresos_tipo' ? (
            <>
              {Number(data.totalGeneral || 0) <= 0 ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {Number(data.totalGeneral || 0) > 0 ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Total general</div><div className="admin-kpi-value">Q{Number(data.totalGeneral || 0).toFixed(2)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Esporádicos</div><div className="admin-kpi-value">Q{Number(data.esporadico?.totalRecaudado || 0).toFixed(2)}</div><div className="admin-kpi-hint">{data.esporadico?.porcentajeSobreTotal || 0}%</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Membresía</div><div className="admin-kpi-value">Q{Number(data.mensual?.totalRecaudado || 0).toFixed(2)}</div><div className="admin-kpi-hint">{data.mensual?.porcentajeSobreTotal || 0}%</div></article>
                  </div>
                  <div className="reporte-inc-chart-wrap"><h3 className="reporte-inc-subtitle">Proporción de ingresos por tipo</h3><div style={{ height: 260, maxWidth: 360 }}><Pie data={pieTipoData} /></div></div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'ingresos_totales' ? (
            <>
              {!data.detalleTransacciones?.length ? <p className="reporte-inc-empty">No hay datos disponibles para el rango seleccionado.</p> : null}
              {data.detalleTransacciones?.length ? (
                <>
                  <div className="admin-kpi-grid reporte-mov-kpi-grid" style={{ marginTop: '1rem' }}>
                    <article className="admin-kpi admin-kpi--spaces"><div className="admin-kpi-label">Ingreso total</div><div className="admin-kpi-value">Q{Number(data.ingresoTotal || 0).toFixed(2)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts"><div className="admin-kpi-label">Esporádicos</div><div className="admin-kpi-value">Q{Number(data.ingresoEsporadico || 0).toFixed(2)}</div></article>
                    <article className="admin-kpi admin-kpi--alerts2"><div className="admin-kpi-label">Membresía</div><div className="admin-kpi-value">Q{Number(data.ingresoMensual || 0).toFixed(2)}</div></article>
                  </div>
                  <div className="reporte-inc-chart-wrap">
                    <h3 className="reporte-inc-subtitle">Ingresos diarios por tipo de cliente (¡Haz clic en una barra para filtrar la tabla!)</h3>
                    <div style={{ height: 280 }}>
                      <Bar 
                        data={barTotalesData} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false,
                          onClick: (event, elements, chart) => {
                            if (elements.length > 0) {
                              const dataIndex = elements[0].index;
                              const labelClicked = chart.data.labels[dataIndex];
                              setFiltroFecha(labelClicked); // Filtro interactivo cruzado (drill-down)
                            }
                          }
                        }} 
                      />
                    </div>
                  </div>
                  <div className="reporte-inc-table-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <h3 className="reporte-inc-subtitle" style={{ margin: 0 }}>Detalle de transacciones</h3>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {filtroFecha && (
                          <button 
                            type="button" 
                            className="admin-btn-ghost" 
                            onClick={() => setFiltroFecha('')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                          >
                            Quitar filtro: {filtroFecha} ✖
                          </button>
                        )}
                        <input 
                          type="text" 
                          placeholder="Buscar por referencia..." 
                          value={filtroReferencia}
                          onChange={(e) => setFiltroReferencia(e.target.value)}
                          className="admin-input"
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      </div>
                    </div>
                    <div className="crudx-table-scroll">
                      <table className="crudx-table reporte-inc-table">
                        <thead><tr><th>Fecha</th><th>Tipo cliente</th><th>Monto</th><th>Método pago</th><th>Referencia</th></tr></thead>
                        <tbody>
                          {(data.detalleTransacciones || [])
                            .filter(r => {
                              const matchRef = r.referencia?.toLowerCase().includes(filtroReferencia.toLowerCase());
                              const matchFecha = filtroFecha ? (r.fecha || '').startsWith(filtroFecha) : true;
                              return matchRef && matchFecha;
                            })
                            .map((r) => (
                              <tr key={`${r.referencia}-${r.fecha}`}><td>{r.fecha ? new Date(r.fecha).toLocaleString('es-GT') : '—'}</td><td>{r.tipoCliente}</td><td>Q{Number(r.monto || 0).toFixed(2)}</td><td>{r.metodoPago || '—'}</td><td>{r.referencia}</td></tr>
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
      )}
    </>
  );
}
