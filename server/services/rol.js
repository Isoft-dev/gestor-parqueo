import { getConnection } from '../db/oracle.js';
import oracledb from 'oracledb';

export async function getAll() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      'SELECT ROL_ID, ROL_TIPO, ROL_DESCRIPCION FROM PAR_ROL ORDER BY ROL_ID',
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
      'SELECT ROL_ID, ROL_TIPO, ROL_DESCRIPCION FROM PAR_ROL WHERE ROL_ID = :id',
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (conn) await conn.close();
  }
}

export async function create({ ROL_ID, ROL_TIPO, ROL_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO PAR_ROL (ROL_ID, ROL_TIPO, ROL_DESCRIPCION)
       VALUES (:ROL_ID, :ROL_TIPO, :ROL_DESCRIPCION)`,
      { ROL_ID, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    return { ROL_ID, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null };
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, { ROL_TIPO, ROL_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_ROL
          SET ROL_TIPO        = :ROL_TIPO,
              ROL_DESCRIPCION = :ROL_DESCRIPCION
        WHERE ROL_ID = :id`,
      { id, ROL_TIPO, ROL_DESCRIPCION: ROL_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    return getById(id);
  } finally {
    if (conn) await conn.close();
  }
}

export async function remove(id) {
  let conn;
  try {
    conn = await getConnection();

    const check = await conn.execute(
      'SELECT COUNT(*) AS TOTAL FROM PAR_USUARIO WHERE ROL_ID = :id',
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (check.rows[0].TOTAL > 0) {
      throw new Error('No se puede eliminar: el rol tiene usuarios asociados');
    }

    const result = await conn.execute(
      'DELETE FROM PAR_ROL WHERE ROL_ID = :id',
      { id },
      { autoCommit: true }
    );
    return result.rowsAffected > 0;
  } finally {
    if (conn) await conn.close();
  }
}
