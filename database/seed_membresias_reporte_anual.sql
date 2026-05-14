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
--   - PAR_ESTADO_MEMBRESIA Activa y Suspendida (catálogo estándar).
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
  v_tpa_id          NUMBER;
  v_tve_id          NUMBER;

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
  v_ent             DATE;
  v_sal             DATE;
  v_stay_min        NUMBER;

  v_inserted_mem    PLS_INTEGER := 0;
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

  SELECT MIN(TVE_ID) INTO v_tve_id FROM PAR_TIPO_VEHICULO;
  IF v_tve_id IS NULL THEN
    RAISE_APPLICATION_ERROR(-20114, 'PAR_TIPO_VEHICULO vacío.');
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
      CLI_CORREO,
      CLI_ACTIVO,
      CLI_FECHA_REGISTRO
    ) VALUES (
      v_cli_nom,
      v_cli_ape,
      LPAD(TO_CHAR(1000000000000 + i), 13, '1'),
      'mem' || LPAD(TO_CHAR(i), 3, '0') || '@clientes.seed',
      1,
      SYSDATE
    )
    RETURNING CLI_ID INTO v_cli_id;

    v_placa := 'M' || LPAD(TO_CHAR(v_placa_base + i), 6, '0');

    INSERT INTO PAR_VEHICULO (
      VEH_PLACA,
      VEH_MODELO,
      VEH_COLOR,
      TVE_ID,
      CLI_ID
    ) VALUES (
      v_placa,
      CASE MOD(i, 4)
        WHEN 0 THEN 'CX-5'
        WHEN 1 THEN 'Civic'
        WHEN 2 THEN 'Swift'
        ELSE 'Sentra'
      END,
      CASE MOD(i, 5)
        WHEN 0 THEN 'Azul'
        WHEN 1 THEN 'Gris'
        WHEN 2 THEN 'Blanco'
        WHEN 3 THEN 'Rojo'
        ELSE 'Negro'
      END,
      v_tve_id,
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
    -- Pagos mensuales (hasta 12), solo fechas ≤ SYSDATE
    -----------------------------------------------------------------------
    v_k := 0;
    WHILE v_k < 12 LOOP
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

    IF v_last_pago IS NOT NULL THEN
      UPDATE PAR_MEMBRESIA
         SET MEM_FECHA_VENCIMIENTO = v_last_pago + v_tme_dur,
             MEM_FECHA_ULTIMO_CAMBIO_ESTADO = v_last_pago
       WHERE MEM_ID = v_mem_id;
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

  COMMIT;

  DBMS_OUTPUT.PUT_LINE(
    'OK: membresías=' || v_inserted_mem ||
    ' pagos=' || v_inserted_pag ||
    ' movimientos=' || v_inserted_rmm ||
    ' (correo memNNN@clientes.seed, placas M######, nombres/apellidos comunes).'
  );
END;
/
