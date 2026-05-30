/**
 * Ejecuta un .sql contra Oracle (misma conexión que server/.env).
 * - DDL (CREATE/ALTER): varias sentencias separadas por ;
 * - PL/SQL (DECLARE/BEGIN): un solo bloque (sin / final de SQL*Plus)
 *
 * Uso: node scripts/run-sql-file.mjs ../../database/PAR_ENTIDADES_OFICIAL.sql
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function stripLineComments(raw) {
  return raw.replace(/--[^\r\n]*/g, '');
}

/** Directivas de SQL*Plus / SQL Developer que node-oracledb no ejecuta. */
function isSqlPlusSetDirective(line) {
  const t = line.trim();
  if (!/^SET\s+/i.test(t)) return false;
  return /^SET\s+(SERVEROUTPUT|DEFINE|LINESIZE|PAGESIZE|FEEDBACK|ECHO|VERIFY|HEADING|TERMOUT|TRIMSPOOL|SQLBLANKLINES|TIME|TIMING|SCAN|CONCAT|NULL|PAUSE|SERVER)\b/i.test(
    t,
  );
}

function stripSqlPlusDirectives(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (isSqlPlusSetDirective(line)) return false;
      if (/^SPOOL(\s+|$)/i.test(t)) return false;
      if (/^PROMPT(\s+|$)/i.test(t)) return false;
      if (/^WHENEVER\s+/i.test(t)) return false;
      return true;
    })
    .join('\n');
}

function normalizeSqlFile(raw) {
  return stripLineComments(stripSqlPlusDirectives(raw));
}

function preparePlSqlBlock(raw) {
  let s = normalizeSqlFile(raw);
  const lines = s.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length && lines[lines.length - 1].trim() === '/') lines.pop();
  return lines.join('\n').trim();
}

function splitPlSqlBlocks(raw) {
  const normalized = normalizeSqlFile(raw);
  return normalized
    .split(/\r?\n\s*\/\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) => /^(DECLARE|BEGIN)\b/i.test(part));
}

function splitDdlStatements(raw) {
  return normalizeSqlFile(raw)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isPlSqlFile(content) {
  const stripped = normalizeSqlFile(content).trim();
  return /^(DECLARE|BEGIN)\b/i.test(stripped);
}

export async function executeSqlFile(conn, filePath, { label } = {}) {
  const name = label || path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    throw new Error(`Archivo SQL vacío: ${name}`);
  }

  if (isPlSqlFile(raw)) {
    const blocks = splitPlSqlBlocks(raw);
    const toRun = blocks.length > 0 ? blocks : [preparePlSqlBlock(raw)];
    for (let i = 0; i < toRun.length; i += 1) {
      await conn.execute(toRun[i], {}, { autoCommit: false });
      const suffix = toRun.length > 1 ? ` ${i + 1}/${toRun.length}` : '';
      console.log(`  [OK] ${name} (bloque PL/SQL${suffix})`);
    }
    return toRun.length;
  }

  const statements = splitDdlStatements(raw);
  let n = 0;
  for (const stmt of statements) {
    n += 1;
    const preview = stmt.split(/\r?\n/)[0].slice(0, 72);
    try {
      await conn.execute(stmt);
      console.log(`  [OK] ${name} #${n}: ${preview}...`);
    } catch (err) {
      const code = err.errorNum ?? err.code;
      console.error(`  [ERROR] ${name} #${n}: ${preview}...`);
      console.error(`           ORA-${code ?? '?'}: ${err.message}`);
      throw err;
    }
  }
  return statements.length;
}

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Uso: node scripts/run-sql-file.mjs <ruta-al-archivo.sql>');
    process.exit(1);
  }

  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.error('Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env');
    process.exit(1);
  }

  const filePath = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  const conn = await oracledb.getConnection({ user, password, connectString });
  try {
    console.log(`Ejecutando ${path.basename(filePath)} ...`);
    await executeSqlFile(conn, filePath);
    await conn.commit();
    console.log('COMMIT.');
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
