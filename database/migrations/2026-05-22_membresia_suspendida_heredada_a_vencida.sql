-- =============================================================================
-- Migracion: estados de membresia heredados «Suspendida» -> «Vencida»
-- Fecha: 2026-05-22
-- =============================================================================
-- Contexto:
--   El backend antiguo, al terminar el periodo de una membresia sin pago, la
--   pasaba a «Suspendida». El backend actual usa «Vencida» para ese caso y
--   reserva «Suspendida» para suspensiones administrativas.
--   El job diario (suspendMembershipsOverdue) NO toca membresias ya suspendidas
--   -para no pisar suspensiones administrativas-, asi que los registros viejos
--   quedan congelados como «Suspendida». Este script los reclasifica una sola vez.
--
-- Criterio (una membresia pasa a «Vencida» si se cumplen las tres):
--   1. su estado actual es «Suspendida» (o «Inactiva»);
--   2. su fecha de vencimiento ya paso (TRUNC(SYSDATE) > TRUNC(MEM_FECHA_VENCIMIENTO));
--   3. no tiene un pago que cubra la vigencia (PAG_FECHA_HORA >= MEM_FECHA_VENCIMIENTO).
--
-- IMPORTANTE: si ya existen suspensiones administrativas legitimas sobre
-- membresias vencidas, revisa primero la lista que imprime el bloque
-- (DBMS_OUTPUT) y excluye esos MEM_ID antes de confirmar. Para previsualizar
-- SIN cambiar nada, ejecuta antes este SELECT:
--
--   SELECT m.MEM_ID, v.VEH_PLACA, m.MEM_FECHA_VENCIMIENTO, em.EME_ESTADO
--     FROM PAR_MEMBRESIA m
--     JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
--     LEFT JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
--    WHERE (LOWER(em.EME_ESTADO) LIKE '%suspend%' OR LOWER(em.EME_ESTADO) LIKE '%inactiv%')
--      AND TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
--      AND NOT EXISTS (SELECT 1 FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
--                        JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
--                       WHERE dpm.MEM_ID = m.MEM_ID
--                         AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO)
--    ORDER BY m.MEM_ID;
--
-- Uso (SQL*Plus / SQLcl):  SET SERVEROUTPUT ON  y luego ejecutar este archivo.
-- No libera espacios: el job diario de membresias reconcilia PAR_ESPACIO.
-- =============================================================================

DECLARE
  v_eme_vencida NUMBER;
  v_updated     NUMBER := 0;
BEGIN
  SELECT MIN(EME_ID)
    INTO v_eme_vencida
    FROM PAR_ESTADO_MEMBRESIA
   WHERE LOWER(NVL(EME_ESTADO, '')) LIKE '%venc%';

  IF v_eme_vencida IS NULL THEN
    RAISE_APPLICATION_ERROR(-20120,
      'No existe el estado «Vencida» en PAR_ESTADO_MEMBRESIA. Corre primero el seed de catalogos.');
  END IF;

  -- Previsualizacion: lista lo que se va a reclasificar.
  FOR r IN (
    SELECT m.MEM_ID, v.VEH_PLACA, m.MEM_FECHA_VENCIMIENTO
      FROM PAR_MEMBRESIA m
      JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
      LEFT JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
     WHERE (LOWER(em.EME_ESTADO) LIKE '%suspend%' OR LOWER(em.EME_ESTADO) LIKE '%inactiv%')
       AND TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
       AND m.EME_ID <> v_eme_vencida
       AND NOT EXISTS (
             SELECT 1
               FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
               JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
              WHERE dpm.MEM_ID = m.MEM_ID
                AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
           )
     ORDER BY m.MEM_ID
  ) LOOP
    DBMS_OUTPUT.PUT_LINE(
      'MEM_ID ' || r.MEM_ID || '  placa ' || NVL(r.VEH_PLACA, 'N/D') ||
      '  vencio ' || TO_CHAR(r.MEM_FECHA_VENCIMIENTO, 'YYYY-MM-DD'));
  END LOOP;

  UPDATE PAR_MEMBRESIA m
     SET m.EME_ID = v_eme_vencida,
         m.MEM_FECHA_ULTIMO_CAMBIO_ESTADO = SYSDATE
   WHERE TRUNC(SYSDATE) > TRUNC(m.MEM_FECHA_VENCIMIENTO)
     AND m.EME_ID <> v_eme_vencida
     AND EXISTS (
           SELECT 1
             FROM PAR_ESTADO_MEMBRESIA em
            WHERE em.EME_ID = m.EME_ID
              AND (LOWER(em.EME_ESTADO) LIKE '%suspend%'
                   OR LOWER(em.EME_ESTADO) LIKE '%inactiv%')
         )
     AND NOT EXISTS (
           SELECT 1
             FROM PAR_DETALLE_PAGO_MEMBRESIA dpm
             JOIN PAR_PAGO p ON p.PAG_ID = dpm.PAG_ID
            WHERE dpm.MEM_ID = m.MEM_ID
              AND p.PAG_FECHA_HORA >= m.MEM_FECHA_VENCIMIENTO
         );

  v_updated := SQL%ROWCOUNT;
  DBMS_OUTPUT.PUT_LINE('Membresias reclasificadas «Suspendida» -> «Vencida»: ' || v_updated);

  COMMIT;
END;
/
