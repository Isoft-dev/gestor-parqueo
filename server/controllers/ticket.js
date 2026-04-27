import * as service from '../services/ticket.js';

function businessStatus(err) {
  const msg = String(err?.message || '');
  if (/no encontrado/i.test(msg)) return 404;
  if (/no reconocido/i.test(msg)) return 404;
  if (/ya saldado/i.test(msg)) return 409;
  if (/salida bloqueada|solicita asistencia/i.test(msg)) return 403;
  if (/efectivo suficiente|suma de billetes|vuelto/i.test(msg)) return 400;
  if (/requerid|tipo de cobro|tipo entrada|tipo salida|tipo cobro|NIT|CF|COB_NIT|columna|monto recibido|MAQ_ID|TVE_ID|placa|comprobante|fk|ORA-02291|ORA-01400|UK_PAR_COBRO_TIC_ID|FK_PAR_COBRO_TICKET/i.test(msg)) return 400;
  if (/duplicad|ya existe|conflict|unico|ORA-00001/i.test(msg)) return 409;
  return 500;
}

export async function getAll(_req, res) {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const row = await service.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(row);
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function create(req, res) {
  try {
    const { VEH_ID, TIC_FECHA_HORA_ENTRADA, ETI_ID } = req.body;
    if (!VEH_ID || !TIC_FECHA_HORA_ENTRADA || !ETI_ID) {
      return res.status(400).json({ error: 'VEH_ID, TIC_FECHA_HORA_ENTRADA y ETI_ID son requeridos' });
    }
    res.status(201).json(await service.create(req.body));
  } catch (err) { res.status(businessStatus(err)).json({ error: err.message }); }
}

export async function update(req, res) {
  try {
    const existing = await service.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ticket no encontrado' });
    const body = req.body || {};
    const usuBit =
      body.USU_ID_BITACORA_EXTRAVIADO ?? body.usu_id_bitacora_extraviado ?? null;
    const clean = { ...body };
    delete clean.USU_ID_BITACORA_EXTRAVIADO;
    delete clean.usu_id_bitacora_extraviado;
    res.json(
      await service.update(req.params.id, clean, {
        usuIdBitacoraExtraviado: usuBit,
      }),
    );
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes('UK_PAR_COBRO_TIC_ID')) {
      return res.status(400).json({
        error: 'Este ticket ya tiene un cobro registrado (un ticket solo puede tener un cobro).',
      });
    }
    if (msg.includes('FK_PAR_COBRO_TICKET') || msg.includes('ORA-02291')) {
      return res.status(400).json({
        error: 'El TIC_ID del cobro no existe o no es válido.',
      });
    }
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function quoteByCodigo(req, res) {
  try {
    const codigo = (req.body?.TIC_CODIGO ?? '').trim();
    if (!codigo) {
      return res.status(400).json({ error: 'TIC_CODIGO es requerido' });
    }
    const quote = await service.quoteByCodigo(codigo);
    res.json(quote);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function checkout(req, res) {
  try {
    const payload = req.body || {};
    const result = await service.checkoutByCodigo(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function prepararExtraviado(req, res) {
  try {
    const placa = (req.body?.VEH_PLACA ?? '').trim();
    if (!placa) return res.status(400).json({ error: 'VEH_PLACA es requerido' });
    const result = await service.prepararTicketExtraviadoPorPlaca(placa);
    res.json(result);
  } catch (err) {
    const msg = String(err?.message || '');
    if (/requerid/i.test(msg)) return res.status(400).json({ error: err.message });
    if (/no hay|no existe/i.test(msg)) return res.status(404).json({ error: err.message });
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function downloadReceipt(req, res) {
  try {
    const receipt = await service.generateReceiptPdfByTicketId(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
    res.send(receipt.pdfBuffer);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function generateEntry(req, res) {
  try {
    const payload = req.body || {};
    const result = await service.generateEntryTicket(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function downloadEntryTicket(req, res) {
  try {
    const pdf = await service.generateEntryTicketPdfByTicketId(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
    res.send(pdf.pdfBuffer);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}

export async function validateExit(req, res) {
  try {
    const payload = req.body || {};
    const result = await service.validateExitByCodigo(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(businessStatus(err)).json({ error: err.message });
  }
}
