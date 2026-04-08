import oracledb from 'oracledb';
import { oracleConfig, isOracleConfigured } from '../config.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Return CLOB columns as strings automatically (avoids Lob circular-ref issues)
oracledb.fetchAsString = [oracledb.CLOB];

let pool = null;

export async function getPool() {
  if (!isOracleConfigured()) {
    throw new Error(
      'Oracle no configurado. Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env'
    );
  }
  if (!pool) {
    pool = await oracledb.createPool({
      user: oracleConfig.user,
      password: oracleConfig.password,
      connectString: oracleConfig.connectString,
      poolMin: 1,
      poolMax: 10,
      poolIncrement: 1,
    });
  }
  return pool;
}

export async function getConnection() {
  const p = await getPool();
  return p.getConnection();
}

export async function closePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}

export async function ping() {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute('SELECT 1 FROM DUAL');
    return { ok: true, rows: result.rows };
  } finally {
    if (conn) await conn.close();
  }
}

/**
 * Ejecuta un stored procedure que retorna un SYS_REFCURSOR.
 * El bind :cursor se agrega automáticamente.
 */
export async function executeCursor(sql, binds = {}) {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(sql, {
      ...binds,
      cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });
    const cursor = result.outBinds.cursor;
    const rows = await cursor.getRows();
    await cursor.close();
    return rows;
  } finally {
    if (conn) await conn.close();
  }
}

/**
 * Ejecuta un stored procedure de escritura (INSERT/UPDATE) sin OUT params.
 */
export async function executeProcedure(sql, binds = {}) {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(sql, binds, { autoCommit: true });
  } finally {
    if (conn) await conn.close();
  }
}

/**
 * Ejecuta un stored procedure DELETE con p_deleted OUT NUMBER.
 * Retorna true si se eliminó al menos un registro.
 */
export async function executeDelete(sql, binds = {}) {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      sql,
      {
        ...binds,
        deleted: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );
    return result.outBinds.deleted > 0;
  } finally {
    if (conn) await conn.close();
  }
}
