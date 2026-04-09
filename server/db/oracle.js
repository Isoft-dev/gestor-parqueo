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
 * Convierte valores de Oracle a tipos seguros para JSON.stringify (evita 500 al serializar respuestas).
 */
function serializeOracleValue(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return Number(v);
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) return null;
  if (typeof v === 'object') {
    if (typeof v.getData === 'function') {
      try {
        return String(v);
      } catch {
        return null;
      }
    }
  }
  return v;
}

function serializeOracleRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const key of Object.keys(row)) {
    out[key] = serializeOracleValue(row[key]);
  }
  return out;
}

function serializeOracleRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(serializeOracleRow);
}

/**
 * Ejecuta un stored procedure que retorna un SYS_REFCURSOR.
 * El bind :cursor se agrega automáticamente.
 */
export async function executeCursor(sql, binds = {}) {
  let conn;
  let cursor;
  try {
    conn = await getConnection();
    const result = await conn.execute(sql, {
      ...binds,
      cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });
    cursor = result.outBinds.cursor;
    const rows = await cursor.getRows();
    return serializeOracleRows(rows);
  } finally {
    if (cursor) {
      try {
        await cursor.close();
      } catch {
        /* ignore */
      }
    }
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

/**
 * Ejecuta SQL directo (SELECT/UPDATE) con binds.
 * Para SELECT retorna un arreglo de filas.
 * Para escrituras retorna metadata de filas afectadas.
 */
export async function executeSql(sql, binds = {}, options = {}) {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(sql, binds, {
      autoCommit: options.autoCommit ?? false,
    });
    if (Array.isArray(result.rows)) return result.rows.map(serializeOracleRow);
    return { rowsAffected: result.rowsAffected ?? 0 };
  } finally {
    if (conn) await conn.close();
  }
}
