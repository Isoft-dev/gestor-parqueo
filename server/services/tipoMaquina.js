import { getConnection } from '../db/oracle.js';
import oracledb from 'oracledb';

export async function getAll() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      'SELECT TMA_ID, TMA_TIPO, TMA_DESCRIPCION FROM PAR_TIPO_MAQUINA ORDER BY TMA_ID',
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
      'SELECT TMA_ID, TMA_TIPO, TMA_DESCRIPCION FROM PAR_TIPO_MAQUINA WHERE TMA_ID = :id',
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } finally {
    if (conn) await conn.close();
  }
}

export async function create({ TMA_ID, TMA_TIPO, TMA_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO PAR_TIPO_MAQUINA (TMA_ID, TMA_TIPO, TMA_DESCRIPCION)
       VALUES (:TMA_ID, :TMA_TIPO, :TMA_DESCRIPCION)`,
      { TMA_ID, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null },
      { autoCommit: true }
    );
    return { TMA_ID, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null };
  } finally {
    if (conn) await conn.close();
  }
}

export async function update(id, { TMA_TIPO, TMA_DESCRIPCION }) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE PAR_TIPO_MAQUINA
          SET TMA_TIPO        = :TMA_TIPO,
              TMA_DESCRIPCION = :TMA_DESCRIPCION
        WHERE TMA_ID = :id`,
      { id, TMA_TIPO, TMA_DESCRIPCION: TMA_DESCRIPCION ?? null },
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
      'DELETE FROM PAR_TIPO_MAQUINA WHERE TMA_ID = :id',
      { id },
      { autoCommit: true }
    );
    return result.rowsAffected > 0;
  } finally {
    if (conn) await conn.close();
  }
}
