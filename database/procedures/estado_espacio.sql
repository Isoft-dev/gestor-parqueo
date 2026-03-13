-- ============================================================
-- Stored Procedures para PAR_ESTADO_ESPACIO
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_ESTADO_ESPACIO_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT EES_ID, EES_ESTADO
        FROM PAR_ESTADO_ESPACIO
        ORDER BY EES_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_ESPACIO_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT EES_ID, EES_ESTADO
        FROM PAR_ESTADO_ESPACIO
        WHERE EES_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_ESPACIO_CREATE (
    p_ees_id     IN VARCHAR2,
    p_ees_estado IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_ESTADO_ESPACIO (EES_ID, EES_ESTADO)
    VALUES (p_ees_id, p_ees_estado);
END;
/
