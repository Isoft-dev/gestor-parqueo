/**
 * Script de despliegue de stored procedures.
 * Lee todos los .sql de database/procedures/ y los ejecuta en Oracle.
 *
 * Uso (desde la carpeta server/):
 *   node deploy.js              → despliega todos los archivos
 *   node deploy.js tarifa.sql   → despliega solo ese archivo
 */

import oracledb from 'oracledb';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dirname, '.env') });

const PROCEDURES_DIR = join(__dirname, '../database/procedures');

const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
};

if (!dbConfig.user || !dbConfig.password || !dbConfig.connectString) {
  console.error('ERROR: Faltan variables de entorno en server/.env');
  process.exit(1);
}

async function deployFile(conn, filePath) {
  const content = readFileSync(filePath, 'utf8');

  // Cada procedure termina con una línea que solo tiene "/"
  const statements = content
    .split(/\n\/\s*\n/)
    .map(s => {
      // Eliminar líneas de comentario SQL al inicio del segmento
      return s.replace(/^(\s*--[^\n]*\n)+/m, '').trim();
    })
    .filter(s => s.length > 0 && /^CREATE/i.test(s));

  let ok = 0;
  let errors = 0;

  for (const stmt of statements) {
    const match = stmt.match(/PROCEDURE\s+(\w+)/i);
    const procName = match ? match[1] : '?';
    try {
      await conn.execute(stmt);
      console.log(`  [OK] ${procName}`);
      ok++;
    } catch (err) {
      console.error(`  [ERROR] ${procName}: ${err.message.split('\n')[0]}`);
      errors++;
    }
  }

  return { ok, errors };
}

async function main() {
  const targetFile = process.argv[2];

  const files = targetFile
    ? [join(PROCEDURES_DIR, targetFile)]
    : readdirSync(PROCEDURES_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .map(f => join(PROCEDURES_DIR, f));

  console.log(`\nDesplegando ${files.length} archivo(s) -> ${dbConfig.connectString}\n`);

  let conn;
  let totalOk = 0;
  let totalErrors = 0;

  try {
    conn = await oracledb.getConnection(dbConfig);
    console.log('Conectado a Oracle.\n');

    for (const filePath of files) {
      console.log(`Archivo: ${basename(filePath)}`);
      const { ok, errors } = await deployFile(conn, filePath);
      totalOk += ok;
      totalErrors += errors;
      console.log();
    }

    console.log('─'.repeat(50));
    console.log(`Resultado: ${totalOk} OK${totalErrors > 0 ? `, errores: ${totalErrors}` : ''}`);
  } catch (err) {
    console.error('ERROR: Error de conexion a Oracle:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

main();
