import { getConnection } from '../db/oracle.js';
import oracledb from 'oracledb';

export async function getAll() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      'SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION FROM PAR_ESTADO_MAQUINA ORDER BY EMA_ID',
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
      'SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION FROM PAR_ESTADO_MAQUINA WHERE EMA_ID = :id',
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (conn) await conn.close();
  }
}

export async function create({ EMA_ID, EMA_ESTADO, EMA_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION)
       VALUES (:EMA_ID, :EMA_ESTADO, :EMA_DESCRIPCION)`,
      { EMA_ID, EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    return { EMA_ID, EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null };
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, { EMA_ESTADO, EMA_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_ESTADO_MAQUINA
          SET EMA_ESTADO      = :EMA_ESTADO,
              EMA_DESCRIPCION = :EMA_DESCRIPCION
        WHERE EMA_ID = :id`,
      { id, EMA_ESTADO, EMA_DESCRIPCION: EMA_DESCRIPCION ?? null },
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
    const result = await conn.execute(
      'DELETE FROM PAR_ESTADO_MAQUINA WHERE EMA_ID = :id',
      { id },
      { autoCommit: true }
    );
    return result.rowsAffected > 0;
  } finally {
    if (conn) await conn.close();
  }
}
