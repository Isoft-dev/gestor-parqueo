/**
 * Ejecuta database/seed_catalogo_funcional.sql contra Oracle (misma conexión que .env).
 * Uso (desde carpeta server): npm run db:seed-catalogo-funcional
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

/** Comentarios `--` y terminador `/` de SQL*Plus (oracledb.execute no admite `/` suelto al final). */
function prepareSeedSql(raw) {
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

  const sqlPath = path.join(__dirname, '../../database/seed_catalogo_funcional.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('No existe:', sqlPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(sqlPath, 'utf8');
  const sql = prepareSeedSql(raw);
  if (!sql) {
    console.error('Archivo SQL vacío');
    process.exit(1);
  }

  const conn = await oracledb.getConnection({ user, password, connectString });
  try {
    await conn.execute(sql);
    console.log('OK: ejecutado seed_catalogo_funcional.sql (bloque PL/SQL completo)');
    await conn.commit();
    console.log('Hecho: seed_catalogo_funcional.sql aplicado (COMMIT).');
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
