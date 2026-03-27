import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export function buildMemCodigo(memId, when = new Date()) {
  const d = String(when.getDate()).padStart(2, '0');
  const m = String(when.getMonth() + 1).padStart(2, '0');
  const y = String(when.getFullYear()).slice(-2);
  return `${d}${m}${y}${String(memId)}`.slice(0, 25);
}

export async function buildTagPdfBuffer({
  memCodigo,
  clienteNombre,
  vehPlaca,
  planNombre,
  vigencia,
}) {
  const qrDataUrl = await QRCode.toDataURL(memCodigo, { margin: 1, scale: 6 });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBuffer = Buffer.from(qrBase64, 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text('Tag de Cliente Mensual', { align: 'center' });
    doc.moveDown(0.8);

    doc.roundedRect(50, 110, 495, 220, 12).stroke('#374151');
    doc.image(qrBuffer, 75, 145, { fit: [180, 180] });

    doc.fontSize(12).fillColor('#111827');
    doc.text(`Codigo: ${memCodigo}`, 280, 155);
    doc.text(`Cliente: ${clienteNombre || 'N/D'}`, 280, 185);
    doc.text(`Placa: ${vehPlaca || 'N/D'}`, 280, 215);
    doc.text(`Membresia: ${planNombre || 'N/D'}`, 280, 245);
    doc.text(`Vigencia: ${vigencia || 'N/D'}`, 280, 275);

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#6B7280');
    doc.text('Este documento identifica la membresia mensual del parqueo.', 50, 360);

    doc.end();
  });
}
