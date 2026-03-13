-- ============================================================
-- Stored Procedures para PAR_CLIENTE
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_CLIENTE_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
               CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
               CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
               CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO,
               CLI_FECHA_REGISTRO
        FROM PAR_CLIENTE
        ORDER BY CLI_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
               CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
               CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
               CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO,
               CLI_FECHA_REGISTRO
        FROM PAR_CLIENTE
        WHERE CLI_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_CREATE (
    p_cli_id               IN VARCHAR2,
    p_cli_primer_nombre    IN VARCHAR2,
    p_cli_segundo_nombre   IN VARCHAR2,
    p_cli_primer_apellido  IN VARCHAR2,
    p_cli_segundo_apellido IN VARCHAR2,
    p_cli_dpi              IN VARCHAR2,
    p_cli_nit              IN VARCHAR2,
    p_cli_correo           IN VARCHAR2,
    p_cli_telefono         IN VARCHAR2,
    p_cli_zona             IN VARCHAR2,
    p_cli_calle            IN VARCHAR2,
    p_cli_numero           IN VARCHAR2,
    p_cli_colonia          IN VARCHAR2,
    p_cli_ciudad           IN VARCHAR2,
    p_cli_codigo_postal    IN VARCHAR2,
    p_cli_activo           IN NUMBER
) AS
BEGIN
    INSERT INTO PAR_CLIENTE (
        CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
        CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
        CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
        CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO,
        CLI_FECHA_REGISTRO
    ) VALUES (
        p_cli_id, p_cli_primer_nombre, p_cli_segundo_nombre,
        p_cli_primer_apellido, p_cli_segundo_apellido, p_cli_dpi, p_cli_nit,
        p_cli_correo, p_cli_telefono, p_cli_zona, p_cli_calle, p_cli_numero,
        p_cli_colonia, p_cli_ciudad, p_cli_codigo_postal, p_cli_activo,
        SYSDATE
    );
END;
/

CREATE OR REPLACE PROCEDURE SP_CLIENTE_UPDATE (
    p_cli_id               IN VARCHAR2,
    p_cli_primer_nombre    IN VARCHAR2,
    p_cli_segundo_nombre   IN VARCHAR2,
    p_cli_primer_apellido  IN VARCHAR2,
    p_cli_segundo_apellido IN VARCHAR2,
    p_cli_dpi              IN VARCHAR2,
    p_cli_nit              IN VARCHAR2,
    p_cli_correo           IN VARCHAR2,
    p_cli_telefono         IN VARCHAR2,
    p_cli_zona             IN VARCHAR2,
    p_cli_calle            IN VARCHAR2,
    p_cli_numero           IN VARCHAR2,
    p_cli_colonia          IN VARCHAR2,
    p_cli_ciudad           IN VARCHAR2,
    p_cli_codigo_postal    IN VARCHAR2,
    p_cli_activo           IN NUMBER
) AS
BEGIN
    UPDATE PAR_CLIENTE
    SET CLI_PRIMER_NOMBRE    = p_cli_primer_nombre,
        CLI_SEGUNDO_NOMBRE   = p_cli_segundo_nombre,
        CLI_PRIMER_APELLIDO  = p_cli_primer_apellido,
        CLI_SEGUNDO_APELLIDO = p_cli_segundo_apellido,
        CLI_DPI              = p_cli_dpi,
        CLI_NIT              = p_cli_nit,
        CLI_CORREO           = p_cli_correo,
        CLI_TELEFONO         = p_cli_telefono,
        CLI_ZONA             = p_cli_zona,
        CLI_CALLE            = p_cli_calle,
        CLI_NUMERO           = p_cli_numero,
        CLI_COLONIA          = p_cli_colonia,
        CLI_CIUDAD           = p_cli_ciudad,
        CLI_CODIGO_POSTAL    = p_cli_codigo_postal,
        CLI_ACTIVO           = p_cli_activo
    WHERE CLI_ID = p_cli_id;
END;
/
