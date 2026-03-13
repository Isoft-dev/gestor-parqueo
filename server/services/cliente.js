import { getConnection } from '../db/oracle.js';
import oracledb from 'oracledb';

const COLUMNS = `CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
  CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
  CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
  CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO`;

export async function getAll() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT ${COLUMNS} FROM PAR_CLIENTE ORDER BY CLI_ID`,
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
      `SELECT ${COLUMNS} FROM PAR_CLIENTE WHERE CLI_ID = :id`,
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
      `INSERT INTO PAR_CLIENTE
        (CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
         CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
         CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
         CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO)
       VALUES
        (:CLI_ID, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
         :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
         :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
         :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO, SYSDATE)`,
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
      },
      { autoCommit: true }
    );
    return getById(data.CLI_ID);
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, data) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_CLIENTE SET
         CLI_PRIMER_NOMBRE    = :CLI_PRIMER_NOMBRE,
         CLI_SEGUNDO_NOMBRE   = :CLI_SEGUNDO_NOMBRE,
         CLI_PRIMER_APELLIDO  = :CLI_PRIMER_APELLIDO,
         CLI_SEGUNDO_APELLIDO = :CLI_SEGUNDO_APELLIDO,
         CLI_DPI              = :CLI_DPI,
         CLI_NIT              = :CLI_NIT,
         CLI_CORREO           = :CLI_CORREO,
         CLI_TELEFONO         = :CLI_TELEFONO,
         CLI_ZONA             = :CLI_ZONA,
         CLI_CALLE            = :CLI_CALLE,
         CLI_NUMERO           = :CLI_NUMERO,
         CLI_COLONIA          = :CLI_COLONIA,
         CLI_CIUDAD           = :CLI_CIUDAD,
         CLI_CODIGO_POSTAL    = :CLI_CODIGO_POSTAL,
         CLI_ACTIVO           = :CLI_ACTIVO
       WHERE CLI_ID = :id`,
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
      },
      { autoCommit: true }
    );
    return getById(id);
  } finally {
    if (conn) await conn.close();
  }
}
