-- ============================================================
-- Stored Procedures para PAR_ESTADO_MAQUINA
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_ESTADO_MAQUINA_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION
        FROM PAR_ESTADO_MAQUINA
        ORDER BY EMA_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_MAQUINA_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION
        FROM PAR_ESTADO_MAQUINA
        WHERE EMA_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_MAQUINA_CREATE (
    p_ema_id          IN VARCHAR2,
    p_ema_estado      IN VARCHAR2,
    p_ema_descripcion IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION)
    VALUES (p_ema_id, p_ema_estado, p_ema_descripcion);
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_MAQUINA_UPDATE (
    p_ema_id          IN VARCHAR2,
    p_ema_estado      IN VARCHAR2,
    p_ema_descripcion IN VARCHAR2
) AS
BEGIN
    UPDATE PAR_ESTADO_MAQUINA
    SET EMA_ESTADO      = p_ema_estado,
        EMA_DESCRIPCION = p_ema_descripcion
    WHERE EMA_ID = p_ema_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESTADO_MAQUINA_DELETE (
    p_id      IN  VARCHAR2,
    p_deleted OUT NUMBER
) AS
BEGIN
    DELETE FROM PAR_ESTADO_MAQUINA WHERE EMA_ID = p_id;
    p_deleted := SQL%ROWCOUNT;
END;
/
