import nodemailer from 'nodemailer';

/**
 * Modos soportados (variable de entorno MAIL_MODE):
 *   - 'simulate' : NO se envia correo real. Devuelve { simulated: true }.
 *                  Pensado para defensas/demos sin servidor SMTP.
 *   - 'smtp'     : Envia con nodemailer usando SMTP_HOST/PORT/USER/PASS.
 *   - (vacio)    : auto-detecta. Si hay credenciales SMTP completas usa 'smtp';
 *                  si faltan, cae a 'simulate' en lugar de fallar.
 */
function readMailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  const declared = String(process.env.MAIL_MODE || '').toLowerCase().trim();

  const smtpReady = !!(host && port && user && pass && from);
  let mode;
  if (declared === 'simulate' || declared === 'smtp') mode = declared;
  else mode = smtpReady ? 'smtp' : 'simulate';

  return {
    mode,
    smtpReady,
    host,
    port,
    user,
    pass,
    from,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  };
}

export function isSimulatedMail() {
  return readMailConfig().mode === 'simulate';
}

export function getMailMode() {
  return readMailConfig().mode;
}

async function sendViaSmtp(cfg, payload) {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transport.sendMail({ from: cfg.from, ...payload });
}

export async function sendTagMail({ to, subject, text, filename, pdfBuffer }) {
  const cfg = readMailConfig();
  if (cfg.mode === 'simulate') {
    // En modo simulado no adjuntamos PDF; este metodo se usa para enviar el tag.
    // Se deja registro en consola para trazabilidad.
    console.log(
      `[mailer:simulate] sendTagMail -> to=${to} subject="${subject}" filename=${filename}`,
    );
    return { simulated: true };
  }
  if (!cfg.smtpReady) {
    throw new Error(
      'Servicio de correo no configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM)',
    );
  }
  await sendViaSmtp(cfg, {
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
  return { simulated: false };
}

export async function sendPlainMail({ to, subject, text }) {
  const cfg = readMailConfig();
  if (cfg.mode === 'simulate') {
    console.log(
      `[mailer:simulate] sendPlainMail -> to=${to} subject="${subject}"`,
    );
    return { simulated: true };
  }
  if (!cfg.smtpReady) {
    throw new Error(
      'Servicio de correo no configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM)',
    );
  }
  await sendViaSmtp(cfg, { to, subject, text });
  return { simulated: false };
}
