-- ============================================================
-- Stored Procedures para PAR_ESPACIO
-- ============================================================

CREATE OR REPLACE PROCEDURE SP_ESPACIO_GET_ALL (
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT e.ESP_ID, e.ESP_CODIGO, e.EES_ID,
               ee.EES_ESTADO, e.ESP_UBICACION
        FROM PAR_ESPACIO e
        LEFT JOIN PAR_ESTADO_ESPACIO ee ON e.EES_ID = ee.EES_ID
        ORDER BY e.ESP_ID;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESPACIO_GET_BY_ID (
    p_id     IN  VARCHAR2,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT e.ESP_ID, e.ESP_CODIGO, e.EES_ID,
               ee.EES_ESTADO, e.ESP_UBICACION
        FROM PAR_ESPACIO e
        LEFT JOIN PAR_ESTADO_ESPACIO ee ON e.EES_ID = ee.EES_ID
        WHERE e.ESP_ID = p_id;
END;
/

CREATE OR REPLACE PROCEDURE SP_ESPACIO_CREATE (
    p_esp_id        IN VARCHAR2,
    p_esp_codigo    IN VARCHAR2,
    p_ees_id        IN VARCHAR2,
    p_esp_ubicacion IN VARCHAR2
) AS
BEGIN
    INSERT INTO PAR_ESPACIO (ESP_ID, ESP_CODIGO, EES_ID, ESP_UBICACION)
    VALUES (p_esp_id, p_esp_codigo, p_ees_id, p_esp_ubicacion);
END;
/

CREATE OR REPLACE PROCEDURE SP_ESPACIO_UPDATE (
    p_esp_id        IN VARCHAR2,
    p_esp_codigo    IN VARCHAR2,
    p_ees_id        IN VARCHAR2,
    p_esp_ubicacion IN VARCHAR2
) AS
BEGIN
    UPDATE PAR_ESPACIO
    SET ESP_CODIGO    = p_esp_codigo,
        EES_ID        = p_ees_id,
        ESP_UBICACION = p_esp_ubicacion
    WHERE ESP_ID = p_esp_id;
END;
/
