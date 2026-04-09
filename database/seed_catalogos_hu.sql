-- DML de apoyo (no altera el DDL). El esquema de tablas/columnas es PAR_ENTIDADES.sql.
-- Ejecutar en Oracle si faltan filas equivalentes. Ajustar según su convención de nombres.

-- Estados de alerta (requeridos para PAR_ALERTA y botón «Asistencia» en cabinas)
INSERT INTO PAR_ESTADO_ALERTA (EAL_ESTADO, EAL_DESCRIPCION)
SELECT 'Pendiente', 'Sin atender' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ALERTA WHERE LOWER(EAL_ESTADO) LIKE '%pend%');

INSERT INTO PAR_ESTADO_ALERTA (EAL_ESTADO, EAL_DESCRIPCION)
SELECT 'Atendida', 'Ya gestionada' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ALERTA WHERE LOWER(EAL_ESTADO) LIKE '%atend%');

INSERT INTO PAR_ESTADO_ALERTA (EAL_ESTADO, EAL_DESCRIPCION)
SELECT 'Activa', 'Alerta vigente en panel' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ALERTA WHERE LOWER(EAL_ESTADO) LIKE '%activ%');

-- Estados de espacio: esporádico (sin reserva) y mensual (reservado)
INSERT INTO PAR_ESTADO_ESPACIO (EES_ESTADO)
SELECT 'Disponible' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ESPACIO e
    WHERE LOWER(e.EES_ESTADO) LIKE '%dispon%'
      AND LOWER(e.EES_ESTADO) NOT LIKE '%reserv%');

INSERT INTO PAR_ESTADO_ESPACIO (EES_ESTADO)
SELECT 'Ocupado' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ESPACIO e
    WHERE LOWER(e.EES_ESTADO) LIKE '%ocup%'
      AND LOWER(e.EES_ESTADO) NOT LIKE '%reserv%');

INSERT INTO PAR_ESTADO_ESPACIO (EES_ESTADO)
SELECT 'Reservado Libre' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ESPACIO e
    WHERE LOWER(e.EES_ESTADO) LIKE '%reserv%'
      AND (LOWER(e.EES_ESTADO) LIKE '%libre%' OR LOWER(e.EES_ESTADO) LIKE '%dispon%'));

INSERT INTO PAR_ESTADO_ESPACIO (EES_ESTADO)
SELECT 'Reservado Ocupado' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_ESTADO_ESPACIO e
    WHERE LOWER(e.EES_ESTADO) LIKE '%reserv%'
      AND LOWER(e.EES_ESTADO) LIKE '%ocup%');

-- Tipos de notificación: 4 recordatorios + suspensión (TNO_ID ordenado = etapas 0..3 en job)
INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
SELECT 'Recordatorio -3d', 'Tres días antes del vencimiento' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM PAR_TIPO_NOTIFICACION WHERE LOWER(TNO_TIPO) LIKE '%recordatorio%-3%');

INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
SELECT 'Recordatorio -2d', 'Dos días antes del vencimiento' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM PAR_TIPO_NOTIFICACION WHERE LOWER(TNO_TIPO) LIKE '%recordatorio%-2%');

INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
SELECT 'Recordatorio venc', 'Día del vencimiento' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM PAR_TIPO_NOTIFICACION WHERE LOWER(TNO_TIPO) LIKE '%venc%' AND LOWER(TNO_TIPO) LIKE '%record%');

INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
SELECT 'Recordatorio +1d', 'Día siguiente al vencimiento' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM PAR_TIPO_NOTIFICACION WHERE LOWER(TNO_TIPO) LIKE '%+1%');

INSERT INTO PAR_TIPO_NOTIFICACION (TNO_TIPO, TNO_DESCRIPCION)
SELECT 'Suspensión mora', 'Notificación de suspensión automática por mora' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM PAR_TIPO_NOTIFICACION WHERE LOWER(TNO_TIPO) LIKE '%susp%');

-- Tipo de alerta: saldo bajo en máquina (HU Viviana)
INSERT INTO PAR_TIPO_ALERTA (TAL_TIPO, TAL_DESCRIPCION)
SELECT 'Saldo bajo máquina', 'Efectivo por debajo del umbral en máquina de cobro' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_TIPO_ALERTA
    WHERE LOWER(TAL_TIPO) LIKE '%saldo%baj%'
       OR LOWER(TAL_TIPO) LIKE '%bajo%saldo%');

-- Tipo de alerta: procesos automáticos / sistema
INSERT INTO PAR_TIPO_ALERTA (TAL_TIPO, TAL_DESCRIPCION)
SELECT 'Sistema', 'Alertas generadas por procesos automáticos o fallos de integración' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_TIPO_ALERTA WHERE LOWER(TAL_TIPO) LIKE '%sistem%');

-- Cabinas / máquinas: solicitud de asistencia (HU Jorge / Viviana)
INSERT INTO PAR_TIPO_ALERTA (TAL_TIPO, TAL_DESCRIPCION)
SELECT 'Asistencia cabina', 'Solicitud de asistencia desde máquina de entrada, salida o cobro' FROM DUAL
 WHERE NOT EXISTS (
   SELECT 1 FROM PAR_TIPO_ALERTA
    WHERE LOWER(TAL_TIPO) LIKE '%asist%'
       OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%asist%');

COMMIT;
