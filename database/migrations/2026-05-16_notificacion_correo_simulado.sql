-- Bandeja de "Correos Simulados" para recordatorios de membresia.
--
-- Se agregan dos columnas a PAR_NOTIFICACION para guardar el contenido
-- del correo "enviado" cuando el sistema corre en modo MAIL_MODE=simulate
-- (no hay servidor SMTP real). Tambien se llenan cuando el envio es real,
-- para mantener trazabilidad del mensaje exacto que recibio el cliente.
--
-- - NOT_ASUNTO : asunto del correo
-- - NOT_CUERPO : cuerpo (texto plano) del correo. Se usa CLOB por flexibilidad.

ALTER TABLE PAR_NOTIFICACION ADD (
  NOT_ASUNTO VARCHAR2(200),
  NOT_CUERPO CLOB
);
