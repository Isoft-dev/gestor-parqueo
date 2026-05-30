CREATE OR REPLACE PROCEDURE SP_VEHICULO_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT v.VEH_ID,
               v.VEH_PLACA,
               v.MOD_ID,
               mod.MOD_NOMBRE AS VEH_MODELO,
               v.COL_ID,
               col.COL_NOMBRE AS VEH_COLOR,
               mod.TVE_ID,
               tv.TVE_TIPO,
               mod.MAR_ID,
               mar.MAR_NOMBRE,
               v.CLI_ID
        FROM PAR_VEHICULO v
        LEFT JOIN PAR_MODELO_VEHICULO mod ON v.MOD_ID = mod.MOD_ID
        LEFT JOIN PAR_MARCA_VEHICULO mar ON mod.MAR_ID = mar.MAR_ID
        LEFT JOIN PAR_TIPO_VEHICULO tv ON mod.TVE_ID = tv.TVE_ID
        LEFT JOIN PAR_COLOR_VEHICULO col ON v.COL_ID = col.COL_ID
        ORDER BY v.VEH_ID;
END SP_VEHICULO_GET_ALL;
/

CREATE OR REPLACE PROCEDURE SP_VEHICULO_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT v.VEH_ID,
               v.VEH_PLACA,
               v.MOD_ID,
               mod.MOD_NOMBRE AS VEH_MODELO,
               v.COL_ID,
               col.COL_NOMBRE AS VEH_COLOR,
               mod.TVE_ID,
               tv.TVE_TIPO,
               mod.MAR_ID,
               mar.MAR_NOMBRE,
               v.CLI_ID
        FROM PAR_VEHICULO v
        LEFT JOIN PAR_MODELO_VEHICULO mod ON v.MOD_ID = mod.MOD_ID
        LEFT JOIN PAR_MARCA_VEHICULO mar ON mod.MAR_ID = mar.MAR_ID
        LEFT JOIN PAR_TIPO_VEHICULO tv ON mod.TVE_ID = tv.TVE_ID
        LEFT JOIN PAR_COLOR_VEHICULO col ON v.COL_ID = col.COL_ID
        WHERE v.VEH_ID = p_id;
END SP_VEHICULO_GET_BY_ID;
/

CREATE OR REPLACE PROCEDURE SP_VEHICULO_CREATE (
    p_VEH_ID    IN VARCHAR2,
    p_VEH_PLACA IN VARCHAR2,
    p_MOD_ID    IN VARCHAR2,
    p_COL_ID    IN VARCHAR2,
    p_CLI_ID    IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_VEHICULO (VEH_ID, VEH_PLACA, MOD_ID, COL_ID, CLI_ID)
    VALUES (p_VEH_ID, p_VEH_PLACA, p_MOD_ID, p_COL_ID, p_CLI_ID);
    COMMIT;
END SP_VEHICULO_CREATE;
/

CREATE OR REPLACE PROCEDURE SP_VEHICULO_UPDATE (
    p_id        IN VARCHAR2,
    p_VEH_PLACA IN VARCHAR2,
    p_MOD_ID    IN VARCHAR2,
    p_COL_ID    IN VARCHAR2,
    p_CLI_ID    IN VARCHAR2
) AS
BEGIN
    UPDATE PAR_VEHICULO
    SET VEH_PLACA = p_VEH_PLACA,
        MOD_ID    = p_MOD_ID,
        COL_ID    = p_COL_ID,
        CLI_ID    = p_CLI_ID
    WHERE VEH_ID = p_id;
    COMMIT;
END SP_VEHICULO_UPDATE;
/
