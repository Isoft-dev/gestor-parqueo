import * as service from '../services/reporteIncidentes.js';
import * as serviceMem from '../services/reporteMembresias.js';
import * as serviceMora from '../services/reporteMoraClientes.js';
import * as serviceMov from '../services/reporteMovimientoVehicular.js';
import * as serviceOps from '../services/reporteOperativoMaquinas.js';
import * as serviceFin from '../services/reporteFinanciero.js';
import * as serviceMemCli from '../services/reporteMembresiasClientes.js';
import * as serviceAfl from '../services/reporteAfluencia.js';

export async function incidentesPorRango(req, res) {
  try {
    const { desde, hasta, inc_id } = req.query;
    const data = await service.getIncidentesPorRango(desde, hasta, inc_id);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function incidentesPorRangoPdf(req, res) {
  try {
    const { desde, hasta, inc_id } = req.query;
    const data = await service.getIncidentesPorRango(desde, hasta, inc_id);
    const pdfBuffer = await service.buildIncidentesPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-incidentes-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function incidentesPorTipo(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await service.getIncidentesPorTipoRango(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function incidentesPorTipoPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await service.getIncidentesPorTipoRango(desde, hasta);
    const pdfBuffer = await service.buildIncidentesPorTipoPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-incidentes-por-tipo-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function incidentesPorResolucion(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await service.getIncidentesPorResolucionRango(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function incidentesPorResolucionPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await service.getIncidentesPorResolucionRango(desde, hasta);
    const pdfBuffer = await service.buildIncidentesPorResolucionPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-incidentes-resolucion-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function membresiasEstado(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMem.getMembresiasPorEstadoRango(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function membresiasEstadoPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMem.getMembresiasPorEstadoRango(desde, hasta);
    const pdfBuffer = await serviceMem.buildMembresiasEstadoPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-membresias-estado-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function clientesMora(req, res) {
  try {
    const data = await serviceMora.getClientesMoraActual();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function clientesMoraPdf(req, res) {
  try {
    const data = await serviceMora.getClientesMoraActual();
    const pdfBuffer = await serviceMora.buildClientesMoraPdfBuffer(data);
    const stamp = new Date().toISOString().slice(0, 10).replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-clientes-mora-${stamp}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function vehiculosFrecuentes(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getVehiculosFrecuentes(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function vehiculosFrecuentesPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getVehiculosFrecuentes(desde, hasta);
    const pdfBuffer = await serviceMov.buildVehiculosFrecuentesPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-vehiculos-frecuencia-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function entradasSalidas(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getEntradasSalidas(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function entradasSalidasPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getEntradasSalidas(desde, hasta);
    const pdfBuffer = await serviceMov.buildEntradasSalidasPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-entradas-salidas-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function tiempoPromedioEstadia(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getTiempoPromedioEstadia(desde, hasta);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function tiempoPromedioEstadiaPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceMov.getTiempoPromedioEstadia(desde, hasta);
    const pdfBuffer = await serviceMov.buildTiempoPromedioPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-tiempo-estadia-${safeDesde}-${safeHasta}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function alertasOperativas(req, res) {
  try {
    const { desde, hasta, maq_id, tal_id, eal_id } = req.query;
    const data = await serviceOps.getAlertasPorMaquinaTipo({
      desde,
      hasta,
      maqId: maq_id,
      talId: tal_id,
      ealId: eal_id,
    });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function alertasOperativasPdf(req, res) {
  try {
    const { desde, hasta, maq_id, tal_id, eal_id } = req.query;
    const data = await serviceOps.getAlertasPorMaquinaTipo({
      desde,
      hasta,
      maqId: maq_id,
      talId: tal_id,
      ealId: eal_id,
    });
    const pdfBuffer = await serviceOps.buildAlertasPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-alertas-maquina-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function mantenimientosOperativos(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceOps.getMantenimientosPorMaquina({ desde, hasta });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function mantenimientosOperativosPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceOps.getMantenimientosPorMaquina({ desde, hasta });
    const pdfBuffer = await serviceOps.buildMantenimientosPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-mantenimientos-maquina-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function recargasOperativas(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceOps.getRecargasEfectivoPorMaquina({ desde, hasta });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function recargasOperativasPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceOps.getRecargasEfectivoPorMaquina({ desde, hasta });
    const pdfBuffer = await serviceOps.buildRecargasPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-recargas-maquina-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function cobrosMaquinaFinancieros(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getCobrosProcesadosPorMaquina({ desde, hasta });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function cobrosMaquinaFinancierosPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getCobrosProcesadosPorMaquina({ desde, hasta });
    const pdfBuffer = await serviceFin.buildCobrosMaquinaPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-fin-cobros-maquina-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function pagosMembresiaMesFinancieros(req, res) {
  try {
    const { mes_inicio, mes_fin } = req.query;
    const data = await serviceFin.getPagosMembresiasPorMes({ anioInicio: mes_inicio, anioFin: mes_fin });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function pagosMembresiaMesFinancierosPdf(req, res) {
  try {
    const { mes_inicio, mes_fin } = req.query;
    const data = await serviceFin.getPagosMembresiasPorMes({ anioInicio: mes_inicio, anioFin: mes_fin });
    const pdfBuffer = await serviceFin.buildPagosMembresiasMesPdfBuffer(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-fin-membresias-${mes_inicio}-${mes_fin}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function ingresosTipoClienteFinancieros(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getIngresosPorTipoCliente({ desde, hasta });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function ingresosTipoClienteFinancierosPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getIngresosPorTipoCliente({ desde, hasta });
    const pdfBuffer = await serviceFin.buildIngresosTipoClientePdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-fin-ingresos-tipo-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function ingresosTotalesFinancieros(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getIngresosTotalesPorRango({ desde, hasta });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function ingresosTotalesFinancierosPdf(req, res) {
  try {
    const { desde, hasta } = req.query;
    const data = await serviceFin.getIngresosTotalesPorRango({ desde, hasta });
    const pdfBuffer = await serviceFin.buildIngresosTotalesPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-fin-ingresos-totales-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function buscarClientesMembresia(req, res) {
  try {
    const { q } = req.query;
    const data = await serviceMemCli.searchClientesMembresia(q);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al buscar clientes' });
  }
}

export async function historialPagosCliente(req, res) {
  try {
    const { cli_id } = req.query;
    const data = await serviceMemCli.getHistorialPagosCliente(cli_id);
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function historialPagosClientePdf(req, res) {
  try {
    const { cli_id } = req.query;
    const data = await serviceMemCli.getHistorialPagosCliente(cli_id);
    const pdfBuffer = await serviceMemCli.buildHistorialPagosClientePdfBuffer(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-historial-pagos-cli-${cli_id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function afluenciaDetallada(req, res) {
  try {
    const { desde, hasta, agrupacion } = req.query;
    const data = await serviceAfl.getAfluenciaDetallada({ desde, hasta, agrupacion });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function afluenciaDetalladaPdf(req, res) {
  try {
    const { desde, hasta, agrupacion } = req.query;
    const data = await serviceAfl.getAfluenciaDetallada({ desde, hasta, agrupacion });
    const pdfBuffer = await serviceAfl.buildAfluenciaDetalladaPdfBuffer(data);
    const safeDesde = String(desde || '').replace(/\D/g, '');
    const safeHasta = String(hasta || '').replace(/\D/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-afluencia-detallado-${safeDesde}-${safeHasta}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}

export async function afluenciaAnual(req, res) {
  try {
    const { anio_inicio, anio_fin } = req.query;
    const data = await serviceAfl.getAfluenciaAnualResumen({ anioInicio: anio_inicio, anioFin: anio_fin });
    res.json(data);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al generar el reporte' });
  }
}

export async function afluenciaAnualPdf(req, res) {
  try {
    const { anio_inicio, anio_fin } = req.query;
    const data = await serviceAfl.getAfluenciaAnualResumen({ anioInicio: anio_inicio, anioFin: anio_fin });
    const pdfBuffer = await serviceAfl.buildAfluenciaAnualPdfBuffer(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-afluencia-anual-${anio_inicio}-${anio_fin}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err?.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Error al exportar el PDF' });
  }
}
