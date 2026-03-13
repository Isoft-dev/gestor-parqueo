import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
  return executeCursor(
    `BEGIN SP_USUARIO_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_USUARIO_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  await executeProcedure(
    `BEGIN SP_USUARIO_CREATE(
      :USU_ID, :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE,
      :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO, :USU_CORREO,
      :USU_PASSWORD, :USU_TELEFONO, :ROL_ID, :USU_ACTIVO
    ); END;`,
    {
      USU_ID: data.USU_ID,
      USU_PRIMER_NOMBRE: data.USU_PRIMER_NOMBRE,
      USU_SEGUNDO_NOMBRE: data.USU_SEGUNDO_NOMBRE ?? null,
      USU_PRIMER_APELLIDO: data.USU_PRIMER_APELLIDO,
      USU_SEGUNDO_APELLIDO: data.USU_SEGUNDO_APELLIDO ?? null,
      USU_CORREO: data.USU_CORREO,
      USU_PASSWORD: data.USU_PASSWORD,
      USU_TELEFONO: data.USU_TELEFONO ?? null,
      ROL_ID: data.ROL_ID,
      USU_ACTIVO: data.USU_ACTIVO ?? 1,
    }
  );
  return getById(data.USU_ID);
}

export async function update(id, data) {
  await executeProcedure(
    `BEGIN SP_USUARIO_UPDATE(
      :id, :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE,
      :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO, :USU_CORREO,
      :USU_TELEFONO, :ROL_ID, :USU_ACTIVO
    ); END;`,
    {
      id,
      USU_PRIMER_NOMBRE: data.USU_PRIMER_NOMBRE,
      USU_SEGUNDO_NOMBRE: data.USU_SEGUNDO_NOMBRE ?? null,
      USU_PRIMER_APELLIDO: data.USU_PRIMER_APELLIDO,
      USU_SEGUNDO_APELLIDO: data.USU_SEGUNDO_APELLIDO ?? null,
      USU_CORREO: data.USU_CORREO,
      USU_TELEFONO: data.USU_TELEFONO ?? null,
      ROL_ID: data.ROL_ID,
      USU_ACTIVO: data.USU_ACTIVO,
    }
  );
  return getById(id);
}
