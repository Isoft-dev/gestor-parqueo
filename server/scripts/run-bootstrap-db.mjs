/**
 * Bootstrap de base vacía: esquema PAR_* + migraciones + procedures + seed.
 *
 * Uso (desde server/): pnpm db:bootstrap
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import oracledb from 'oracledb';
import { executeSqlFile } from './run-sql-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');
const databaseDir = path.join(repoRoot, 'database');

dotenv.config({ path: path.join(__dirname, '../.env') });

/** Antes del seed: solo cambios de esquema / columnas. */
const MIGRATIONS_PRE_SEED = [
  '2026-04-26_alerta_resolucion_fields.sql',
  '2026-05-15_registro_mantenimiento_movimientos.sql',
  '2026-05-16_notificacion_correo_simulado.sql',
];

/** Después del seed: correcciones de datos (requieren catálogos como «Validado», «Vencida»). */
const MIGRATIONS_POST_SEED = [
  '2026-05-15_machine_status_inoperativa.sql',
  '2026-05-16_tipo_notificacion_recordatorio_1d.sql',
  '2026-05-15_fix_ticket_status_from_exit_log.sql',
  '2026-05-22_membresia_suspendida_heredada_a_vencida.sql',
];

const SKIPPABLE_ORA = new Set([
  955, // name already used
  1430, // column already exists
  2261, // unique constraint already exists
  2275, // table already has FK
  2443, // constraint does not exist (drop)
]);

function runPnpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['run', scriptName], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} terminó con código ${code}`));
    });
  });
}

async function main() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.error('Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env');
    process.exit(1);
  }

  const schemaPath = path.join(databaseDir, 'PAR_ENTIDADES_OFICIAL.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('No existe:', schemaPath);
    process.exit(1);
  }

  console.log(`\n=== Bootstrap Oracle (${user} @ ${connectString}) ===\n`);

  const conn = await oracledb.getConnection({ user, password, connectString });

  try {
    console.log('1/6 Esquema PAR_ENTIDADES_OFICIAL.sql');
    await executeSqlFile(conn, schemaPath);
    await conn.commit();

    console.log('\n2/6 Migraciones de esquema (pre-seed)');
    for (const file of MIGRATIONS_PRE_SEED) {
      const full = path.join(databaseDir, 'migrations', file);
      if (!fs.existsSync(full)) {
        console.warn(`  (omitido, no existe) ${file}`);
        continue;
      }
      try {
        await executeSqlFile(conn, full, { label: file });
        await conn.commit();
      } catch (err) {
        const ora = err.errorNum;
        if (SKIPPABLE_ORA.has(ora)) {
          console.warn(`  [SKIP] ${file}: ORA-${ora} (ya aplicado en esquema oficial)`);
          await conn.rollback();
          continue;
        }
        throw err;
      }
    }
  } finally {
    await conn.close();
  }

  console.log('\n3/6 Stored procedures (SP_*)');
  await runPnpmScript('db:reinstall-procedures');

  console.log('\n4/6 Ajuste IDENTITY + seed de catálogos');
  await runPnpmScript('db:fix-identity-counters');
  await runPnpmScript('db:seed-catalogo-funcional');

  const conn2 = await oracledb.getConnection({ user, password, connectString });
  try {
    console.log('\n5/6 Migraciones de datos (post-seed)');
    for (const file of MIGRATIONS_POST_SEED) {
      const full = path.join(databaseDir, 'migrations', file);
      if (!fs.existsSync(full)) {
        console.warn(`  (omitido, no existe) ${file}`);
        continue;
      }
      try {
        await executeSqlFile(conn2, full, { label: file });
        await conn2.commit();
      } catch (err) {
        const ora = err.errorNum;
        if (SKIPPABLE_ORA.has(ora)) {
          console.warn(`  [SKIP] ${file}: ORA-${ora}`);
          await conn2.rollback();
          continue;
        }
        throw err;
      }
    }
  } finally {
    await conn2.close();
  }

  console.log('\n6/6 Verificación de esquema');
  await runPnpmScript('db:verify-schema');

  console.log('\n=== Bootstrap completado ===\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
