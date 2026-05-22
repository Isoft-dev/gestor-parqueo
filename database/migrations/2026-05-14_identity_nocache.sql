-- Ajusta las columnas IDENTITY del esquema PAR_* para:
-- 1) reanudar el siguiente valor desde el máximo existente
-- 2) evitar saltos grandes al reiniciar Oracle o perder caché de secuencia

DECLARE
  v_sql VARCHAR2(4000);
BEGIN
  FOR r IN (
    SELECT TABLE_NAME, COLUMN_NAME
      FROM USER_TAB_IDENTITY_COLS
     WHERE TABLE_NAME LIKE 'PAR\_%' ESCAPE '\'
     ORDER BY TABLE_NAME, COLUMN_NAME
  ) LOOP
    v_sql :=
      'ALTER TABLE ' || r.TABLE_NAME ||
      ' MODIFY ' || r.COLUMN_NAME ||
      ' GENERATED ALWAYS AS IDENTITY (START WITH LIMIT VALUE)';
    EXECUTE IMMEDIATE v_sql;

    v_sql :=
      'ALTER TABLE ' || r.TABLE_NAME ||
      ' MODIFY ' || r.COLUMN_NAME ||
      ' GENERATED ALWAYS AS IDENTITY (NOCACHE)';
    EXECUTE IMMEDIATE v_sql;
  END LOOP;
END;
/
