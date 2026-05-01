/**
 * 1) DROP de todos los procedimientos del usuario cuyo nombre empieza por SP_
 * 2) Ejecuta todos los .sql en database/procedures/ (orden alfabético)
 *
 * Uso (desde carpeta server): node scripts/reinstall-procedures.mjs
 * Requiere ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING en .env
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const proceduresDir = path.join(__dirname, '../../database/procedures');

function splitSqlBlocks(content) {
  return content
    .split(/^\s*\/\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.error('Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env');
    process.exit(1);
  }

  if (!fs.existsSync(proceduresDir)) {
    console.error('No existe la carpeta:', proceduresDir);
    process.exit(1);
  }

  const conn = await oracledb.getConnection({ user, password, connectString });

  try {
    const dropResult = await conn.execute(
      `SELECT object_name
         FROM user_objects
        WHERE object_type = 'PROCEDURE'
          AND object_name LIKE 'SP_%'
        ORDER BY object_name`
    );
    const toDrop = dropResult.rows || [];
    console.log(`Eliminando ${toDrop.length} procedimiento(s) SP_* ...`);
    for (const row of toDrop) {
      const name = row.OBJECT_NAME;
      await conn.execute(`DROP PROCEDURE ${name}`);
      console.log(`  DROP ${name}`);
    }

    const files = fs
      .readdirSync(proceduresDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`\nCreando ${files.length} archivo(s) SQL ...`);
    for (const file of files) {
      const full = path.join(proceduresDir, file);
      const content = fs.readFileSync(full, 'utf8');
      const blocks = splitSqlBlocks(content);
      if (blocks.length === 0) {
        console.warn(`  (vacío) ${file}`);
        continue;
      }
      let n = 0;
      for (const sql of blocks) {
        n += 1;
        await conn.execute(sql);
        console.log(`  ${file} [${n}/${blocks.length}] OK`);
      }
    }

    await conn.commit();
    console.log('\nHecho: procedimientos del proyecto reinstalados.');
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
