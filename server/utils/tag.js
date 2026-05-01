import PDFDocument from 'pdfkit/js/pdfkit.js';
import QRCode from 'qrcode';

export function buildMemCodigo(memId, when = new Date()) {
  const d = String(when.getDate()).padStart(2, '0');
  const m = String(when.getMonth() + 1).padStart(2, '0');
  const y = String(when.getFullYear()).slice(-2);
  return `${d}${m}${y}${String(memId)}`.slice(0, 25);
}

const COL = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#cbd5e1',
  panel: '#ffffff',
  cardBg: '#f8fafc',
  accent: '#1d4ed8',
  pageBg: '#e8edf3',
};

function drawTagField(doc, x, y, label, value) {
  const val = String(value || 'N/D');
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COL.muted);
  doc.text(String(label).toUpperCase(), x, y, { width: 240, characterSpacing: 0.5 });
  doc.font('Helvetica').fontSize(12.5).fillColor(COL.ink);
  doc.text(val, x, y + 11, { width: 240 });
  const valueH = doc.heightOfString(val, { width: 240 });
  return y + 11 + valueH + 10;
}

export async function buildTagPdfBuffer({
  memCodigo,
  clienteNombre,
  vehPlaca,
  planNombre: _planNombre,
  vigencia,
}) {
  const qrDataUrl = await QRCode.toDataURL(String(memCodigo || ''), {
    margin: 3,
    errorCorrectionLevel: 'H',
    width: 400,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBuffer = Buffer.from(qrBase64, 'base64');

  const pageW = 520;
  const pageH = 320;
  const cardW = 460;
  const cardH = 224;
  const cardX = (pageW - cardW) / 2;
  const cardY = (pageH - cardH) / 2;
  const radius = 14;
  const pad = 20;
  const qrPanel = 170;
  const qrDraw = 150;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [pageW, pageH], margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.rect(0, 0, pageW, pageH).fill(COL.pageBg);

    doc.roundedRect(cardX + 2, cardY + 2, cardW, cardH, radius).fill('#cbd5e1');
    doc.roundedRect(cardX, cardY, cardW, cardH, radius).fill(COL.cardBg);
    doc.roundedRect(cardX, cardY, cardW, cardH, radius).strokeColor(COL.line).lineWidth(1).stroke();

    doc.strokeColor(COL.accent).lineWidth(2.5);
    doc
      .moveTo(cardX + radius + 4, cardY + 10)
      .lineTo(cardX + cardW - radius - 4, cardY + 10)
      .stroke();

    const qrBoxX = cardX + pad;
    const qrBoxY = cardY + pad + 8;
    doc.roundedRect(qrBoxX, qrBoxY, qrPanel, qrPanel, 10).fill(COL.panel);
    doc.roundedRect(qrBoxX, qrBoxY, qrPanel, qrPanel, 10).strokeColor('#e2e8f0').lineWidth(0.65).stroke();

    const qrImgX = qrBoxX + (qrPanel - qrDraw) / 2;
    const qrImgY = qrBoxY + (qrPanel - qrDraw) / 2;
    doc.image(qrBuffer, qrImgX, qrImgY, { width: qrDraw, height: qrDraw });

    const textX = qrBoxX + qrPanel + 24;
    let textY = cardY + pad + 6;

    doc.font('Helvetica-Bold').fontSize(12).fillColor(COL.accent);
    doc.text('Gestor Parqueo', textX, textY);
    textY = doc.y + 4;
    doc.font('Helvetica-Oblique').fontSize(8.2).fillColor(COL.muted);
    doc.text('Identificación de acceso', textX, textY);
    textY += 20;

    textY = drawTagField(doc, textX, textY, 'Código', memCodigo);
    textY = drawTagField(doc, textX, textY, 'Cliente', clienteNombre);
    textY = drawTagField(doc, textX, textY, 'Placa', vehPlaca);
    drawTagField(doc, textX, textY, 'Vigencia', vigencia);

    doc.end();
  });
}
