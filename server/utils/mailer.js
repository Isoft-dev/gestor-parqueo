import nodemailer from 'nodemailer';

function readMailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;

  return {
    enabled: !!(host && port && user && pass && from),
    host,
    port,
    user,
    pass,
    from,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  };
}

export async function sendTagMail({ to, subject, text, filename, pdfBuffer }) {
  const cfg = readMailConfig();
  if (!cfg.enabled) {
    throw new Error(
      'Servicio de correo no configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM)'
    );
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transport.sendMail({
    from: cfg.from,
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
}

export async function sendPlainMail({ to, subject, text }) {
  const cfg = readMailConfig();
  if (!cfg.enabled) {
    throw new Error(
      'Servicio de correo no configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM)'
    );
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
  });
}
