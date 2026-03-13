import { getConnection } from '../db/oracle.js';
import oracledb from 'oracledb';

const COLUMNS = `USU_ID, USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE,
  USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO, USU_CORREO,
  USU_TELEFONO, ROL_ID, USU_ACTIVO, USU_FECHA_CREACION, USU_FECHA_ACTUALIZACION`;

export async function getAll() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT ${COLUMNS} FROM PAR_USUARIO ORDER BY USU_ID`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } finally {
    if (conn) await conn.close();
  }
}

export async function getById(id) {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT ${COLUMNS} FROM PAR_USUARIO WHERE USU_ID = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (conn) await conn.close();
  }
}

export async function create(data) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO PAR_USUARIO
        (USU_ID, USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE,
         USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO, USU_CORREO,
         USU_PASSWORD, USU_TELEFONO, ROL_ID, USU_ACTIVO, USU_FECHA_CREACION)
       VALUES
        (:USU_ID, :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE,
         :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO, :USU_CORREO,
         :USU_PASSWORD, :USU_TELEFONO, :ROL_ID, :USU_ACTIVO, SYSDATE)`,
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
      },
      { autoCommit: true }
    );
    return getById(data.USU_ID);
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, data) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_USUARIO SET
         USU_PRIMER_NOMBRE      = :USU_PRIMER_NOMBRE,
         USU_SEGUNDO_NOMBRE     = :USU_SEGUNDO_NOMBRE,
         USU_PRIMER_APELLIDO    = :USU_PRIMER_APELLIDO,
         USU_SEGUNDO_APELLIDO   = :USU_SEGUNDO_APELLIDO,
         USU_CORREO             = :USU_CORREO,
         USU_TELEFONO           = :USU_TELEFONO,
         ROL_ID                 = :ROL_ID,
         USU_ACTIVO             = :USU_ACTIVO,
         USU_FECHA_ACTUALIZACION = SYSDATE
       WHERE USU_ID = :id`,
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
      },
      { autoCommit: true }
    );
    return getById(id);
  } finally {
    if (conn) await conn.close();
  }
}
