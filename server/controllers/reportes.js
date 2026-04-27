import * as service from '../services/reporteIncidentes.js';
import * as serviceMem from '../services/reporteMembresias.js';
import * as serviceMora from '../services/reporteMoraClientes.js';

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
