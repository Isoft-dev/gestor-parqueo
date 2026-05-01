import * as service from '../services/reporteIncidentes.js';
import * as serviceMem from '../services/reporteMembresias.js';
import * as serviceMora from '../services/reporteMoraClientes.js';
import * as serviceMov from '../services/reporteMovimientoVehicular.js';
import * as serviceOps from '../services/reporteOperativoMaquinas.js';

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
