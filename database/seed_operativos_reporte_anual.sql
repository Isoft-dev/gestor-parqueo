-- =============================================================================
-- SEED: Alertas, mantenimientos, recargas e incidentes (~1 año) — reportes operativos
-- =============================================================================
-- Prerrequisitos:
--   - seed_catalogo_funcional.sql (máquinas, tipos/estados de alerta, incidentes).
--   - seed_tickets_reporte_anual.sql recomendado (vehículos para bitácora de incidentes).
--
-- Marcador idempotente: textos con prefijo «DEMO-RPT».
-- Re-ejecutar no duplica si ya hay ≥ 100 alertas demo.
--
-- Cubre reportes en server/services/reporteOperativoMaquinas.js y reporteIncidentes.js:
--   - PAR_ALERTA
--   - PAR_REGISTRO_MANTENIMIENTO (INICIO / FINALIZACION)
--   - PAR_RECARGO_MAQUINA + saldo en PAR_DETALLE_SALDO (Cobro_1)
--   - PAR_BITACORA_INCIDENTE_VEHICULO
-- =============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  k_alertas       CONSTANT PLS_INTEGER := 140;
  k_mant_ciclos   CONSTANT PLS_INTEGER := 28;
  k_recargas      CONSTANT PLS_INTEGER := 48;
  k_incidentes    CONSTANT PLS_INTEGER := 96;

  v_day0          DATE := TRUNC(SYSDATE) - 365;
  v_day1          DATE := TRUNC(SYSDATE);

  v_eal_pend      NUMBER;
  v_eal_atend     NUMBER;
  v_tal_asist     NUMBER;
  v_tal_sistema   NUMBER;
  v_tal_saldo     NUMBER;
  v_ema_oper      NUMBER;
  v_ema_mant      NUMBER;
  v_usu_guardia   NUMBER;
  v_usu_super     NUMBER;

  v_maq_ent       NUMBER;
  v_maq_cob       NUMBER;
  v_maq_sal       NUMBER;

  TYPE t_inc IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_inc_ids       t_inc;
  v_inc_n         PLS_INTEGER := 0;

  v_veh_count     NUMBER;
  v_veh_id        NUMBER;

  v_existing      NUMBER;
  v_i             PLS_INTEGER;
  v_j             PLS_INTEGER;
  v_pick          NUMBER;
  v_fecha         DATE;
  v_atend         DATE;
  v_maq_id        NUMBER;
  v_tal_id        NUMBER;
  v_eal_id        NUMBER;
  v_inc_id        NUMBER;
  v_usu_id        NUMBER;
  v_resuelto      NUMBER;
  v_f_res         DATE;
  v_inicio_f      DATE;
  v_fin_f         DATE;
  v_motivo        VARCHAR2(200);
  v_desc          VARCHAR2(500);

  v_ins_ale       PLS_INTEGER := 0;
  v_ins_rem       PLS_INTEGER := 0;
  v_ins_rma       PLS_INTEGER := 0;
  v_ins_biv       PLS_INTEGER := 0;

  FUNCTION rand_day RETURN DATE IS
    n NUMBER;
  BEGIN
    n := TRUNC(DBMS_RANDOM.VALUE(0, v_day1 - v_day0 + 1));
    RETURN v_day0 + n;
  END;

  FUNCTION rand_ts(p_day DATE, p_h_ini NUMBER, p_h_fin NUMBER) RETURN DATE IS
    h NUMBER;
    m NUMBER;
  BEGIN
    h := TRUNC(DBMS_RANDOM.VALUE(p_h_ini, p_h_fin + 1));
    m := TRUNC(DBMS_RANDOM.VALUE(0, 60));
    RETURN p_day + (h / 24) + (m / 1440);
  END;

  FUNCTION pick_vehicle RETURN NUMBER IS
    vid NUMBER;
  BEGIN
    SELECT VEH_ID
      INTO vid
      FROM (
        SELECT VEH_ID FROM PAR_VEHICULO ORDER BY DBMS_RANDOM.VALUE
      )
     WHERE ROWNUM = 1;
    RETURN vid;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN NULL;
  END;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM PAR_ALERTA WHERE ALE_MOTIVO LIKE 'DEMO-RPT%';
  IF v_existing >= 100 THEN
    DBMS_OUTPUT.PUT_LINE('Seed operativos: ya existen ' || v_existing || ' alertas DEMO-RPT. Omitiendo.');
    RETURN;
  END IF;

  SELECT MIN(EAL_ID) INTO v_eal_pend FROM PAR_ESTADO_ALERTA WHERE LOWER(EAL_ESTADO) LIKE '%pend%';
  SELECT MIN(EAL_ID) INTO v_eal_atend FROM PAR_ESTADO_ALERTA WHERE LOWER(EAL_ESTADO) LIKE '%atendid%';
  IF v_eal_pend IS NULL THEN
    SELECT MIN(EAL_ID) INTO v_eal_pend FROM PAR_ESTADO_ALERTA;
  END IF;
  IF v_eal_atend IS NULL THEN
    v_eal_atend := v_eal_pend;
  END IF;

  SELECT MIN(TAL_ID) INTO v_tal_asist FROM PAR_TIPO_ALERTA WHERE LOWER(TAL_TIPO) LIKE '%asist%';
  SELECT MIN(TAL_ID) INTO v_tal_sistema FROM PAR_TIPO_ALERTA WHERE LOWER(TAL_TIPO) LIKE '%sistem%';
  SELECT MIN(TAL_ID) INTO v_tal_saldo FROM PAR_TIPO_ALERTA
   WHERE (LOWER(TAL_TIPO) LIKE '%saldo%' AND LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%baj%')
      OR (LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%saldo%' AND LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%baj%');
  IF v_tal_asist IS NULL THEN SELECT MIN(TAL_ID) INTO v_tal_asist FROM PAR_TIPO_ALERTA; END IF;
  IF v_tal_sistema IS NULL THEN v_tal_sistema := v_tal_asist; END IF;
  IF v_tal_saldo IS NULL THEN v_tal_saldo := v_tal_sistema; END IF;

  SELECT MIN(EMA_ID) INTO v_ema_oper FROM PAR_ESTADO_MAQUINA WHERE LOWER(EMA_ESTADO) LIKE '%operativ%';
  SELECT MIN(EMA_ID) INTO v_ema_mant FROM PAR_ESTADO_MAQUINA WHERE LOWER(EMA_ESTADO) LIKE '%manten%';
  IF v_ema_oper IS NULL THEN SELECT MIN(EMA_ID) INTO v_ema_oper FROM PAR_ESTADO_MAQUINA; END IF;
  IF v_ema_mant IS NULL THEN v_ema_mant := v_ema_oper; END IF;

  SELECT MIN(MAQ_ID) INTO v_maq_ent FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'ENTRADA_1';
  SELECT MIN(MAQ_ID) INTO v_maq_cob FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'COBRO_1';
  SELECT MIN(MAQ_ID) INTO v_maq_sal FROM PAR_MAQUINA WHERE UPPER(TRIM(MAQ_CODIGO)) = 'SALIDA_1';
  IF v_maq_ent IS NULL AND v_maq_cob IS NULL AND v_maq_sal IS NULL THEN
    RAISE_APPLICATION_ERROR(-20130, 'No hay máquinas de cabina. Ejecute seed_catalogo_funcional.sql.');
  END IF;

  SELECT MIN(USU_ID) INTO v_usu_guardia FROM PAR_USUARIO WHERE LOWER(TRIM(USU_CORREO)) = 'guardia@gmail.com';
  SELECT MIN(USU_ID) INTO v_usu_super FROM PAR_USUARIO WHERE LOWER(TRIM(USU_CORREO)) = 'supervisordecamaras@gmail.com';
  IF v_usu_guardia IS NULL THEN SELECT MIN(USU_ID) INTO v_usu_guardia FROM PAR_USUARIO; END IF;
  v_usu_super := NVL(v_usu_super, v_usu_guardia);

  v_inc_n := 0;
  FOR r IN (SELECT INC_ID FROM PAR_INCIDENTE ORDER BY INC_ID) LOOP
    v_inc_n := v_inc_n + 1;
    v_inc_ids(v_inc_n) := r.INC_ID;
  END LOOP;
  IF v_inc_n = 0 THEN
    RAISE_APPLICATION_ERROR(-20131, 'No hay tipos en PAR_INCIDENTE.');
  END IF;

  SELECT COUNT(*) INTO v_veh_count FROM PAR_VEHICULO;
  IF v_veh_count = 0 THEN
    DBMS_OUTPUT.PUT_LINE('AVISO: sin vehículos; se omitirán incidentes. Ejecute seed_tickets_reporte_anual.sql.');
  END IF;

  ---------------------------------------------------------------------------
  -- Alertas por máquina / tipo
  ---------------------------------------------------------------------------
  FOR v_i IN 1 .. k_alertas LOOP
    v_pick := MOD(v_i, 3);
    IF v_pick = 0 AND v_maq_ent IS NOT NULL THEN
      v_maq_id := v_maq_ent;
    ELSIF v_pick = 1 AND v_maq_cob IS NOT NULL THEN
      v_maq_id := v_maq_cob;
    ELSIF v_maq_sal IS NOT NULL THEN
      v_maq_id := v_maq_sal;
    ELSIF v_maq_cob IS NOT NULL THEN
      v_maq_id := v_maq_cob;
    ELSE
      v_maq_id := v_maq_ent;
    END IF;

    v_pick := MOD(v_i, 5);
    IF v_pick = 0 THEN
      v_tal_id := v_tal_saldo;
      v_motivo := 'DEMO-RPT Saldo bajo umbral';
    ELSIF v_pick = 1 THEN
      v_tal_id := v_tal_sistema;
      v_motivo := 'DEMO-RPT Fallo de comunicación';
    ELSE
      v_tal_id := v_tal_asist;
      v_motivo := 'DEMO-RPT Solicitud de asistencia';
    END IF;

    IF MOD(v_i, 4) = 0 THEN
      v_eal_id := v_eal_pend;
      v_atend := NULL;
    ELSE
      v_eal_id := v_eal_atend;
      v_atend := NULL;
    END IF;

    v_fecha := rand_ts(rand_day, 6, 22);
    IF v_eal_id = v_eal_atend THEN
      v_atend := v_fecha + (DBMS_RANDOM.VALUE(1, 48) / 24);
    END IF;

    INSERT INTO PAR_ALERTA (
      ALE_ID, MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION,
      ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION
    ) VALUES (
      DEFAULT,
      v_maq_id,
      v_motivo,
      'Registro sintético para reportes operativos — lote anual demo',
      v_fecha,
      v_eal_id,
      v_tal_id,
      v_atend
    );
    v_ins_ale := v_ins_ale + 1;
  END LOOP;

  ---------------------------------------------------------------------------
  -- Mantenimientos (inicio + finalización)
  ---------------------------------------------------------------------------
  FOR v_i IN 1 .. k_mant_ciclos LOOP
    v_pick := MOD(v_i, 3);
    IF v_pick = 0 AND v_maq_cob IS NOT NULL THEN v_maq_id := v_maq_cob;
    ELSIF v_pick = 1 AND v_maq_ent IS NOT NULL THEN v_maq_id := v_maq_ent;
    ELSIF v_maq_sal IS NOT NULL THEN v_maq_id := v_maq_sal;
    ELSE v_maq_id := NVL(v_maq_cob, NVL(v_maq_ent, v_maq_sal));
    END IF;

    v_inicio_f := rand_ts(rand_day, 7, 18);
    v_fin_f := v_inicio_f + (DBMS_RANDOM.VALUE(2, 10) / 24);

    INSERT INTO PAR_REGISTRO_MANTENIMIENTO (
      REM_ID, MAQ_ID, REM_MANTENIMIENTO_FECHA, REM_DESCRIPCION,
      REM_TIPO_MOVIMIENTO, REM_ESTADO_RESULTANTE_EMA_ID
    ) VALUES (
      DEFAULT, v_maq_id, v_inicio_f,
      'DEMO-RPT Inicio mantenimiento preventivo #' || v_i,
      'INICIO', NULL
    );
    v_ins_rem := v_ins_rem + 1;

    INSERT INTO PAR_REGISTRO_MANTENIMIENTO (
      REM_ID, MAQ_ID, REM_MANTENIMIENTO_FECHA, REM_DESCRIPCION,
      REM_TIPO_MOVIMIENTO, REM_ESTADO_RESULTANTE_EMA_ID
    ) VALUES (
      DEFAULT, v_maq_id, v_fin_f,
      'DEMO-RPT Finalización mantenimiento #' || v_i,
      'FINALIZACION',
      CASE WHEN MOD(v_i, 5) = 0 THEN v_ema_mant ELSE v_ema_oper END
    );
    v_ins_rem := v_ins_rem + 1;
  END LOOP;

  ---------------------------------------------------------------------------
  -- Recargas de efectivo (máquina de cobro)
  ---------------------------------------------------------------------------
  IF v_maq_cob IS NOT NULL THEN
    FOR v_i IN 1 .. k_recargas LOOP
      v_fecha := rand_ts(rand_day, 8, 20);
      v_desc := 'DEMO-RPT Recarga efectivo — lote ' || v_i;

      INSERT INTO PAR_RECARGO_MAQUINA (RMA_ID, MAQ_ID, RMA_MANTENIMIENTO_FECHA, RMA_DESCRIPCION)
      VALUES (DEFAULT, v_maq_cob, v_fecha, v_desc);
      v_ins_rma := v_ins_rma + 1;
    END LOOP;

    UPDATE PAR_MAQUINA
       SET MAQ_FECHA_ULTIMA_RECARGA = SYSDATE
     WHERE MAQ_ID = v_maq_cob;

    FOR r IN (
      SELECT ds.DSA_ID, ds.SDI_ID, sd.SDI_VALOR
        FROM PAR_DETALLE_SALDO ds
        JOIN PAR_SALDO_DISPONIBLE sd ON sd.SDI_ID = ds.SDI_ID
       WHERE ds.MAQ_ID = v_maq_cob
    ) LOOP
      v_pick := CASE r.SDI_VALOR
        WHEN 5 THEN 45 + TRUNC(DBMS_RANDOM.VALUE(0, 15))
        WHEN 10 THEN 38 + TRUNC(DBMS_RANDOM.VALUE(0, 12))
        WHEN 20 THEN 28 + TRUNC(DBMS_RANDOM.VALUE(0, 10))
        WHEN 50 THEN 18 + TRUNC(DBMS_RANDOM.VALUE(0, 8))
        ELSE 10 + TRUNC(DBMS_RANDOM.VALUE(0, 5))
      END;
      UPDATE PAR_DETALLE_SALDO
         SET DSA_CANTIDAD = v_pick,
             DSA_SUBTOTAL = v_pick * NVL(r.SDI_VALOR, 0)
       WHERE DSA_ID = r.DSA_ID;
    END LOOP;
  END IF;

  ---------------------------------------------------------------------------
  -- Bitácora de incidentes vehiculares
  ---------------------------------------------------------------------------
  IF v_veh_count > 0 THEN
    FOR v_i IN 1 .. k_incidentes LOOP
      v_veh_id := pick_vehicle;
      IF v_veh_id IS NULL THEN
        EXIT;
      END IF;

      v_inc_id := v_inc_ids(MOD(v_i - 1, v_inc_n) + 1);
      v_fecha := rand_ts(rand_day, 5, 23);

      IF MOD(v_i, 3) = 0 THEN
        v_resuelto := 0;
        v_f_res := NULL;
        v_usu_id := NULL;
      ELSE
        v_resuelto := 1;
        v_f_res := v_fecha + (DBMS_RANDOM.VALUE(2, 72) / 24);
        v_usu_id := CASE WHEN MOD(v_i, 2) = 0 THEN v_usu_guardia ELSE v_usu_super END;
      END IF;

      v_desc := 'DEMO-RPT Incidente reportado en operación — ref ' || v_i;

      INSERT INTO PAR_BITACORA_INCIDENTE_VEHICULO (
        BIV_ID, BIV_DESCRIPCION, BIV_FECHA_HORA, VEH_ID, INC_ID,
        BIV_RESUELTO, BIV_FECHA_RESOLUCION, USU_ID
      ) VALUES (
        DEFAULT, v_desc, v_fecha, v_veh_id, v_inc_id,
        v_resuelto, v_f_res, v_usu_id
      );
      v_ins_biv := v_ins_biv + 1;
    END LOOP;
  END IF;

  COMMIT;

  DBMS_OUTPUT.PUT_LINE('Seed operativos completado:');
  DBMS_OUTPUT.PUT_LINE('  Alertas:         ' || v_ins_ale);
  DBMS_OUTPUT.PUT_LINE('  Mantenimientos:  ' || v_ins_rem);
  DBMS_OUTPUT.PUT_LINE('  Recargas:        ' || v_ins_rma);
  DBMS_OUTPUT.PUT_LINE('  Incidentes BIV:  ' || v_ins_biv);
END;
/
