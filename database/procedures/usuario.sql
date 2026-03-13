-- ============================================================
-- Stored Procedures para PAR_USUARIO
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_USUARIO_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT USU_ID, USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE,
               USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO, USU_CORREO,
               USU_TELEFONO, ROL_ID, USU_ACTIVO,
               USU_FECHA_CREACION, USU_FECHA_ACTUALIZACION
        FROM PAR_USUARIO
        ORDER BY USU_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_USUARIO_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT USU_ID, USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE,
               USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO, USU_CORREO,
               USU_TELEFONO, ROL_ID, USU_ACTIVO,
               USU_FECHA_CREACION, USU_FECHA_ACTUALIZACION
        FROM PAR_USUARIO
        WHERE USU_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_USUARIO_CREATE (
    p_usu_id               IN VARCHAR2,
    p_usu_primer_nombre    IN VARCHAR2,
    p_usu_segundo_nombre   IN VARCHAR2,
    p_usu_primer_apellido  IN VARCHAR2,
    p_usu_segundo_apellido IN VARCHAR2,
    p_usu_correo           IN VARCHAR2,
    p_usu_password         IN VARCHAR2,
    p_usu_telefono         IN VARCHAR2,
    p_rol_id               IN VARCHAR2,
    p_usu_activo           IN NUMBER
) AS
BEGIN
    INSERT INTO PAR_USUARIO (
        USU_ID, USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE,
        USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO, USU_CORREO,
        USU_PASSWORD, USU_TELEFONO, ROL_ID, USU_ACTIVO,
        USU_FECHA_CREACION
    ) VALUES (
        p_usu_id, p_usu_primer_nombre, p_usu_segundo_nombre,
        p_usu_primer_apellido, p_usu_segundo_apellido, p_usu_correo,
        p_usu_password, p_usu_telefono, p_rol_id, p_usu_activo,
        SYSDATE
    );
END;
/

CREATE OR REPLACE PROCEDURE SP_USUARIO_UPDATE (
    p_usu_id               IN VARCHAR2,
    p_usu_primer_nombre    IN VARCHAR2,
    p_usu_segundo_nombre   IN VARCHAR2,
    p_usu_primer_apellido  IN VARCHAR2,
    p_usu_segundo_apellido IN VARCHAR2,
    p_usu_correo           IN VARCHAR2,
    p_usu_telefono         IN VARCHAR2,
    p_rol_id               IN VARCHAR2,
    p_usu_activo           IN NUMBER
) AS
BEGIN
    UPDATE PAR_USUARIO
    SET USU_PRIMER_NOMBRE       = p_usu_primer_nombre,
        USU_SEGUNDO_NOMBRE      = p_usu_segundo_nombre,
        USU_PRIMER_APELLIDO     = p_usu_primer_apellido,
        USU_SEGUNDO_APELLIDO    = p_usu_segundo_apellido,
        USU_CORREO              = p_usu_correo,
        USU_TELEFONO            = p_usu_telefono,
        ROL_ID                  = p_rol_id,
        USU_ACTIVO              = p_usu_activo,
        USU_FECHA_ACTUALIZACION = SYSDATE
    WHERE USU_ID = p_usu_id;
END;
/
