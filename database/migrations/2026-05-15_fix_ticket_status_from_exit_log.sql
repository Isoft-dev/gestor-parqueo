-- Corrige tickets con salida ya registrada en PAR_DETALLE_MAQUINA_TICKET
-- pero cuyo estado final sigue en «Pagado».

DECLARE
  v_eti_validado NUMBER;
  v_updated      NUMBER := 0;
BEGIN
  SELECT MIN(ETI_ID)
    INTO v_eti_validado
    FROM PAR_ESTADO_TICKET
   WHERE LOWER(NVL(ETI_ESTADO, '')) LIKE '%valid%';

  IF v_eti_validado IS NULL THEN
    RAISE_APPLICATION_ERROR(-20001, 'No hay estado de ticket «Validado» (LIKE %valid%).');
  END IF;

  UPDATE PAR_TICKET t
     SET t.ETI_ID = v_eti_validado,
         t.TIC_FECHA_HORA_SALIDA = NVL(
           t.TIC_FECHA_HORA_SALIDA,
           (
             SELECT MAX(d.DMT_HORA_TRANSACCION)
               FROM PAR_DETALLE_MAQUINA_TICKET d
              WHERE d.TIC_ID = t.TIC_ID
                AND d.DMT_TRANSACCION = 'REGISTRO_SALIDA'
           )
         )
   WHERE LOWER(NVL((
           SELECT et.ETI_ESTADO
             FROM PAR_ESTADO_TICKET et
            WHERE et.ETI_ID = t.ETI_ID
         ), '')) LIKE '%pagad%'
     AND EXISTS (
           SELECT 1
             FROM PAR_DETALLE_MAQUINA_TICKET d
            WHERE d.TIC_ID = t.TIC_ID
              AND d.DMT_TRANSACCION = 'REGISTRO_SALIDA'
         );

  v_updated := SQL%ROWCOUNT;
  DBMS_OUTPUT.PUT_LINE('Tickets actualizados a Validado: ' || v_updated);
END;
/
