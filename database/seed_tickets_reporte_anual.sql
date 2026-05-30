-- =============================================================================
-- SEED: Tickets esporádicos (entrada + salida + cobro) para reportes ~1 año
-- =============================================================================
-- Prerrequisitos:
--   - Tablas PAR_* creadas; catálogos mínimos cargados (seed_catalogo_funcional.sql).
--   - PAR_TARIFA con precio por hora y TAR_TIEMPO_GRACIA (p. ej. esporádico 15 min).
--   - PAR_ESTADO_TICKET con estados «Pagado» (LIKE %pagad%) y «Validado» (LIKE %valid%).
--   - PAR_TIPO_COBRO «Efectivo», PAR_MODELO_VEHICULO y PAR_COLOR_VEHICULO con datos.
--   - PAR_MAQUINA: Entrada_1, Cobro_1 y Salida_1.
--     seed_catalogo_funcional.sql las crea automaticamente si no existen.
--     Una vez creadas estas 3, puedes agregar las demas que desees.
--
-- Convención SIN borrar datos existentes (no DELETE/TRUNCATE):
--   - Placas nuevas: formato R###### (7 caracteres: R + 6 dígitos), compatible con columnas VARCHAR2(7).
--     El número continúa después del mayor R###### ya presente en PAR_VEHICULO.
--   - TIC_CODIGO: mismo criterio que buildTicketCodigo en server (DDMMYYHH24MI + placa sin guiones).
--   Re-ejecutar el script añade OTRO lote de tickets (no limpia tablas).
--
-- Modelo de cobro (alineado a server/services/ticket.js al cobrar):
--   minutos_totales = (salida - entrada) en minutos
--   minutos_facturables = GREATEST(0, minutos_totales - TAR_TIEMPO_GRACIA)
--   COB_HORAS_TOTALES = ROUND(minutos_facturables / 60, 2)
--   horas_para_tarifa = CEIL(minutos_facturables / 60)
--   monto_bruto = horas_para_tarifa * TAR_PRECIO
--   Si política mínimo &lt; 1 h habilitada y 0 &lt; minutos_facturables &lt; 60:
--       monto = GREATEST(monto_bruto, MÍNIMO_Q)
--   Si minutos_facturables = 0 (solo gracia), el bucle omite el ticket (sin cobro).
--
-- Ajustes en cabecera del bloque DECLARE: cantidad de tickets, ventana temporal, mínimo Q.
-- =============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  c_seeded       NUMBER;
  v_mod_id       NUMBER;
  v_col_id       NUMBER;
  v_eti_pagado   NUMBER;
  v_eti_validado NUMBER;
  v_tco_id       NUMBER;
  v_tar_id       NUMBER;
  v_precio       NUMBER;
  v_gracia       NUMBER;

  v_day0         DATE := TRUNC(SYSDATE) - 365;
  v_day1         DATE := TRUNC(SYSDATE);

  v_entrada      TIMESTAMP;
  v_salida       TIMESTAMP;
  dur_min        NUMBER;
  fact_min       NUMBER;
  frac_horas     NUMBER;
  h_ceil         NUMBER;
  monto_bruto    NUMBER;
  monto_cob      NUMBER;
  cob_horas      NUMBER;
  v_rec          NUMBER;
  v_vuelto       NUMBER;

  v_placa        VARCHAR2(20);
  v_codigo       VARCHAR2(64);
  v_veh_id       NUMBER;
  v_tic_id       NUMBER;
  v_cli_id       NUMBER;

  v_nit          VARCHAR2(32);
  v_cmp_nit      VARCHAR2(64);

  k_target       CONSTANT PLS_INTEGER := 1100;
  v_minimo_q     CONSTANT NUMBER := 5;
  v_minimo_on    CONSTANT BOOLEAN := TRUE;

  r_slot         NUMBER;
  r_dur          NUMBER;
  r_w            NUMBER;
  day_frac       NUMBER;
  pick_day       DATE;
  mins_day       NUMBER;
  v_dow          VARCHAR2(12);
  v_found        BOOLEAN;
  v_inserted     PLS_INTEGER := 0;
  v_placa_base   NUMBER;

  v_maq_ent      NUMBER;
  v_maq_cob      NUMBER;
  v_maq_sal      NUMBER;
  v_fh_ent       DATE;
  v_fh_sal       DATE;
  v_fh_cob       DATE;
  v_proc_maq     NUMBER;
  v_cli_nom      VARCHAR2(30);
  v_cli_ape1     VARCHAR2(30);
  v_cli_ape2     VARCHAR2(30);

  TYPE t_nom_arr IS VARRAY(16) OF VARCHAR2(30);
  v_nombres t_nom_arr := t_nom_arr(
    'Alejandro', 'Maria', 'Diego', 'Sofia',
    'Javier', 'Andrea', 'Fernando', 'Paola',
    'Ricardo', 'Gabriela', 'Manuel', 'Valeria',
    'Carlos', 'Lucia', 'Roberto', 'Daniela'
  );
  v_apellidos t_nom_arr := t_nom_arr(
    'Garcia', 'Lopez', 'Morales', 'Perez',
    'Rodriguez', 'Martinez', 'Gonzalez', 'Hernandez',
    'Reyes', 'Castillo', 'Flores', 'Vasquez',
    'Ramirez', 'Torres', 'Jimenez', 'Ortiz'
  );

  ---------------------------------------------------------------------------
  -- Máquinas: Entrada_1 / Cobro_1 / Salida_1 (tu esquema), si no por tipo, si no 1/2/3
  ---------------------------------------------------------------------------
  PROCEDURE resolve_maquinas IS
  BEGIN
    BEGIN
      SELECT MAQ_ID INTO v_maq_ent FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'ENTRADA_1';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        BEGIN
          SELECT MIN(m.MAQ_ID)
            INTO v_maq_ent
            FROM PAR_MAQUINA m
            JOIN PAR_TIPO_MAQUINA t ON t.TMA_ID = m.TMA_ID
           WHERE LOWER(TRIM(NVL(t.TMA_TIPO, ''))) = 'entrada';
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_maq_ent := NULL;
        END;
        IF v_maq_ent IS NULL THEN
          BEGIN
            SELECT MAQ_ID INTO v_maq_ent FROM PAR_MAQUINA WHERE MAQ_ID = 1;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              NULL;
          END;
        END IF;
    END;

    BEGIN
      SELECT MAQ_ID INTO v_maq_cob FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'COBRO_1';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        BEGIN
          SELECT MIN(m.MAQ_ID)
            INTO v_maq_cob
            FROM PAR_MAQUINA m
            JOIN PAR_TIPO_MAQUINA t ON t.TMA_ID = m.TMA_ID
           WHERE LOWER(TRIM(NVL(t.TMA_TIPO, ''))) = 'cobro';
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_maq_cob := NULL;
        END;
        IF v_maq_cob IS NULL THEN
          BEGIN
            SELECT MAQ_ID INTO v_maq_cob FROM PAR_MAQUINA WHERE MAQ_ID = 2;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              NULL;
          END;
        END IF;
    END;

    BEGIN
      SELECT MAQ_ID INTO v_maq_sal FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'SALIDA_1';
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        BEGIN
          SELECT MIN(m.MAQ_ID)
            INTO v_maq_sal
            FROM PAR_MAQUINA m
            JOIN PAR_TIPO_MAQUINA t ON t.TMA_ID = m.TMA_ID
           WHERE LOWER(TRIM(NVL(t.TMA_TIPO, ''))) = 'salida';
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_maq_sal := NULL;
        END;
        IF v_maq_sal IS NULL THEN
          BEGIN
            SELECT MAQ_ID INTO v_maq_sal FROM PAR_MAQUINA WHERE MAQ_ID = 3;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              NULL;
          END;
        END IF;
    END;
  END resolve_maquinas;

BEGIN
  SELECT COUNT(*) INTO c_seeded FROM PAR_TARIFA;
  IF c_seeded = 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'PAR_TARIFA vacío: cargue tarifas antes del seed.');
  END IF;

  BEGIN
    SELECT TAR_ID, TAR_PRECIO, NVL(TAR_TIEMPO_GRACIA, 0)
      INTO v_tar_id, v_precio, v_gracia
      FROM PAR_TARIFA
     WHERE UPPER(NVL(TAR_TIPO, '')) LIKE '%ESPOR%'
     FETCH FIRST 1 ROW ONLY;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      SELECT TAR_ID, TAR_PRECIO, NVL(TAR_TIEMPO_GRACIA, 0)
        INTO v_tar_id, v_precio, v_gracia
        FROM PAR_TARIFA
       ORDER BY TAR_ID
       FETCH FIRST 1 ROW ONLY;
  END;

  SELECT MIN(MOD_ID) INTO v_mod_id FROM PAR_MODELO_VEHICULO;
  IF v_mod_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20002, 'PAR_MODELO_VEHICULO vacío.');
  END IF;

  SELECT MIN(COL_ID) INTO v_col_id FROM PAR_COLOR_VEHICULO;
  IF v_col_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20008, 'PAR_COLOR_VEHICULO vacío.');
  END IF;

  SELECT MIN(ETI_ID) INTO v_eti_pagado
    FROM PAR_ESTADO_TICKET
   WHERE LOWER(NVL(ETI_ESTADO, '')) LIKE '%pagad%';
  IF v_eti_pagado IS NULL THEN
    RAISE_APPLICATION_ERROR(-20003, 'No hay estado de ticket «Pagado» (LIKE %pagad%).');
  END IF;

  SELECT MIN(ETI_ID) INTO v_eti_validado
    FROM PAR_ESTADO_TICKET
   WHERE LOWER(NVL(ETI_ESTADO, '')) LIKE '%valid%';
  IF v_eti_validado IS NULL THEN
    RAISE_APPLICATION_ERROR(-20007, 'No hay estado de ticket «Validado» (LIKE %valid%).');
  END IF;

  SELECT MIN(TCO_ID) INTO v_tco_id
    FROM PAR_TIPO_COBRO
   WHERE LOWER(NVL(TCO_TIPO, '')) LIKE '%efect%';
  IF v_tco_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20004, 'No hay PAR_TIPO_COBRO «Efectivo».');
  END IF;

  -- Siguiente correlativo para placas R###### (7 caracteres máx.)
  SELECT NVL(MAX(TO_NUMBER(SUBSTR(VEH_PLACA, 2))), 0)
    INTO v_placa_base
    FROM PAR_VEHICULO
   WHERE LENGTH(VEH_PLACA) = 7
     AND SUBSTR(VEH_PLACA, 1, 1) = 'R'
     AND REGEXP_LIKE(SUBSTR(VEH_PLACA, 2), '^[0-9]{6}$');

  IF v_placa_base + k_target > 999999 THEN
    RAISE_APPLICATION_ERROR(
      -20005,
      'No hay números libres en placas R###### (máx. 999999). Reduzca k_target o libere placas.'
    );
  END IF;

  DBMS_OUTPUT.PUT_LINE('Seed tickets: TAR_ID=' || v_tar_id || ' precio=' || v_precio ||
                       ' gracia_min=' || v_gracia || ' ventana ' ||
                       TO_CHAR(v_day0, 'YYYY-MM-DD') || ' .. ' || TO_CHAR(v_day1, 'YYYY-MM-DD'));
  DBMS_OUTPUT.PUT_LINE('Placas R###### desde ' || TO_CHAR(v_placa_base + 1) || ' (sin borrar datos previos).');

  resolve_maquinas;
  IF v_maq_ent IS NULL OR v_maq_cob IS NULL OR v_maq_sal IS NULL THEN
    RAISE_APPLICATION_ERROR(
      -20006,
      'No se resolvieron máquinas entrada/cobro/salida (Entrada_1, Cobro_1, Salida_1 o tipos entrada/cobro/salida).'
    );
  END IF;
  DBMS_OUTPUT.PUT_LINE(
    'Máquinas DMT: entrada MAQ_ID=' || v_maq_ent || ', cobro MAQ_ID=' || v_maq_cob ||
    ', salida MAQ_ID=' || v_maq_sal
  );

  FOR i IN 1 .. k_target LOOP
    v_found := FALSE;
    FOR tries IN 1 .. 80 LOOP
      day_frac := DBMS_RANDOM.VALUE(0, 1 + (v_day1 - v_day0));
      pick_day := v_day0 + TRUNC(day_frac);

      v_dow := LOWER(RTRIM(TO_CHAR(pick_day, 'Dy', 'NLS_DATE_LANGUAGE = AMERICAN')));
      r_w := DBMS_RANDOM.VALUE(0, 1);
      IF (v_dow = 'sun' AND r_w < 0.72) OR (v_dow = 'sat' AND r_w < 0.45) THEN
        CONTINUE;
      END IF;

      -- Hora de entrada: picos mañana / mediodía / tarde, pocas madrugadas
      r_slot := DBMS_RANDOM.VALUE(0, 1);
      IF r_slot < 0.22 THEN
        mins_day := TRUNC(DBMS_RANDOM.VALUE(7 * 60 + 0, 9 * 60 + 50));
      ELSIF r_slot < 0.52 THEN
        mins_day := TRUNC(DBMS_RANDOM.VALUE(10 * 60 + 30, 14 * 60 + 30));
      ELSIF r_slot < 0.88 THEN
        mins_day := TRUNC(DBMS_RANDOM.VALUE(16 * 60 + 0, 20 * 60 + 30));
      ELSIF r_slot < 0.96 THEN
        mins_day := TRUNC(DBMS_RANDOM.VALUE(6 * 60 + 0, 7 * 60 + 50));
      ELSE
        mins_day := TRUNC(DBMS_RANDOM.VALUE(20 * 60 + 30, 23 * 60 + 45));
      END IF;

      v_entrada := CAST(pick_day AS TIMESTAMP) + NUMTODSINTERVAL(mins_day / 1440, 'DAY');

      -- Duración estancia (minutos): mezcla cortas / medias / largas
      r_dur := DBMS_RANDOM.VALUE(0, 1);
      IF r_dur < 0.14 THEN
        dur_min := TRUNC(DBMS_RANDOM.VALUE(25, 56));
      ELSIF r_dur < 0.48 THEN
        dur_min := TRUNC(DBMS_RANDOM.VALUE(62, 185));
      ELSIF r_dur < 0.78 THEN
        dur_min := TRUNC(DBMS_RANDOM.VALUE(185, 330));
      ELSE
        dur_min := TRUNC(DBMS_RANDOM.VALUE(330, 520));
      END IF;

      v_salida := v_entrada + NUMTODSINTERVAL(dur_min / 1440, 'DAY');

      fact_min := GREATEST(0, dur_min - v_gracia);
      IF fact_min <= 0 THEN
        CONTINUE;
      END IF;

      frac_horas := fact_min / 60;
      h_ceil := CEIL(frac_horas);
      monto_bruto := h_ceil * v_precio;
      IF v_minimo_on AND fact_min < 60 THEN
        monto_cob := GREATEST(monto_bruto, v_minimo_q);
      ELSE
        monto_cob := monto_bruto;
      END IF;
      cob_horas := ROUND(frac_horas, 2);

      v_found := TRUE;
      EXIT;
    END LOOP;

    IF NOT v_found THEN
      CONTINUE;
    END IF;

    v_placa := 'R' || LPAD(TO_CHAR(v_placa_base + i), 6, '0');
    -- Igual que server/services/ticket.js buildTicketCodigo(placa, entrada)
    v_codigo :=
      TO_CHAR(CAST(v_entrada AS DATE), 'DDMMYYHH24MI') ||
      UPPER(TRIM(TRANSLATE(v_placa, '- ', CHR(45) || CHR(45))));
    SELECT MOD_ID
      INTO v_mod_id
      FROM (
        SELECT MOD_ID
          FROM PAR_MODELO_VEHICULO
         ORDER BY DBMS_RANDOM.VALUE
      )
     WHERE ROWNUM = 1;

    SELECT COL_ID
      INTO v_col_id
      FROM (
        SELECT COL_ID
          FROM PAR_COLOR_VEHICULO
         ORDER BY DBMS_RANDOM.VALUE
      )
     WHERE ROWNUM = 1;

    INSERT INTO PAR_VEHICULO (
      VEH_PLACA, MOD_ID, COL_ID, CLI_ID
    ) VALUES (
      v_placa, v_mod_id, v_col_id, NULL
    )
    RETURNING VEH_ID INTO v_veh_id;

    INSERT INTO PAR_TICKET (
      TIC_CODIGO, VEH_ID, TIC_FECHA_HORA_ENTRADA, TIC_FECHA_HORA_SALIDA, ETI_ID
    ) VALUES (
      v_codigo,
      v_veh_id,
      CAST(v_entrada AS DATE),
      CAST(v_salida AS DATE),
      v_eti_validado
    )
    RETURNING TIC_ID INTO v_tic_id;

    v_fh_ent := CAST(v_entrada AS DATE);
    v_fh_sal := CAST(v_salida AS DATE);
    IF v_gracia > 0 THEN
      v_fh_cob := v_fh_sal - NUMTODSINTERVAL(DBMS_RANDOM.VALUE(0, LEAST(v_gracia, 12)), 'MINUTE');
    ELSE
      v_fh_cob := v_fh_sal;
    END IF;
    IF v_fh_cob <= v_fh_ent THEN
      v_fh_cob := v_fh_ent + NUMTODSINTERVAL(1, 'MINUTE');
    END IF;
    IF v_fh_cob > v_fh_sal THEN
      v_fh_cob := v_fh_sal;
    END IF;

    -- ~14 % con NIT ficticio (factura); el resto anónimo (NULL), sin alta en PAR_CLIENTE
    IF DBMS_RANDOM.VALUE(0, 1) < 0.14 THEN
      v_nit := TO_CHAR(TRUNC(DBMS_RANDOM.VALUE(3000000, 99999999)));
    ELSE
      v_nit := NULL;
    END IF;

    IF v_nit IS NOT NULL THEN
      v_cmp_nit := REGEXP_REPLACE(UPPER(TRIM(v_nit)), '[^0-9A-Z]', '');
      BEGIN
        SELECT CLI_ID
          INTO v_cli_id
          FROM (
            SELECT CLI_ID
              FROM PAR_CLIENTE
             WHERE CLI_NIT IS NOT NULL
               AND REGEXP_REPLACE(UPPER(TRIM(CLI_NIT)), '[^0-9A-Z]', '') = v_cmp_nit
             ORDER BY CLI_ID DESC
          )
         WHERE ROWNUM = 1;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          v_cli_nom := v_nombres(MOD(i - 1, v_nombres.COUNT) + 1);
          v_cli_ape1 := v_apellidos(MOD(i + 3, v_apellidos.COUNT) + 1);
          v_cli_ape2 := v_apellidos(MOD(i + 9, v_apellidos.COUNT) + 1);

          INSERT INTO PAR_CLIENTE (
            CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
            CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
            CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
            CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
          ) VALUES (
            v_cli_nom, NULL,
            v_cli_ape1, v_cli_ape2,
            '7' || LPAD(SUBSTR(v_cmp_nit, 1, 12), 12, '0'), v_nit,
            'ticket.' || LOWER(v_cmp_nit) || CHR(64) || 'mail.demo',
            TO_CHAR(30000000 + MOD(i * 7919, 49999999)),
            'Zona ' || TO_CHAR(MOD(i, 18) + 1),
            TO_CHAR(MOD(i * 5, 20) + 1) || ' Avenida',
            TO_CHAR(MOD(i * 29, 200) + 1) || '-' || LPAD(TO_CHAR(MOD(i * 17, 90) + 1), 2, '0'),
            CASE MOD(i, 8)
              WHEN 0 THEN 'Colonia Centro America'
              WHEN 1 THEN 'Colonia Mariscal'
              WHEN 2 THEN 'Colonia La Reformita'
              WHEN 3 THEN 'Colonia Santa Elisa'
              WHEN 4 THEN 'Colonia El Naranjo'
              WHEN 5 THEN 'Colonia Primero de Julio'
              WHEN 6 THEN 'Colonia San Cristobal'
              ELSE 'Colonia Las Charcas'
            END,
            CASE MOD(i, 8)
              WHEN 0 THEN 'Guatemala'
              WHEN 1 THEN 'Mixco'
              WHEN 2 THEN 'Villa Nueva'
              WHEN 3 THEN 'San Miguel Petapa'
              WHEN 4 THEN 'Amatitlan'
              WHEN 5 THEN 'Santa Catarina Pinula'
              WHEN 6 THEN 'Quetzaltenango'
              ELSE 'Antigua Guatemala'
            END,
            CASE MOD(i, 8)
              WHEN 0 THEN '01001'
              WHEN 1 THEN '01057'
              WHEN 2 THEN '01064'
              WHEN 3 THEN '01066'
              WHEN 4 THEN '01063'
              WHEN 5 THEN '01051'
              WHEN 6 THEN '09001'
              ELSE '03001'
            END,
            1,
            SYSDATE
          )
          RETURNING CLI_ID INTO v_cli_id;
      END;

      UPDATE PAR_VEHICULO
         SET CLI_ID = v_cli_id
       WHERE VEH_ID = v_veh_id
         AND CLI_ID IS NULL;

      -- ~35 % de clientes esporadicos con ticket quedan sin NIT (consumidor final / dato pendiente)
      IF v_cli_id IS NOT NULL AND DBMS_RANDOM.VALUE(0, 1) < 0.35 THEN
        UPDATE PAR_CLIENTE
           SET CLI_NIT = NULL
         WHERE CLI_ID = v_cli_id;
      END IF;
    END IF;

    v_rec := monto_cob + TRUNC(DBMS_RANDOM.VALUE(0, 25));
    v_vuelto := ROUND(v_rec - monto_cob, 2);

    v_proc_maq := CASE WHEN DBMS_RANDOM.VALUE(0, 1) < 0.72 THEN 1 ELSE 0 END;

    INSERT INTO PAR_COBRO (
      TIC_ID,
      COB_NIT,
      COB_HORAS_TOTALES,
      TCO_ID,
      COB_MONTO_TOTAL,
      COB_MONTO_RECIBIDO,
      COB_VUELTO,
      COB_FECHA_HORA,
      COB_PROCESADO_MAQUINA,
      TAR_ID
    ) VALUES (
      v_tic_id,
      v_nit,
      cob_horas,
      v_tco_id,
      monto_cob,
      v_rec,
      v_vuelto,
      v_fh_cob,
      v_proc_maq,
      v_tar_id
    );

    INSERT INTO PAR_DETALLE_MAQUINA_TICKET (
      DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION
    ) VALUES (
      'GENERACION_TICKET', v_tic_id, v_maq_ent, v_fh_ent
    );

    INSERT INTO PAR_DETALLE_MAQUINA_TICKET (
      DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION
    ) VALUES (
      'PROCESAMIENTO_COBRO', v_tic_id, v_maq_cob, v_fh_cob
    );

    INSERT INTO PAR_DETALLE_MAQUINA_TICKET (
      DMT_TRANSACCION, TIC_ID, MAQ_ID, DMT_HORA_TRANSACCION
    ) VALUES (
      'REGISTRO_SALIDA', v_tic_id, v_maq_sal, v_fh_sal
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  COMMIT;

  -- Normaliza clientes de tickets creados por versiones anteriores del seed:
  -- nombres reales y DPI de 13 digitos, conservando NIT/correo/relaciones.
  UPDATE PAR_CLIENTE
     SET CLI_PRIMER_NOMBRE = CASE MOD(CLI_ID, 12)
                               WHEN 0 THEN 'Alejandro'
                               WHEN 1 THEN 'Maria'
                               WHEN 2 THEN 'Diego'
                               WHEN 3 THEN 'Sofia'
                               WHEN 4 THEN 'Javier'
                               WHEN 5 THEN 'Andrea'
                               WHEN 6 THEN 'Fernando'
                               WHEN 7 THEN 'Paola'
                               WHEN 8 THEN 'Ricardo'
                               WHEN 9 THEN 'Gabriela'
                               WHEN 10 THEN 'Manuel'
                               ELSE 'Valeria'
                             END,
         CLI_SEGUNDO_NOMBRE = NULL,
         CLI_PRIMER_APELLIDO = CASE MOD(CLI_ID, 12)
                                 WHEN 0 THEN 'Garcia'
                                 WHEN 1 THEN 'Lopez'
                                 WHEN 2 THEN 'Morales'
                                 WHEN 3 THEN 'Perez'
                                 WHEN 4 THEN 'Rodriguez'
                                 WHEN 5 THEN 'Martinez'
                                 WHEN 6 THEN 'Gonzalez'
                                 WHEN 7 THEN 'Hernandez'
                                 WHEN 8 THEN 'Reyes'
                                 WHEN 9 THEN 'Castillo'
                                 WHEN 10 THEN 'Flores'
                                 ELSE 'Vasquez'
                               END,
         CLI_SEGUNDO_APELLIDO = CASE MOD(CLI_ID, 8)
                                  WHEN 0 THEN 'Ramirez'
                                  WHEN 1 THEN 'Torres'
                                  WHEN 2 THEN 'Jimenez'
                                  WHEN 3 THEN 'Ortiz'
                                  WHEN 4 THEN 'Medina'
                                  WHEN 5 THEN 'Ruiz'
                                  WHEN 6 THEN 'Aguilar'
                                  ELSE 'Mendez'
                                END,
         CLI_DPI = '7' || LPAD(SUBSTR(REGEXP_REPLACE(UPPER(TRIM(NVL(CLI_NIT, SUBSTR(CLI_CORREO, 8, INSTR(CLI_CORREO, CHR(64)) - 8)))), '[^0-9A-Z]', ''), 1, 12), 12, '0'),
         CLI_TELEFONO = NVL(TRIM(CLI_TELEFONO), TO_CHAR(30000000 + MOD(CLI_ID * 7919, 49999999))),
         CLI_ZONA = NVL(TRIM(CLI_ZONA), 'Zona ' || TO_CHAR(MOD(CLI_ID, 18) + 1)),
         CLI_CALLE = NVL(TRIM(CLI_CALLE), TO_CHAR(MOD(CLI_ID * 5, 20) + 1) || ' Avenida'),
         CLI_NUMERO = NVL(TRIM(CLI_NUMERO), TO_CHAR(MOD(CLI_ID * 29, 200) + 1) || '-' || LPAD(TO_CHAR(MOD(CLI_ID * 17, 90) + 1), 2, '0')),
         CLI_COLONIA = NVL(TRIM(CLI_COLONIA), CASE MOD(CLI_ID, 8)
                                               WHEN 0 THEN 'Colonia Centro America'
                                               WHEN 1 THEN 'Colonia Mariscal'
                                               WHEN 2 THEN 'Colonia La Reformita'
                                               WHEN 3 THEN 'Colonia Santa Elisa'
                                               WHEN 4 THEN 'Colonia El Naranjo'
                                               WHEN 5 THEN 'Colonia Primero de Julio'
                                               WHEN 6 THEN 'Colonia San Cristobal'
                                               ELSE 'Colonia Las Charcas'
                                             END),
         CLI_CIUDAD = NVL(TRIM(CLI_CIUDAD), CASE MOD(CLI_ID, 8)
                                             WHEN 0 THEN 'Guatemala'
                                             WHEN 1 THEN 'Mixco'
                                             WHEN 2 THEN 'Villa Nueva'
                                             WHEN 3 THEN 'San Miguel Petapa'
                                             WHEN 4 THEN 'Amatitlan'
                                             WHEN 5 THEN 'Santa Catarina Pinula'
                                             WHEN 6 THEN 'Quetzaltenango'
                                             ELSE 'Antigua Guatemala'
                                           END),
         CLI_CODIGO_POSTAL = NVL(TRIM(CLI_CODIGO_POSTAL), CASE MOD(CLI_ID, 8)
                                                            WHEN 0 THEN '01001'
                                                            WHEN 1 THEN '01057'
                                                            WHEN 2 THEN '01064'
                                                            WHEN 3 THEN '01066'
                                                            WHEN 4 THEN '01063'
                                                            WHEN 5 THEN '01051'
                                                            WHEN 6 THEN '09001'
                                                            ELSE '03001'
                                                          END)
   WHERE LOWER(TRIM(CLI_CORREO)) LIKE 'ticket.%' || CHR(64) || 'mail.demo'
     AND (
       UPPER(NVL(CLI_PRIMER_NOMBRE, '')) = 'CLIENTE'
       OR UPPER(NVL(CLI_PRIMER_APELLIDO, '')) = 'ESPORADICO'
       OR LENGTH(TRIM(CLI_DPI)) <> 13
       OR TRIM(CLI_TELEFONO) IS NULL
       OR TRIM(CLI_ZONA) IS NULL
       OR TRIM(CLI_CALLE) IS NULL
       OR TRIM(CLI_NUMERO) IS NULL
       OR TRIM(CLI_COLONIA) IS NULL
       OR TRIM(CLI_CIUDAD) IS NULL
       OR TRIM(CLI_CODIGO_POSTAL) IS NULL
     );

  COMMIT;

  DBMS_OUTPUT.PUT_LINE(
    'OK: insertados ' || v_inserted || ' tickets validados + 3 DMT/ticket (entrada/cobro/salida), con cliente esporadico cuando hubo NIT.'
  );
END;
/
