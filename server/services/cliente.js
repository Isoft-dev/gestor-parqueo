import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_CLIENTE_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_CLIENTE_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function findByDpi(dpi, excludeId = null) {
  if (!dpi) return null;
  const rows = await executeSql(
    `SELECT CLI_ID, CLI_DPI
     FROM PAR_CLIENTE
     WHERE CLI_DPI = :dpi
       AND (:excludeId IS NULL OR CLI_ID <> :excludeId)`,
    { dpi, excludeId }
  );
  return rows[0] || null;
}

export async function hasActiveMemberships(clientId) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
     FROM PAR_MEMBRESIA m
     JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
     LEFT JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
     WHERE v.CLI_ID = :clientId
       AND NVL(LOWER(em.EME_ESTADO), 'activa') NOT LIKE '%suspend%'
       AND NVL(LOWER(em.EME_ESTADO), 'activa') NOT LIKE '%inactiv%'`,
    { clientId }
  );
  return Number(rows[0]?.TOTAL || 0) > 0;
}

async function isClienteIdIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_CLIENTE'
        AND COLUMN_NAME = 'CLI_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  const existingDpi = await findByDpi(data.CLI_DPI);
  if (existingDpi) {
    throw new Error('Ya existe un cliente con el mismo CLI_DPI');
  }

  // Compatibilidad: en algunos entornos CLI_ID es identidad ALWAYS y Oracle no permite insertarlo.
  if ((await isClienteIdIdentityAlways()) || !data.CLI_ID) {
    await executeSql(
      `INSERT INTO PAR_CLIENTE (
        CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
        CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
        CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
        CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
      ) VALUES (
        :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
        :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
        :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
        :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO, SYSDATE
      )`,
      {
        CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
        CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
        CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
        CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
        CLI_DPI: data.CLI_DPI,
        CLI_NIT: data.CLI_NIT ?? null,
        CLI_CORREO: data.CLI_CORREO ?? null,
        CLI_TELEFONO: data.CLI_TELEFONO ?? null,
        CLI_ZONA: data.CLI_ZONA ?? null,
        CLI_CALLE: data.CLI_CALLE ?? null,
        CLI_NUMERO: data.CLI_NUMERO ?? null,
        CLI_COLONIA: data.CLI_COLONIA ?? null,
        CLI_CIUDAD: data.CLI_CIUDAD ?? null,
        CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
        CLI_ACTIVO: data.CLI_ACTIVO ?? 1,
      },
      { autoCommit: true }
    );

    const createdRows = await executeSql(
      `SELECT CLI_ID
         FROM PAR_CLIENTE
        WHERE CLI_DPI = :dpi
        ORDER BY CLI_ID DESC`,
      { dpi: data.CLI_DPI }
    );
    const createdId = createdRows[0]?.CLI_ID;
    return createdId ? getById(createdId) : null;
  }

  await executeProcedure(
    `BEGIN SP_CLIENTE_CREATE(
      :CLI_ID, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
      :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
      :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
      :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO
    ); END;`,
    {
      CLI_ID: data.CLI_ID,
      CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
      CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
      CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
      CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
      CLI_DPI: data.CLI_DPI,
      CLI_NIT: data.CLI_NIT ?? null,
      CLI_CORREO: data.CLI_CORREO ?? null,
      CLI_TELEFONO: data.CLI_TELEFONO ?? null,
      CLI_ZONA: data.CLI_ZONA ?? null,
      CLI_CALLE: data.CLI_CALLE ?? null,
      CLI_NUMERO: data.CLI_NUMERO ?? null,
      CLI_COLONIA: data.CLI_COLONIA ?? null,
      CLI_CIUDAD: data.CLI_CIUDAD ?? null,
      CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
      CLI_ACTIVO: data.CLI_ACTIVO ?? 1,
    }
  );
  return getById(data.CLI_ID);
}

export async function update(id, data) {
  const existingDpi = await findByDpi(data.CLI_DPI, id);
  if (existingDpi) {
    throw new Error('Ya existe otro cliente con el mismo CLI_DPI');
  }
  const willDisable = Number(data.CLI_ACTIVO) === 0;
  if (willDisable && (await hasActiveMemberships(id))) {
    throw new Error('No se puede desactivar un cliente con membresias activas');
  }
  await executeProcedure(
    `BEGIN SP_CLIENTE_UPDATE(
      :id, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
      :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
      :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
      :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO
    ); END;`,
    {
      id,
      CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
      CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
      CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
      CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
      CLI_DPI: data.CLI_DPI,
      CLI_NIT: data.CLI_NIT ?? null,
      CLI_CORREO: data.CLI_CORREO ?? null,
      CLI_TELEFONO: data.CLI_TELEFONO ?? null,
      CLI_ZONA: data.CLI_ZONA ?? null,
      CLI_CALLE: data.CLI_CALLE ?? null,
      CLI_NUMERO: data.CLI_NUMERO ?? null,
      CLI_COLONIA: data.CLI_COLONIA ?? null,
      CLI_CIUDAD: data.CLI_CIUDAD ?? null,
      CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
      CLI_ACTIVO: data.CLI_ACTIVO,
    }
  );
  return getById(id);
}
