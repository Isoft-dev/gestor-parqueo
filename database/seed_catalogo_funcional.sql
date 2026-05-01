-- =============================================================================
-- SEED: Catálogo funcional (presentación / carga inicial)
-- =============================================================================
-- Ejecutar contra el esquema Oracle donde existan las tablas PAR_* (p. ej.
-- tras PAR_ENTIDADES / migraciones). Cada bloque es idempotente (IF c = 0 …).
--
-- Contrato con el backend (validaciones por subcadena en texto):
--   - Estados de ticket: deben contener palabras clave (activ, pagad, venc,
--     volver+cobr, extrav, valid) según ticket.js.
--   - Incidente «Ticket extraviado»: INC_TIPO o INC_DESCRIPCION debe contener
--     «extrav» (ticket.js → findIncidenteTicketExtraviadoIdTx).
--   - Alertas nuevas: estado Pendiente (LIKE %pend%); atendida resuelve con
--     LIKE %atendid% / %resuelt% (ticket.js).
--   - Tipo alerta «Sistema»: LIKE %sistem% (systemAlert.js).
--   - Tipo alerta asistencia: LIKE %asist% (alerta.js).
--   - Tipo alerta «Saldo bajo máquina»: nombre o descripción con «saldo»+«baj»
--     (o «bajo»+«saldo») — cashMachine.js al evaluar umbral en máquina de cobro.
--   - PAR_TIPO_NOTIFICACION: recordatorios de membresía y «Suspensión mora»
--     (jobMembershipTasks.js — cron / jobs de membresía).
--
-- Usuarios demo: admin@gmail.com / empleado@gmail.com — contraseña 1234.
-- El API acepta contraseña en texto plano si USU_PASSWORD no empieza por
-- «scrypt$» (server/services/usuario.js → verifyPassword).
--
-- Umbrales Q5/Q10/Q20/Q50: aquí solo se cargan PAR_SALDO_DISPONIBLE; los
-- DSA_UMBRAL_MINIMO por máquina los crea el flujo de máquina de cobro.
-- =============================================================================

DECLARE
  c        NUMBER;
  n        NUMBER;
  disp     NUMBER;
  ees_disp NUMBER;
BEGIN
  ---------------------------------------------------------------------------
  -- PAR_ESTADO_ESPACIO (requerido antes de PAR_ESPACIO)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = 'Disponible';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_ESPACIO (EES_ID, EES_ESTADO) VALUES (DEFAULT, 'Disponible'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = 'Ocupado';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_ESPACIO (EES_ID, EES_ESTADO) VALUES (DEFAULT, 'Ocupado'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = 'Reservado Libre';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_ESPACIO (EES_ID, EES_ESTADO) VALUES (DEFAULT, 'Reservado Libre'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = 'Reservado Ocupado';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_ESPACIO (EES_ID, EES_ESTADO) VALUES (DEFAULT, 'Reservado Ocupado'); END IF;

  ---------------------------------------------------------------------------
  -- PAR_ESTADO_ALERTA
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ALERTA WHERE EAL_ESTADO = 'Pendiente';
  IF c = 0 THEN
    INSERT INTO PAR_ESTADO_ALERTA (EAL_ID, EAL_ESTADO, EAL_DESCRIPCION) VALUES (DEFAULT, 'Pendiente', 'Sin atender');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_ALERTA WHERE EAL_ESTADO = 'Atendida';
  IF c = 0 THEN
    INSERT INTO PAR_ESTADO_ALERTA (EAL_ID, EAL_ESTADO, EAL_DESCRIPCION) VALUES (DEFAULT, 'Atendida', 'Gestionada por operador');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_TIPO_ALERTA
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TIPO_ALERTA WHERE TAL_TIPO = 'Asistencia cabina';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_ALERTA (TAL_ID, TAL_TIPO, TAL_DESCRIPCION)
    VALUES (DEFAULT, 'Asistencia cabina', 'Solicitud desde cabina de entrada, salida o cobro');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_ALERTA WHERE TAL_TIPO = 'Sistema';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_ALERTA (TAL_ID, TAL_TIPO, TAL_DESCRIPCION)
    VALUES (DEFAULT, 'Sistema', 'Alertas automáticas o integración');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_ALERTA WHERE TAL_TIPO = 'Saldo bajo máquina';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_ALERTA (TAL_ID, TAL_TIPO, TAL_DESCRIPCION)
    VALUES (DEFAULT, 'Saldo bajo máquina', 'Efectivo por debajo del umbral en máquina de cobro');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_TIPO_NOTIFICACION (jobs de membresía; mismos TNO_TIPO que seed_catalogos_hu.sql)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = 'Recordatorio -3d';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
    VALUES (DEFAULT, 'Recordatorio -3d', 'Tres días antes del vencimiento');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = 'Recordatorio -2d';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
    VALUES (DEFAULT, 'Recordatorio -2d', 'Dos días antes del vencimiento');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = 'Recordatorio venc';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
    VALUES (DEFAULT, 'Recordatorio venc', 'Día del vencimiento');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = 'Recordatorio +1d';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
    VALUES (DEFAULT, 'Recordatorio +1d', 'Día siguiente al vencimiento');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_NOTIFICACION WHERE TNO_TIPO = 'Suspensión mora';
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
    VALUES (DEFAULT, 'Suspensión mora', 'Notificación de suspensión automática por mora');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_ROL
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_ROL WHERE ROL_TIPO = 'Administrador';
  IF c = 0 THEN
    INSERT INTO PAR_ROL (ROL_ID, ROL_TIPO, ROL_DESCRIPCION)
    VALUES (DEFAULT, 'Administrador', 'Gestiona el sistema');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_ROL WHERE ROL_TIPO = 'Empleado';
  IF c = 0 THEN
    INSERT INTO PAR_ROL (ROL_ID, ROL_TIPO, ROL_DESCRIPCION)
    VALUES (DEFAULT, 'Empleado', 'Temporal; presentación');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_USUARIO (contraseña en plano 1234 — válido con verifyPassword del API)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_USUARIO WHERE LOWER(TRIM(USU_CORREO)) = 'admin@gmail.com';
  IF c = 0 THEN
    INSERT INTO PAR_USUARIO (
      USU_ID, USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD, ROL_ID, USU_ACTIVO, USU_FECHA_CREACION
    ) VALUES (
      DEFAULT, 'Admin', 'Sistema', 'admin@gmail.com', '1234',
      (SELECT MIN(ROL_ID) FROM PAR_ROL WHERE ROL_TIPO = 'Administrador'), 1, SYSDATE
    );
  END IF;

  SELECT COUNT(*) INTO c FROM PAR_USUARIO WHERE LOWER(TRIM(USU_CORREO)) = 'empleado@gmail.com';
  IF c = 0 THEN
    INSERT INTO PAR_USUARIO (
      USU_ID, USU_PRIMER_NOMBRE, USU_PRIMER_APELLIDO, USU_CORREO, USU_PASSWORD, ROL_ID, USU_ACTIVO, USU_FECHA_CREACION
    ) VALUES (
      DEFAULT, 'Empleado', 'Demo', 'empleado@gmail.com', '1234',
      (SELECT MIN(ROL_ID) FROM PAR_ROL WHERE ROL_TIPO = 'Empleado'), 1, SYSDATE
    );
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_ESTADO_TICKET (orden alfabético no requerido; nombres fijos HU)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Activo';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Activo'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Pagado';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Pagado'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Vencido';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Vencido'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Volver a cobrar';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Volver a cobrar'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Extraviado';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Extraviado'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_TICKET WHERE ETI_ESTADO = 'Validado';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_TICKET (ETI_ID, ETI_ESTADO) VALUES (DEFAULT, 'Validado'); END IF;

  ---------------------------------------------------------------------------
  -- PAR_INCIDENTE (Ticket extraviado primero: único matcheo «extrav» recurrente)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_INCIDENTE
   WHERE LOWER(INC_TIPO) LIKE '%extrav%' OR LOWER(NVL(INC_DESCRIPCION, '')) LIKE '%extrav%';
  IF c = 0 THEN
    INSERT INTO PAR_INCIDENTE (INC_ID, INC_TIPO, INC_DESCRIPCION)
    VALUES (DEFAULT, 'Ticket extraviado', 'Bitácora y recargo por ticket extraviado al cobrar');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_INCIDENTE WHERE INC_TIPO = 'Choque';
  IF c = 0 THEN
    INSERT INTO PAR_INCIDENTE (INC_ID, INC_TIPO, INC_DESCRIPCION) VALUES (DEFAULT, 'Choque', 'Catálogo sin lógica automática');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_INCIDENTE WHERE INC_TIPO = 'Estacionamiento';
  IF c = 0 THEN
    INSERT INTO PAR_INCIDENTE (INC_ID, INC_TIPO, INC_DESCRIPCION) VALUES (DEFAULT, 'Estacionamiento', 'Catálogo sin lógica automática');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_ESTADO_MEMBRESIA / PAR_TIPO_MEMBRESIA
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_MEMBRESIA WHERE EME_ESTADO = 'Activa';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_MEMBRESIA (EME_ID, EME_ESTADO) VALUES (DEFAULT, 'Activa'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_MEMBRESIA WHERE EME_ESTADO = 'Suspendida';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_MEMBRESIA (EME_ID, EME_ESTADO) VALUES (DEFAULT, 'Suspendida'); END IF;

  SELECT COUNT(*) INTO c FROM PAR_TIPO_MEMBRESIA WHERE TME_TIPO = 'Mensual' AND NVL(TME_PRECIO, -1) = 350;
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_MEMBRESIA (TME_ID, TME_TIPO, TME_DURACION, TME_PRECIO, TME_DESCRIPCION)
    VALUES (DEFAULT, 'Mensual', 30, 350, 'Mensual – Q350.00');
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_MEMBRESIA WHERE TME_TIPO = 'Anual' AND NVL(TME_PRECIO, -1) = 3800;
  IF c = 0 THEN
    INSERT INTO PAR_TIPO_MEMBRESIA (TME_ID, TME_TIPO, TME_DURACION, TME_PRECIO, TME_DESCRIPCION)
    VALUES (DEFAULT, 'Anual', 365, 3800, 'Anual – Q3800.00');
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_TIPO_COBRO / PAR_TIPO_PAGO
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TIPO_COBRO WHERE TCO_TIPO = 'Efectivo';
  IF c = 0 THEN INSERT INTO PAR_TIPO_COBRO (TCO_ID, TCO_TIPO, TCO_DESCRIPCION) VALUES (DEFAULT, 'Efectivo', 'Cobro en efectivo'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_COBRO WHERE TCO_TIPO = 'Tarjeta';
  IF c = 0 THEN INSERT INTO PAR_TIPO_COBRO (TCO_ID, TCO_TIPO, TCO_DESCRIPCION) VALUES (DEFAULT, 'Tarjeta', 'Cobro con tarjeta'); END IF;

  SELECT COUNT(*) INTO c FROM PAR_TIPO_PAGO WHERE TPA_TIPO = 'Efectivo';
  IF c = 0 THEN INSERT INTO PAR_TIPO_PAGO (TPA_ID, TPA_TIPO, TPA_DESCRIPCION) VALUES (DEFAULT, 'Efectivo', 'Pago en efectivo'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_PAGO WHERE TPA_TIPO = 'Tarjeta';
  IF c = 0 THEN INSERT INTO PAR_TIPO_PAGO (TPA_ID, TPA_TIPO, TPA_DESCRIPCION) VALUES (DEFAULT, 'Tarjeta', 'Pago con tarjeta'); END IF;

  ---------------------------------------------------------------------------
  -- PAR_TIPO_MAQUINA / PAR_ESTADO_MAQUINA
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TIPO_MAQUINA WHERE LOWER(TMA_TIPO) = 'entrada';
  IF c = 0 THEN INSERT INTO PAR_TIPO_MAQUINA (TMA_ID, TMA_TIPO, TMA_DESCRIPCION) VALUES (DEFAULT, 'Entrada', 'Cabina de entrada'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_MAQUINA WHERE LOWER(TMA_TIPO) = 'salida';
  IF c = 0 THEN INSERT INTO PAR_TIPO_MAQUINA (TMA_ID, TMA_TIPO, TMA_DESCRIPCION) VALUES (DEFAULT, 'Salida', 'Cabina de salida'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_MAQUINA WHERE LOWER(TMA_TIPO) = 'cobro';
  IF c = 0 THEN INSERT INTO PAR_TIPO_MAQUINA (TMA_ID, TMA_TIPO, TMA_DESCRIPCION) VALUES (DEFAULT, 'Cobro', 'Máquina de cobro'); END IF;

  SELECT COUNT(*) INTO c FROM PAR_ESTADO_MAQUINA WHERE EMA_ESTADO = 'Operativa';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION) VALUES (DEFAULT, 'Operativa', 'En servicio; flujo principal'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_MAQUINA WHERE EMA_ESTADO = 'Mantenimiento';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION) VALUES (DEFAULT, 'Mantenimiento', 'Mantenimiento programado'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_ESTADO_MAQUINA WHERE EMA_ESTADO = 'Fuera de servicio';
  IF c = 0 THEN INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION) VALUES (DEFAULT, 'Fuera de servicio', 'No disponible'); END IF;

  ---------------------------------------------------------------------------
  -- PAR_SALDO_DISPONIBLE (denominaciones; umbrales en PAR_DETALLE_SALDO al configurar cobro)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_SALDO_DISPONIBLE WHERE SDI_VALOR = 5;
  IF c = 0 THEN INSERT INTO PAR_SALDO_DISPONIBLE (SDI_ID, SDI_TIPO, SDI_VALOR) VALUES (DEFAULT, 'Q5', 5); END IF;
  SELECT COUNT(*) INTO c FROM PAR_SALDO_DISPONIBLE WHERE SDI_VALOR = 10;
  IF c = 0 THEN INSERT INTO PAR_SALDO_DISPONIBLE (SDI_ID, SDI_TIPO, SDI_VALOR) VALUES (DEFAULT, 'Q10', 10); END IF;
  SELECT COUNT(*) INTO c FROM PAR_SALDO_DISPONIBLE WHERE SDI_VALOR = 20;
  IF c = 0 THEN INSERT INTO PAR_SALDO_DISPONIBLE (SDI_ID, SDI_TIPO, SDI_VALOR) VALUES (DEFAULT, 'Q20', 20); END IF;
  SELECT COUNT(*) INTO c FROM PAR_SALDO_DISPONIBLE WHERE SDI_VALOR = 50;
  IF c = 0 THEN INSERT INTO PAR_SALDO_DISPONIBLE (SDI_ID, SDI_TIPO, SDI_VALOR) VALUES (DEFAULT, 'Q50', 50); END IF;

  ---------------------------------------------------------------------------
  -- PAR_TARIFA
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TARIFA WHERE TAR_TIPO = 'Esporádico hora' AND NVL(TAR_PRECIO, -1) = 10 AND NVL(TAR_TIEMPO_GRACIA, -1) = 15;
  IF c = 0 THEN
    INSERT INTO PAR_TARIFA (TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA)
    VALUES (DEFAULT, 'Esporádico hora', 10, 15);
  END IF;
  SELECT COUNT(*) INTO c FROM PAR_TARIFA WHERE TAR_TIPO = 'Esporádico fin de semana' AND NVL(TAR_PRECIO, -1) = 20 AND NVL(TAR_TIEMPO_GRACIA, -1) = 15;
  IF c = 0 THEN
    INSERT INTO PAR_TARIFA (TAR_ID, TAR_TIPO, TAR_PRECIO, TAR_TIEMPO_GRACIA)
    VALUES (DEFAULT, 'Esporádico fin de semana', 20, 15);
  END IF;

  ---------------------------------------------------------------------------
  -- PAR_TIPO_VEHICULO (sin tilde: Automovil)
  ---------------------------------------------------------------------------
  SELECT COUNT(*) INTO c FROM PAR_TIPO_VEHICULO WHERE TVE_TIPO = 'Automovil';
  IF c = 0 THEN INSERT INTO PAR_TIPO_VEHICULO (TVE_ID, TVE_TIPO, TVE_DESCRIPCION) VALUES (DEFAULT, 'Automovil', 'Vehículo cuatro ruedas'); END IF;
  SELECT COUNT(*) INTO c FROM PAR_TIPO_VEHICULO WHERE TVE_TIPO = 'Moto';
  IF c = 0 THEN INSERT INTO PAR_TIPO_VEHICULO (TVE_ID, TVE_TIPO, TVE_DESCRIPCION) VALUES (DEFAULT, 'Moto', 'Motocicleta'); END IF;

  ---------------------------------------------------------------------------
  -- PAR_ESPACIO: al menos 500 filas en estado «Disponible» (EES_ESTADO exacto)
  ---------------------------------------------------------------------------
  SELECT MIN(EES_ID) INTO ees_disp FROM PAR_ESTADO_ESPACIO WHERE EES_ESTADO = 'Disponible';

  SELECT COUNT(*) INTO disp
    FROM PAR_ESPACIO e
    JOIN PAR_ESTADO_ESPACIO es ON es.EES_ID = e.EES_ID
   WHERE es.EES_ESTADO = 'Disponible';

  IF disp < 500 THEN
    SELECT COUNT(*) INTO n FROM PAR_ESPACIO;
    FOR i IN 1 .. (500 - disp) LOOP
      n := n + 1;
      INSERT INTO PAR_ESPACIO (ESP_ID, ESP_CODIGO, EES_ID, ESP_UBICACION)
      VALUES (DEFAULT, 'CAT-' || LPAD(TO_CHAR(n), 5, '0'), ees_disp, 'Capacidad inicial');
    END LOOP;
  END IF;

END;
/
