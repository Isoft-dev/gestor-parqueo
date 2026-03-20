CREATE OR REPLACE PROCEDURE SP_ROL_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT ROL_ID, ROL_TIPO, ROL_DESCRIPCION
        FROM PAR_ROL
        ORDER BY ROL_ID;
END SP_ROL_GET_ALL;
/

CREATE OR REPLACE PROCEDURE SP_ROL_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT ROL_ID, ROL_TIPO, ROL_DESCRIPCION
        FROM PAR_ROL
        WHERE ROL_ID = p_id;
END SP_ROL_GET_BY_ID;
/

CREATE OR REPLACE PROCEDURE SP_ROL_CREATE (
    p_rol_id          IN VARCHAR2,
    p_rol_tipo        IN VARCHAR2,
    p_rol_descripcion IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_ROL (ROL_ID, ROL_TIPO, ROL_DESCRIPCION)
    VALUES (p_rol_id, p_rol_tipo, p_rol_descripcion);
    COMMIT;
END SP_ROL_CREATE;
/

CREATE OR REPLACE PROCEDURE SP_ROL_UPDATE (
    p_rol_id          IN VARCHAR2,
    p_rol_tipo        IN VARCHAR2,
    p_rol_descripcion IN VARCHAR2
) AS
BEGIN
    UPDATE PAR_ROL
    SET ROL_TIPO        = p_rol_tipo,
        ROL_DESCRIPCION = p_rol_descripcion
    WHERE ROL_ID = p_rol_id;
    COMMIT;
END SP_ROL_UPDATE;
/

CREATE OR REPLACE PROCEDURE SP_ROL_DELETE (
    p_id      IN  VARCHAR2,
    p_deleted OUT NUMBER
) AS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM PAR_USUARIO
    WHERE ROL_ID = p_id;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'No se puede eliminar: el rol tiene usuarios asociados');
    END IF;
    DELETE FROM PAR_ROL WHERE ROL_ID = p_id;
    p_deleted := SQL%ROWCOUNT;
    COMMIT;
END SP_ROL_DELETE;
/
