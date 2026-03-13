import { executeCursor, executeProcedure } from '../db/oracle.js';

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

export async function create(data) {
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
