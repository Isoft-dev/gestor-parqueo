-- =============================================================================
-- SEED: Membresías mensuales + pagos + movimientos entrada/salida (~1 año)
-- =============================================================================
-- Flujo alineado con server/services/membresia.js:
--   - Membresía exige vehículo con cliente activo (PAR_VEHICULO.CLI_ID → PAR_CLIENTE).
--   - MEM_CODIGO = DDMMYY || MEM_ID (igual que utils/tag.js buildMemCodigo).
--   - Pagos: PAR_PAGO + PAR_DETALLE_PAGO_MEMBRESIA (reportes en reporteFinanciero.js).
--   - Entradas/salidas: PAR_REGISTRO_MOVIMIENTO_MEMBRESIA (historial getMembershipHistory).
--
-- NO ejecuta DELETE: solo INSERT. Correos mem###@clientes.seed placas M######
--
-- Prerrequisitos:
--   - PAR_TIPO_MEMBRESIA mensual (LIKE %mensual%; TME_DURACION en días, p. ej. 30).
--   - PAR_ESTADO_MEMBRESIA Activa y Vencida (catálogo estándar).
--   - PAR_TIPO_PAGO «Efectivo» (o primer TPA_ID disponible).
--   - ≥ 24 filas en PAR_ESPACIO (asigna una por membresía).
--   - Columna MEM_CODIGO en PAR_MEMBRESIA (HU backend).
--
-- Parámetros: k_membresías (24), ventana movimientos = últimos 365 días.
-- =============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  k_mem CONSTANT PLS_INTEGER := 24;

  v_day0            DATE := TRUNC(SYSDATE) - 365;

  v_tme_id          NUMBER;
  v_tme_precio      NUMBER;
  v_tme_dur         NUMBER;
  v_eme_act         NUMBER;
  v_eme_venc        NUMBER;
  v_tpa_id          NUMBER;
  v_mod_id          NUMBER;
  v_col_id          NUMBER;

  TYPE t_nums IS TABLE OF NUMBER;
  v_esp_ids         t_nums;

  v_cli_id          NUMBER;
  v_veh_id          NUMBER;
  v_mem_id          NUMBER;
  v_pag_id          NUMBER;
  v_dpm_id          NUMBER;

  v_placa           VARCHAR2(7);
  v_placa_base      NUMBER;
  v_inicio          DATE;
  v_venc            DATE;
  v_last_pago       DATE;
  v_pag_fecha       DATE;
  v_monto           NUMBER;
  v_rec             NUMBER;
  v_vuelto          NUMBER;

  v_k               PLS_INTEGER;
  v_j               PLS_INTEGER;
  v_movs            PLS_INTEGER;
  v_max_pagos       PLS_INTEGER;
  v_ent             DATE;
  v_sal             DATE;
  v_stay_min        NUMBER;

  v_inserted_mem    PLS_INTEGER := 0;
  v_inserted_venc   PLS_INTEGER := 0;
  v_inserted_pag    PLS_INTEGER := 0;
  v_inserted_rmm    PLS_INTEGER := 0;

  c_tmp             NUMBER;

  TYPE t_nom_arr IS VARRAY(28) OF VARCHAR2(30);
  v_nombres t_nom_arr := t_nom_arr(
    'Carlos', 'María', 'Luis', 'Ana', 'José', 'Carmen', 'Pedro', 'Sofía', 'Miguel', 'Laura',
    'Andrea', 'Diego', 'Gabriela', 'Roberto', 'Claudia', 'Fernando', 'Paola', 'Javier',
    'Daniela', 'Ricardo', 'Alejandra', 'Jorge', 'Valeria', 'Manuel', 'Lucía', 'Francisco',
    'Silvia', 'Oscar'
  );
  v_apellidos t_nom_arr := t_nom_arr(
    'García', 'López', 'Morales', 'Pérez', 'Rodríguez', 'Martínez', 'González', 'Hernández',
    'Reyes', 'Castillo', 'Flores', 'Vásquez', 'Ramírez', 'Torres', 'Jiménez', 'Ortiz',
    'Medina', 'Ruiz', 'Aguilar', 'Méndez', 'Cardona', 'Contreras', 'Sandoval', 'Palma'
  );

  -- Escalares: no usar v_nombres(i) dentro de INSERT VALUES (PLS-00425 / SQL estático)
  v_cli_nom         VARCHAR2(30);
  v_cli_ape         VARCHAR2(30);
BEGIN
  ---------------------------------------------------------------------------
  -- Catálogos
  ---------------------------------------------------------------------------
  BEGIN
    SELECT TME_ID, TME_PRECIO, TME_DURACION
      INTO v_tme_id, v_tme_precio, v_tme_dur
      FROM PAR_TIPO_MEMBRESIA
     WHERE LOWER(NVL(TME_TIPO, '')) LIKE '%mensual%'
     FETCH FIRST 1 ROW ONLY;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20110, 'No hay PAR_TIPO_MEMBRESIA con nombre tipo LIKE %mensual%.');
  END;

  IF NVL(v_tme_dur, 0) <= 0 THEN
    RAISE_APPLICATION_ERROR(-20111, 'TME_DURACION inválida para el tipo de membresía.');
  END IF;

  SELECT MIN(EME_ID)
    INTO v_eme_act
    FROM PAR_ESTADO_MEMBRESIA
   WHERE LOWER(NVL(EME_ESTADO, '')) LIKE '%activ%';
  IF v_eme_act IS NULL THEN
    RAISE_APPLICATION_ERROR(-20112, 'No hay estado de membresía «Activa».');
  END IF;

  SELECT MIN(EME_ID)
    INTO v_eme_venc
    FROM PAR_ESTADO_MEMBRESIA
   WHERE LOWER(NVL(EME_ESTADO, '')) LIKE '%venc%';
  IF v_eme_venc IS NULL THEN
    RAISE_APPLICATION_ERROR(-20117, 'No hay estado de membresía «Vencida».');
  END IF;

  BEGIN
    SELECT MIN(TPA_ID)
      INTO v_tpa_id
      FROM PAR_TIPO_PAGO
     WHERE LOWER(NVL(TPA_TIPO, '')) LIKE '%efect%';
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_tpa_id := NULL;
  END;
  IF v_tpa_id IS NULL THEN
    SELECT MIN(TPA_ID) INTO v_tpa_id FROM PAR_TIPO_PAGO;
  END IF;
  IF v_tpa_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20113, 'PAR_TIPO_PAGO vacío.');
  END IF;

  SELECT MIN(MOD_ID) INTO v_mod_id FROM PAR_MODELO_VEHICULO;
  IF v_mod_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20114, 'PAR_MODELO_VEHICULO vacío.');
  END IF;

  SELECT MIN(COL_ID) INTO v_col_id FROM PAR_COLOR_VEHICULO;
  IF v_col_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20118, 'PAR_COLOR_VEHICULO vacío.');
  END IF;

  SELECT COUNT(*) INTO c_tmp FROM PAR_ESPACIO;
  IF c_tmp < k_mem THEN
    RAISE_APPLICATION_ERROR(-20115, 'Se requieren al menos ' || k_mem || ' espacios en PAR_ESPACIO.');
  END IF;

  -- ROWNUM + subconsulta: FETCH FIRST k_mem falla como SQL estático en algunos entornos
  SELECT ESP_ID
    BULK COLLECT INTO v_esp_ids
    FROM (
           SELECT ESP_ID
             FROM PAR_ESPACIO
            ORDER BY ESP_ID
         )
   WHERE ROWNUM <= k_mem;

  ---------------------------------------------------------------------------
  -- Base numérica para placas M + 6 dígitos (7 caracteres), sin pisar existentes
  ---------------------------------------------------------------------------
  SELECT NVL(MAX(TO_NUMBER(SUBSTR(VEH_PLACA, 2))), 799999)
    INTO v_placa_base
    FROM PAR_VEHICULO
   WHERE LENGTH(VEH_PLACA) = 7
     AND SUBSTR(VEH_PLACA, 1, 1) = 'M'
     AND REGEXP_LIKE(SUBSTR(VEH_PLACA, 2), '^[0-9]{6}$');

  IF v_placa_base + k_mem > 999999 THEN
    RAISE_APPLICATION_ERROR(-20116, 'Rango de placas M###### agotado; reduzca k_mem o libere placas.');
  END IF;

  DBMS_OUTPUT.PUT_LINE(
    'Seed membresías: TME_ID=' || v_tme_id || ' precio=' || v_tme_precio ||
    ' dur_días=' || v_tme_dur || ' desde ' || TO_CHAR(v_day0, 'YYYY-MM-DD')
  );

  ---------------------------------------------------------------------------
  -- Una membresía por iteración: cliente → vehículo → membresía → pagos → movimientos
  ---------------------------------------------------------------------------
  FOR i IN 1 .. k_mem LOOP
    v_cli_nom := v_nombres(MOD(i - 1, v_nombres.COUNT) + 1);
    v_cli_ape := v_apellidos(MOD(i + 7, v_apellidos.COUNT) + 1);

    INSERT INTO PAR_CLIENTE (
      CLI_PRIMER_NOMBRE,
      CLI_PRIMER_APELLIDO,
      CLI_DPI,
      CLI_NIT,
      CLI_CORREO,
      CLI_TELEFONO,
      CLI_ZONA,
      CLI_CALLE,
      CLI_NUMERO,
      CLI_COLONIA,
      CLI_CIUDAD,
      CLI_CODIGO_POSTAL,
      CLI_ACTIVO,
      CLI_FECHA_REGISTRO
    ) VALUES (
      v_cli_nom,
      v_cli_ape,
      LPAD(TO_CHAR(1000000000000 + i), 13, '1'),
      TO_CHAR(8000000 + i),
      'mem' || LPAD(TO_CHAR(i), 3, '0') || CHR(64) || 'clientes.seed',
      TO_CHAR(50000000 + MOD(i * 7919, 29999999)),
      'Zona ' || TO_CHAR(MOD(i, 18) + 1),
      TO_CHAR(MOD(i * 3, 20) + 1) || ' Calle',
      TO_CHAR(MOD(i * 37, 180) + 1) || '-' || LPAD(TO_CHAR(MOD(i * 11, 90) + 1), 2, '0'),
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

    v_placa := 'M' || LPAD(TO_CHAR(v_placa_base + i), 6, '0');

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
      VEH_PLACA,
      MOD_ID,
      COL_ID,
      CLI_ID
    ) VALUES (
      v_placa,
      v_mod_id,
      v_col_id,
      v_cli_id
    )
    RETURNING VEH_ID INTO v_veh_id;

    -- Inicio escalonado en el año (días desde v_day0) + hora del día
    v_inicio :=
        v_day0
      + MOD(i * 11 + TRUNC(DBMS_RANDOM.VALUE(0, 19)), 220)
      + TRUNC(DBMS_RANDOM.VALUE(8, 18)) / 24;

    v_venc := v_inicio + v_tme_dur;

    INSERT INTO PAR_MEMBRESIA (
      TME_ID,
      MEM_FECHA_INICIO,
      EME_ID,
      MEM_FECHA_VENCIMIENTO,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO,
      VEH_ID,
      ESP_ID
    ) VALUES (
      v_tme_id,
      v_inicio,
      v_eme_act,
      v_venc,
      v_inicio,
      v_veh_id,
      v_esp_ids(i)
    )
    RETURNING MEM_ID INTO v_mem_id;

    UPDATE PAR_MEMBRESIA
       SET MEM_CODIGO = TO_CHAR(v_inicio, 'DDMMYY') || TO_CHAR(v_mem_id)
     WHERE MEM_ID = v_mem_id;

    v_last_pago := NULL;

    -----------------------------------------------------------------------
    -- Pagos mensuales: 3 de cada 4 membresías quedan al día y 1 de cada 4
    -- se deja vencer de forma intencional para pruebas/reportes.
    -----------------------------------------------------------------------
    v_max_pagos := CASE WHEN MOD(i, 4) = 0 THEN 4 ELSE 12 END;
    v_k := 0;
    WHILE v_k < v_max_pagos LOOP
      v_pag_fecha :=
          ADD_MONTHS(TRUNC(v_inicio), v_k)
        + NUMTODSINTERVAL(TRUNC(DBMS_RANDOM.VALUE(9 * 60 + 15, 17 * 60 + 45)), 'MINUTE');

      EXIT WHEN v_pag_fecha > SYSDATE;

      v_monto := v_tme_precio;
      v_rec := v_monto + TRUNC(DBMS_RANDOM.VALUE(0, 40));
      v_vuelto := ROUND(v_rec - v_monto, 2);

      INSERT INTO PAR_PAGO (
        TPA_ID,
        PAG_MONTO_TOTAL,
        PAG_MONTO_RECIBIDO,
        PAG_VUELTO,
        PAG_FECHA_HORA
      ) VALUES (
        v_tpa_id,
        v_monto,
        v_rec,
        v_vuelto,
        v_pag_fecha
      )
      RETURNING PAG_ID INTO v_pag_id;

      INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (
        MEM_ID,
        PAG_ID,
        DPM_MES_CANCELADO
      ) VALUES (
        v_mem_id,
        v_pag_id,
        EXTRACT(MONTH FROM CAST(v_pag_fecha AS TIMESTAMP))
      );

      v_last_pago := v_pag_fecha;
      v_inserted_pag := v_inserted_pag + 1;
      v_k := v_k + 1;
    END LOOP;

    -- Vencimiento final: tras el último pago si lo hubo; si no, el inicial.
    IF v_last_pago IS NOT NULL THEN
      v_venc := v_last_pago + v_tme_dur;
    END IF;

    -- Estado coherente con la fecha: «Vencida» si el periodo ya expiró,
    -- «Activa» si sigue vigente. Así los datos sembrados quedan correctos
    -- sin depender de que corra el job diario de membresías.
    UPDATE PAR_MEMBRESIA
       SET MEM_FECHA_VENCIMIENTO = v_venc,
           EME_ID = CASE
                      WHEN TRUNC(v_venc) < TRUNC(SYSDATE) THEN v_eme_venc
                      ELSE v_eme_act
                    END,
           MEM_FECHA_ULTIMO_CAMBIO_ESTADO = NVL(v_last_pago, v_inicio)
     WHERE MEM_ID = v_mem_id;

    IF TRUNC(v_venc) < TRUNC(SYSDATE) THEN
      v_inserted_venc := v_inserted_venc + 1;
    END IF;

    -----------------------------------------------------------------------
    -- Movimientos entrada/salida (varios por año)
    -----------------------------------------------------------------------
    v_movs := TRUNC(DBMS_RANDOM.VALUE(15, 41));

    FOR v_j IN 1 .. v_movs LOOP
      v_ent :=
          v_inicio
        + TRUNC(DBMS_RANDOM.VALUE(0, GREATEST(1, SYSDATE - v_inicio)))
        + NUMTODSINTERVAL(TRUNC(DBMS_RANDOM.VALUE(6 * 60, 21 * 60 + 50)), 'MINUTE');

      IF v_ent > SYSDATE THEN
        v_ent := SYSDATE - TRUNC(DBMS_RANDOM.VALUE(1, 120));
      END IF;

      v_stay_min := TRUNC(DBMS_RANDOM.VALUE(25, 380));
      v_sal := LEAST(
        v_ent + NUMTODSINTERVAL(v_stay_min, 'MINUTE') / (24 * 60),
        SYSDATE
      );

      IF v_sal <= v_ent THEN
        v_sal := v_ent + NUMTODSINTERVAL(45, 'MINUTE') / (24 * 60);
      END IF;

      INSERT INTO PAR_REGISTRO_MOVIMIENTO_MEMBRESIA (
        RMM_FECHA_HORA_ENTRADA,
        RMM_FECHA_HORA_SALIDA,
        MEM_ID
      ) VALUES (
        v_ent,
        v_sal,
        v_mem_id
      );

      v_inserted_rmm := v_inserted_rmm + 1;
    END LOOP;

    v_inserted_mem := v_inserted_mem + 1;
  END LOOP;

  -- Completa datos de contacto/direccion de clientes mensuales creados por
  -- versiones anteriores del seed, sin alterar nombres ni relaciones.
  UPDATE PAR_CLIENTE
     SET CLI_NIT = NVL(TRIM(CLI_NIT), TO_CHAR(8000000 + CLI_ID)),
         CLI_TELEFONO = NVL(TRIM(CLI_TELEFONO), TO_CHAR(50000000 + MOD(CLI_ID * 7919, 29999999))),
         CLI_ZONA = NVL(TRIM(CLI_ZONA), 'Zona ' || TO_CHAR(MOD(CLI_ID, 18) + 1)),
         CLI_CALLE = NVL(TRIM(CLI_CALLE), TO_CHAR(MOD(CLI_ID * 3, 20) + 1) || ' Calle'),
         CLI_NUMERO = NVL(TRIM(CLI_NUMERO), TO_CHAR(MOD(CLI_ID * 37, 180) + 1) || '-' || LPAD(TO_CHAR(MOD(CLI_ID * 11, 90) + 1), 2, '0')),
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
   WHERE LOWER(TRIM(CLI_CORREO)) LIKE 'mem%' || CHR(64) || 'clientes.seed'
     AND (
       TRIM(CLI_NIT) IS NULL
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
    'OK: membresías=' || v_inserted_mem ||
    ' (vencidas=' || v_inserted_venc || ')' ||
    ' pagos=' || v_inserted_pag ||
    ' movimientos=' || v_inserted_rmm ||
    ' (correo memNNN' || CHR(64) || 'clientes.seed, placas M######, nombres/apellidos comunes).'
  );
END;
/

-- =============================================================================
-- BLOQUE PRESENTACIÓN: membresías «por vencer» y «en mora» para demo 30/05/2026
-- =============================================================================
-- Genera 8 membresías fijas (correos demo.pres##@clientes.seed, placas P######):
--   · 4 «por vencer» : Activa, vencimiento en +1, +2, +3 y +5 días desde SYSDATE.
--   · 4 «en mora»    : Vencida, vencimiento hace −2, −4, −6 y −9 días desde SYSDATE.
--
-- El reporte GET /reportes/clientes-mora busca membresías en estado Vencida cuya
-- MEM_FECHA_VENCIMIENTO ya pasó — exactamente lo que generan las 4 de «en mora».
-- El job diario (suspendMembershipsOverdue) también marca Vencida las que detecta,
-- por lo que ambos flujos son consistentes.
-- =============================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  -- Offsets de vencimiento respecto a TRUNC(SYSDATE):
  --   positivo  → por vencer
  --   negativo  → en mora: se inserta como Vencida
  TYPE t_days IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_offsets t_days;

  v_tme_id     NUMBER;
  v_tme_precio NUMBER;
  v_tme_dur    NUMBER;
  v_eme_act    NUMBER;
  v_eme_venc   NUMBER;
  v_tpa_id     NUMBER;
  v_mod_id     NUMBER;
  v_col_id     NUMBER;

  TYPE t_nums IS TABLE OF NUMBER;
  v_esp_pres   t_nums;

  v_cli_id     NUMBER;
  v_veh_id     NUMBER;
  v_mem_id     NUMBER;
  v_pag_id     NUMBER;
  v_placa      VARCHAR2(7);
  v_placa_base NUMBER;
  v_inicio     DATE;
  v_venc       DATE;
  v_monto      NUMBER;
  v_rec        NUMBER;
  v_tag        VARCHAR2(10);
  v_cli_nom    VARCHAR2(30);
  v_cli_ape    VARCHAR2(30);

  v_ins_mem    PLS_INTEGER := 0;
  v_ins_pag    PLS_INTEGER := 0;

  TYPE t_nom_arr IS VARRAY(8) OF VARCHAR2(30);
  v_demo_nombres t_nom_arr := t_nom_arr(
    'Mariana', 'Esteban', 'Lucia', 'Rodrigo',
    'Daniela', 'Mateo', 'Camila', 'Sebastian'
  );
  v_demo_apellidos t_nom_arr := t_nom_arr(
    'Castillo', 'Mendez', 'Herrera', 'Alvarado',
    'Salazar', 'Fuentes', 'Cabrera', 'Ramos'
  );
BEGIN
  ---------------------------------------------------------------------------
  -- Catálogos (misma lógica que el bloque principal)
  ---------------------------------------------------------------------------
  SELECT TME_ID, TME_PRECIO, TME_DURACION
    INTO v_tme_id, v_tme_precio, v_tme_dur
    FROM PAR_TIPO_MEMBRESIA
   WHERE LOWER(NVL(TME_TIPO, '')) LIKE '%mensual%'
   FETCH FIRST 1 ROW ONLY;

  SELECT MIN(EME_ID) INTO v_eme_act
    FROM PAR_ESTADO_MEMBRESIA
   WHERE LOWER(NVL(EME_ESTADO, '')) LIKE '%activ%';
  IF v_eme_act IS NULL THEN
    RAISE_APPLICATION_ERROR(-20200, 'No hay estado «Activa» en PAR_ESTADO_MEMBRESIA.');
  END IF;

  SELECT MIN(EME_ID) INTO v_eme_venc
    FROM PAR_ESTADO_MEMBRESIA
   WHERE LOWER(NVL(EME_ESTADO, '')) LIKE '%venc%';
  IF v_eme_venc IS NULL THEN
    RAISE_APPLICATION_ERROR(-20203, 'No hay estado «Vencida» en PAR_ESTADO_MEMBRESIA.');
  END IF;

  BEGIN
    SELECT MIN(TPA_ID) INTO v_tpa_id
      FROM PAR_TIPO_PAGO WHERE LOWER(NVL(TPA_TIPO, '')) LIKE '%efect%';
  EXCEPTION WHEN NO_DATA_FOUND THEN v_tpa_id := NULL;
  END;
  IF v_tpa_id IS NULL THEN SELECT MIN(TPA_ID) INTO v_tpa_id FROM PAR_TIPO_PAGO; END IF;
  IF v_tpa_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20201, 'PAR_TIPO_PAGO vacío.');
  END IF;

  ---------------------------------------------------------------------------
  -- Espacios: filas 25-32 en orden de ESP_ID
  -- (las primeras 24 las usa el bloque principal del seed)
  ---------------------------------------------------------------------------
  SELECT ESP_ID
    BULK COLLECT INTO v_esp_pres
    FROM (
           SELECT ESP_ID, ROWNUM AS rn
             FROM (SELECT ESP_ID FROM PAR_ESPACIO ORDER BY ESP_ID)
         )
   WHERE rn BETWEEN 25 AND 32;

  IF v_esp_pres.COUNT < 8 THEN
    RAISE_APPLICATION_ERROR(-20202,
      'Se necesitan al menos 32 espacios en PAR_ESPACIO para el bloque de presentación.');
  END IF;

  ---------------------------------------------------------------------------
  -- Base de placas P###### (prefijo P para no chocar con M###### del bloque principal)
  ---------------------------------------------------------------------------
  SELECT NVL(MAX(TO_NUMBER(SUBSTR(VEH_PLACA, 2))), 0)
    INTO v_placa_base
    FROM PAR_VEHICULO
   WHERE LENGTH(VEH_PLACA) = 7
     AND SUBSTR(VEH_PLACA, 1, 1) = 'P'
     AND REGEXP_LIKE(SUBSTR(VEH_PLACA, 2), '^[0-9]{6}$');

  ---------------------------------------------------------------------------
  -- Offsets de vencimiento
  ---------------------------------------------------------------------------
  v_offsets(1) :=  1;  -- por vencer: mañana
  v_offsets(2) :=  2;  -- por vencer: pasado mañana
  v_offsets(3) :=  3;  -- por vencer: en 3 días
  v_offsets(4) :=  5;  -- por vencer: en 5 días
  v_offsets(5) := -2;  -- en mora: venció hace 2 días
  v_offsets(6) := -4;  -- en mora: venció hace 4 días
  v_offsets(7) := -6;  -- en mora: venció hace 6 días
  v_offsets(8) := -9;  -- en mora: venció hace 9 días

  ---------------------------------------------------------------------------
  -- Loop principal del bloque presentación
  ---------------------------------------------------------------------------
  FOR i IN 1 .. 8 LOOP
    v_tag := CASE WHEN v_offsets(i) > 0 THEN 'vencer' ELSE 'mora' END;
    v_cli_nom := v_demo_nombres(i);
    v_cli_ape := v_demo_apellidos(i);

    SELECT MOD_ID INTO v_mod_id
      FROM (SELECT MOD_ID FROM PAR_MODELO_VEHICULO ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1;
    SELECT COL_ID INTO v_col_id
      FROM (SELECT COL_ID FROM PAR_COLOR_VEHICULO  ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM = 1;

    -- Cliente demo
    INSERT INTO PAR_CLIENTE (
      CLI_PRIMER_NOMBRE, CLI_PRIMER_APELLIDO,
      CLI_DPI, CLI_NIT, CLI_CORREO, CLI_TELEFONO,
      CLI_ZONA, CLI_CALLE, CLI_NUMERO, CLI_COLONIA,
      CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
    ) VALUES (
      v_cli_nom,
      v_cli_ape,
      TO_CHAR(1900000000000 + i),
      TO_CHAR(8100000 + i),
      'demo.' || v_tag || LPAD(TO_CHAR(i), 2, '0') || CHR(64) || 'clientes.seed',
      TO_CHAR(51000000 + MOD(i * 3571, 29999999)),
      'Zona ' || TO_CHAR(MOD(i, 18) + 1),
      TO_CHAR(MOD(i * 4, 20) + 1) || ' Avenida',
      TO_CHAR(MOD(i * 31, 180) + 1) || '-' || LPAD(TO_CHAR(MOD(i * 13, 90) + 1), 2, '0'),
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

    -- Vehículo con placa P######
    v_placa := 'P' || LPAD(TO_CHAR(v_placa_base + i), 6, '0');
    INSERT INTO PAR_VEHICULO (VEH_PLACA, MOD_ID, COL_ID, CLI_ID)
    VALUES (v_placa, v_mod_id, v_col_id, v_cli_id)
    RETURNING VEH_ID INTO v_veh_id;

    -- Fechas: vencimiento = TRUNC(SYSDATE) + offset
    --         inicio      = vencimiento − duración del tipo (1 período atrás)
    v_venc   := TRUNC(SYSDATE) + v_offsets(i);
    v_inicio := v_venc - v_tme_dur
                + NUMTODSINTERVAL(TRUNC(DBMS_RANDOM.VALUE(8, 17)), 'HOUR');

    -- Membresía: Activa si vencimiento futuro; Vencida si ya expiró (offset negativo)
    INSERT INTO PAR_MEMBRESIA (
      TME_ID,
      MEM_FECHA_INICIO,
      EME_ID,
      MEM_FECHA_VENCIMIENTO,
      MEM_FECHA_ULTIMO_CAMBIO_ESTADO,
      VEH_ID,
      ESP_ID
    ) VALUES (
      v_tme_id,
      v_inicio,
      -- Estado según offset: Vencida si ya expiró, Activa si aún no
      CASE WHEN v_offsets(i) < 0 THEN v_eme_venc ELSE v_eme_act END,
      v_venc,
      v_inicio,
      v_veh_id,
      v_esp_pres(i)
    )
    RETURNING MEM_ID INTO v_mem_id;

    UPDATE PAR_MEMBRESIA
       SET MEM_CODIGO = TO_CHAR(v_inicio, 'DDMMYY') || TO_CHAR(v_mem_id)
     WHERE MEM_ID = v_mem_id;

    -- Un pago al inicio (cubre el período; sin pago posterior que renueve)
    v_monto := v_tme_precio;
    v_rec   := v_monto + TRUNC(DBMS_RANDOM.VALUE(0, 20));
    INSERT INTO PAR_PAGO (
      TPA_ID, PAG_MONTO_TOTAL, PAG_MONTO_RECIBIDO, PAG_VUELTO, PAG_FECHA_HORA
    ) VALUES (
      v_tpa_id,
      v_monto,
      v_rec,
      v_rec - v_monto,
      v_inicio + NUMTODSINTERVAL(TRUNC(DBMS_RANDOM.VALUE(30, 90)), 'MINUTE')
    )
    RETURNING PAG_ID INTO v_pag_id;

    INSERT INTO PAR_DETALLE_PAGO_MEMBRESIA (MEM_ID, PAG_ID, DPM_MES_CANCELADO)
    VALUES (
      v_mem_id,
      v_pag_id,
      EXTRACT(MONTH FROM CAST(v_inicio AS TIMESTAMP))
    );

    v_ins_mem := v_ins_mem + 1;
    v_ins_pag := v_ins_pag + 1;
  END LOOP;

  COMMIT;

  -- Si este seed ya se habia ejecutado, normaliza tambien las filas anteriores
  -- sin borrar membresias, pagos ni vehiculos relacionados.
  FOR i IN 1 .. 8 LOOP
    v_tag := CASE WHEN v_offsets(i) > 0 THEN 'vencer' ELSE 'mora' END;
    UPDATE PAR_CLIENTE
       SET CLI_PRIMER_NOMBRE = v_demo_nombres(i),
           CLI_PRIMER_APELLIDO = v_demo_apellidos(i),
           CLI_DPI = TO_CHAR(1900000000000 + CLI_ID),
           CLI_NIT = NVL(TRIM(CLI_NIT), TO_CHAR(8100000 + i)),
           CLI_TELEFONO = NVL(TRIM(CLI_TELEFONO), TO_CHAR(51000000 + MOD(i * 3571, 29999999))),
           CLI_ZONA = NVL(TRIM(CLI_ZONA), 'Zona ' || TO_CHAR(MOD(i, 18) + 1)),
           CLI_CALLE = NVL(TRIM(CLI_CALLE), TO_CHAR(MOD(i * 4, 20) + 1) || ' Avenida'),
           CLI_NUMERO = NVL(TRIM(CLI_NUMERO), TO_CHAR(MOD(i * 31, 180) + 1) || '-' || LPAD(TO_CHAR(MOD(i * 13, 90) + 1), 2, '0')),
           CLI_COLONIA = NVL(TRIM(CLI_COLONIA), CASE MOD(i, 8)
                                                 WHEN 0 THEN 'Colonia Centro America'
                                                 WHEN 1 THEN 'Colonia Mariscal'
                                                 WHEN 2 THEN 'Colonia La Reformita'
                                                 WHEN 3 THEN 'Colonia Santa Elisa'
                                                 WHEN 4 THEN 'Colonia El Naranjo'
                                                 WHEN 5 THEN 'Colonia Primero de Julio'
                                                 WHEN 6 THEN 'Colonia San Cristobal'
                                                 ELSE 'Colonia Las Charcas'
                                               END),
           CLI_CIUDAD = NVL(TRIM(CLI_CIUDAD), CASE MOD(i, 8)
                                               WHEN 0 THEN 'Guatemala'
                                               WHEN 1 THEN 'Mixco'
                                               WHEN 2 THEN 'Villa Nueva'
                                               WHEN 3 THEN 'San Miguel Petapa'
                                               WHEN 4 THEN 'Amatitlan'
                                               WHEN 5 THEN 'Santa Catarina Pinula'
                                               WHEN 6 THEN 'Quetzaltenango'
                                               ELSE 'Antigua Guatemala'
                                             END),
           CLI_CODIGO_POSTAL = NVL(TRIM(CLI_CODIGO_POSTAL), CASE MOD(i, 8)
                                                              WHEN 0 THEN '01001'
                                                              WHEN 1 THEN '01057'
                                                              WHEN 2 THEN '01064'
                                                              WHEN 3 THEN '01066'
                                                              WHEN 4 THEN '01063'
                                                              WHEN 5 THEN '01051'
                                                              WHEN 6 THEN '09001'
                                                              ELSE '03001'
                                                            END)
     WHERE LOWER(TRIM(CLI_CORREO)) = 'demo.' || v_tag || LPAD(TO_CHAR(i), 2, '0') || CHR(64) || 'clientes.seed';
  END LOOP;

  COMMIT;

  DBMS_OUTPUT.PUT_LINE(
    'OK bloque presentación: ' || v_ins_mem || ' membresías (4 por vencer Activa, 4 en mora Vencida),' ||
    ' ' || v_ins_pag || ' pagos.' ||
    ' Placas P######, correos demo.mora/vencerNN' || CHR(64) || 'clientes.seed.'
  );
END;
/
