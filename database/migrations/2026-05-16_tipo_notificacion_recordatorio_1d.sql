-- Agregar el tipo de notificacion "Recordatorio -1d" (1 dia antes del vencimiento).
-- Idempotente: solo inserta si no existe.

BEGIN
  DECLARE
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
      FROM PAR_TIPO_NOTIFICACION
     WHERE TNO_TIPO = 'Recordatorio -1d';
    IF v_count = 0 THEN
      INSERT INTO PAR_TIPO_NOTIFICACION (TNO_ID, TNO_TIPO, TNO_DESCRIPCION)
      VALUES (DEFAULT, 'Recordatorio -1d', 'Un día antes del vencimiento');
      COMMIT;
    END IF;
  END;
END;
/
