import * as service from '../services/membresia.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrada/i.test(msg)) return 404;
  if (/no esta disponible|TPA_ID|monto vigente|al menos 2 caracteres|correo|MEM_CODIGO|columna/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|placa|dpi/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Membresía no encontrada' });
    res.json(row);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { TME_ID, MEM_FECHA_INICIO, MEM_FECHA_VENCIMIENTO, VEH_ID, ESP_ID } = req.body;
    if (!TME_ID || !MEM_FECHA_INICIO || !MEM_FECHA_VENCIMIENTO || !VEH_ID || !ESP_ID) {
      return res.status(400).json({ error: 'TME_ID, MEM_FECHA_INICIO, MEM_FECHA_VENCIMIENTO, VEH_ID y ESP_ID son requeridos' });
    }
    const created = await service.create(req.body);
    let warning = null;
    try {
      await service.sendMembershipTag(created.MEM_ID);
    } catch (mailErr) {
      warning = `Tag generado pero no se pudo enviar por correo: ${mailErr.message}`;
    }
    res.status(201).json({ ...created, warning });
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Membresía no encontrada' });
    res.json(await service.update(req.params.id, req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function downloadTag(req, res) {
  try {
    const tag = await service.generateTagPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tag.fileName}"`);
    res.send(tag.pdfBuffer);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function searchPaymentCandidates(req, res) {
  try {
    const q = req.query.q || req.query.query || '';
    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ error: 'Debes enviar al menos 2 caracteres en q' });
    }
    res.json(await service.searchPaymentCandidates(q));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function registerPayment(req, res) {
  try {
    const payload = req.body || {};
    const result = await service.registerMonthlyPayment(req.params.id, payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function getHistory(req, res) {
  try {
    res.json(await service.getMembershipHistory(req.params.id));
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
