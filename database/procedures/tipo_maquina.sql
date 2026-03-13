-- ============================================================
-- Stored Procedures para PAR_TIPO_MAQUINA
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_TIPO_MAQUINA_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT TMA_ID, TMA_TIPO, TMA_DESCRIPCION
        FROM PAR_TIPO_MAQUINA
        ORDER BY TMA_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_TIPO_MAQUINA_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT TMA_ID, TMA_TIPO, TMA_DESCRIPCION
        FROM PAR_TIPO_MAQUINA
        WHERE TMA_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_TIPO_MAQUINA_CREATE (
    p_tma_id          IN VARCHAR2,
    p_tma_tipo        IN VARCHAR2,
    p_tma_descripcion IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_TIPO_MAQUINA (TMA_ID, TMA_TIPO, TMA_DESCRIPCION)
    VALUES (p_tma_id, p_tma_tipo, p_tma_descripcion);
END;
/

CREATE OR REPLACE PROCEDURE SP_TIPO_MAQUINA_UPDATE (
    p_tma_id          IN VARCHAR2,
    p_tma_tipo        IN VARCHAR2,
    p_tma_descripcion IN VARCHAR2
) AS
BEGIN
    UPDATE PAR_TIPO_MAQUINA
    SET TMA_TIPO        = p_tma_tipo,
        TMA_DESCRIPCION = p_tma_descripcion
    WHERE TMA_ID = p_tma_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_TIPO_MAQUINA_DELETE (
    p_id      IN  VARCHAR2,
    p_deleted OUT NUMBER
) AS
BEGIN
    DELETE FROM PAR_TIPO_MAQUINA WHERE TMA_ID = p_id;
    p_deleted := SQL%ROWCOUNT;
END;
/
