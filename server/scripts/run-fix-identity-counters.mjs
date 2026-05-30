/**
 * Ejecuta database/migrations/2026-05-14_identity_nocache.sql contra Oracle.
 * Uso (desde carpeta server): npm run db:fix-identity-counters
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

function prepareSql(raw) {
  let s = raw.replace(/--[^\r\n]*/g, '');
  const lines = s.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length && lines[lines.length - 1].trim() === '/') lines.pop();
  return lines.join('\n').trim();
}

async function main() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.error('Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../../database/migrations/2026-05-14_identity_nocache.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('No existe:', sqlPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(sqlPath, 'utf8');
  const sql = prepareSql(raw);
  if (!sql) {
    console.error('Archivo SQL vacío');
    process.exit(1);
  }

  const conn = await oracledb.getConnection({ user, password, connectString });
  try {
    await conn.execute(sql);
    console.log('OK: identidad ajustada con START WITH LIMIT VALUE y NOCACHE');
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
